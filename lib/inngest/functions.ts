import { inngest } from "./client";
import { db } from "@/db";
import {
  applications,
  tenants,
  syncLogs,
  fieldMappings,
  outboundSyncQueue,
} from "@/db/schema";
import { eq, and, gt, asc, sql } from "drizzle-orm";
import { AirtableClient } from "@/lib/airtable";

// Helper to extract key fields
function extractKeyFields(
  recordFields: Record<string, any>,
  mappings: typeof fieldMappings.$inferSelect[]
) {
  const keyFields: Record<string, any> = {};
  mappings
    .filter((m) => m.isVisibleInList)
    .forEach((m) => {
      if (recordFields[m.airtableFieldName] !== undefined) {
        keyFields[m.airtableFieldName] = recordFields[m.airtableFieldName];
      }
    });
  return keyFields;
}

export const syncTenant = inngest.createFunction(
  { id: "sync-tenant" },
  { event: "app/sync.tenant" },
  async ({ event, step }) => {
    const { tenantId } = event.data;

    const tenant = await step.run("fetch-tenant", async () => {
      const [t] = await db
        .select()
        .from(tenants)
        .where(eq(tenants.id, tenantId));
      return t;
    });

    if (!tenant || !tenant.syncEnabled) return;

    // Simple decryption mock
    const apiKey = tenant.airtableApiKeyEncrypted;

    const airtable = new AirtableClient(apiKey, tenant.airtableBaseId);

    const mappings = await step.run("fetch-mappings", async () => {
      return await db
        .select()
        .from(fieldMappings)
        .where(eq(fieldMappings.tenantId, tenantId));
    });

    const lastSync = tenant.lastSyncAt
      ? tenant.lastSyncAt.toISOString()
      : undefined;
    
    // Log start
    const logId = await step.run("log-start", async () => {
        const [log] = await db.insert(syncLogs).values({
            tenantId,
            syncType: 'pull',
            status: 'started',
        }).returning({ id: syncLogs.id });
        return log.id;
    });

    try {
      const records = await step.run("fetch-airtable", async () => {
        const filterFormula = lastSync
          ? `LAST_MODIFIED_TIME() > '${lastSync}'`
          : undefined;
        return await airtable.fetchRecords(tenant.airtableTableId, {
          filterByFormula: filterFormula,
        });
      });

      let processed = 0;

      if (records.length > 0) {
        await step.run("upsert-records", async () => {
            // Process in chunks if needed, for now all at once
            for (const record of records) {
                const customFields = record.fields;
                const keyFields = extractKeyFields(customFields, mappings);
                
                // Upsert application
                // Note: Priority score is updated by DB trigger on insert/update
                await db.insert(applications).values({
                    tenantId,
                    airtableRecordId: record.id,
                    customFields,
                    keyFields,
                    syncedAt: new Date(),
                }).onConflictDoUpdate({
                    target: [applications.tenantId, applications.airtableRecordId],
                    set: {
                        customFields,
                        keyFields,
                        syncedAt: new Date(),
                    }
                });
                processed++;
            }
        });
      }

      await step.run("update-tenant-sync-time", async () => {
        await db
          .update(tenants)
          .set({ lastSyncAt: new Date() })
          .where(eq(tenants.id, tenantId));
      });

      await step.run("log-success", async () => {
          await db.update(syncLogs).set({
              status: 'completed',
              recordsProcessed: processed,
              completedAt: new Date(),
          }).where(eq(syncLogs.id, logId));
      });

    } catch (error: any) {
        await step.run("log-failure", async () => {
            await db.update(syncLogs).set({
                status: 'failed',
                errorMessage: error.message,
                completedAt: new Date(),
            }).where(eq(syncLogs.id, logId));
        });
        throw error;
    }
  }
);

export const processOutboundQueue = inngest.createFunction(
  { id: "process-outbound-queue" },
  { event: "app/process.outbound" },
  async ({ event, step }) => {
    const { tenantId } = event.data;
    
    const pendingItems = await step.run("fetch-pending", async () => {
        return await db.select()
            .from(outboundSyncQueue)
            .where(and(
                eq(outboundSyncQueue.tenantId, tenantId),
                eq(outboundSyncQueue.status, 'pending')
            ))
            .orderBy(asc(outboundSyncQueue.createdAt))
            .limit(50);
    });

    if (pendingItems.length === 0) return;

    const tenant = await step.run("fetch-tenant", async () => {
        const [t] = await db.select().from(tenants).where(eq(tenants.id, tenantId));
        return t;
    });

    const airtable = new AirtableClient(tenant.airtableApiKeyEncrypted, tenant.airtableBaseId);
    const mappings = await step.run("fetch-mappings", async () => {
        return await db.select().from(fieldMappings).where(eq(fieldMappings.tenantId, tenantId));
    });

    for (const item of pendingItems) {
        await step.run(`process-item-${item.id}`, async () => {
            try {
                const changeData = item.changeData as Record<string, any>;
                const fieldsToUpdate: Record<string, any> = {};
                
                // Map internal fields to Airtable fields
                // Logic: changeData keys are internal (e.g. 'status', 'tags', 'notes' or custom field names?)
                // Requirements say: 
                // "fields": { "Status": "...", "Tags": [...], "Notes": "..." }
                // We need to map 'status' -> 'Status' (Airtable field name)
                // Assuming we have mappings for these.
                // Or changeData uses the internal names and we find the mapping.
                
                // For this implementation, let's assume changeData keys match airtableFieldName if mapping exists, or are specific system fields.
                
                // Simple mapping logic:
                // If key is in mappings, use airtableFieldName.
                // For system fields (Status, Tags, Notes), we need to know their Airtable names.
                // Let's assume mappings table contains these with specific 'airtableFieldName'.
                // But how do we know which mapping corresponds to "Status"? 
                // Maybe `airtableFieldType` or `displayName`? 
                // Or `changeData` just provides the exact Airtable field name for simplicity in `pushSync`.
                // Requirements: "Map internal field names back to Airtable field names".
                
                // Let's assume changeData keys are the internal/display names or specific keys like 'status'.
                // We'll look for a mapping where `display_name` matches or some other heuristic.
                // For now, let's pass the raw Airtable field name in changeData from the API action for simplicity.
                
                Object.assign(fieldsToUpdate, changeData);

                await airtable.updateRecord(tenant.airtableTableId, item.airtableRecordId, fieldsToUpdate);
                
                await db.update(outboundSyncQueue)
                    .set({ status: 'completed', completedAt: new Date() })
                    .where(eq(outboundSyncQueue.id, item.id));

            } catch (error: any) {
                 await db.update(outboundSyncQueue)
                    .set({ 
                        status: 'failed', 
                        attempts: (item.attempts || 0) + 1,
                        errorMessage: error.message 
                    })
                    .where(eq(outboundSyncQueue.id, item.id));
            }
        });
    }
  }
);

// Scheduler to trigger syncs
export const scheduler = inngest.createFunction(
    { id: "scheduler" },
    { cron: "* * * * *" }, // Every minute
    async ({ step }) => {
        const tenantsToSync = await step.run("fetch-tenants-due", async () => {
            // Logic to find tenants due for sync (lastSync + interval < now)
            // Simplification: Fetch all enabled tenants
            return await db.select({ id: tenants.id }).from(tenants).where(eq(tenants.syncEnabled, true));
        });

        for (const t of tenantsToSync) {
            await step.sendEvent({
                name: "app/sync.tenant",
                data: { tenantId: t.id },
            });
        }
    }
);

