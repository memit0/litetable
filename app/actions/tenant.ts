"use server";

import { auth } from "@/auth";
import { db } from "@/db";
import { tenants, fieldMappings, priorityConfigs } from "@/db/schema";
import { AirtableClient } from "@/lib/airtable";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const connectSchema = z.object({
  apiKey: z.string().min(1),
  baseId: z.string().min(1),
  tableId: z.string().min(1),
  name: z.string().min(1),
});

export async function connectAirtable(data: z.infer<typeof connectSchema>) {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  const validation = connectSchema.safeParse(data);
  if (!validation.success) {
    throw new Error("Invalid data");
  }

  const { apiKey, baseId, tableId, name } = validation.data;

  // Validate connection by fetching schema
  const airtable = new AirtableClient(apiKey, baseId);
  let fields: any[];
  try {
    fields = await airtable.fetchTableSchema(tableId);
  } catch (error) {
    throw new Error("Failed to connect to Airtable. Check credentials.");
  }

  // Upsert Tenant
  // For this MVP, let's assume one tenant per user or create new one
  // We'll create a new one for simplicity
  const [tenant] = await db
    .insert(tenants)
    .values({
      name,
      ownerId: session.user.id,
      airtableApiKeyEncrypted: apiKey, // In prod, encrypt this!
      airtableBaseId: baseId,
      airtableTableId: tableId,
    })
    .returning();

  // Save Field Mappings
  if (fields && fields.length > 0) {
    await db.insert(fieldMappings).values(
      fields.map((field: any) => ({
        tenantId: tenant.id,
        airtableFieldId: field.id,
        airtableFieldName: field.name,
        airtableFieldType: field.type,
        displayName: field.name,
        isVisibleInList: true, // Default true
      }))
    );
  }

  revalidatePath("/");
  return { success: true, tenantId: tenant.id };
}

export async function getTenant() {
    const session = await auth();
    if (!session?.user?.id) return null;

    // Get first tenant owned by user
    const [tenant] = await db.select().from(tenants).where(eq(tenants.ownerId, session.user.id));
    return tenant;
}

export async function getFieldMappings(tenantId: string) {
  // Auth check
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  return await db
    .select()
    .from(fieldMappings)
    .where(eq(fieldMappings.tenantId, tenantId));
}

export async function updateFieldMapping(
  id: string,
  data: {
    displayName?: string;
    isVisibleInList?: boolean;
    priorityWeight?: string;
  }
) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  // Convert priorityWeight to decimal string or number
  const updateData: any = { ...data };
  if (data.priorityWeight) {
      // Ensure it's a valid decimal
  }

  await db.update(fieldMappings).set(updateData).where(eq(fieldMappings.id, id));
  revalidatePath("/onboarding/mappings");
}

export async function getPriorityConfig(tenantId: string) {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");

    const [config] = await db.select().from(priorityConfigs).where(eq(priorityConfigs.tenantId, tenantId));
    return config;
}

export async function updatePriorityConfig(tenantId: string, scoringFormula: any) {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");

    // Upsert
    const existing = await getPriorityConfig(tenantId);
    if (existing) {
        await db.update(priorityConfigs).set({ scoringFormula }).where(eq(priorityConfigs.id, existing.id));
    } else {
        await db.insert(priorityConfigs).values({
            tenantId,
            scoringFormula,
        });
    }
}

export async function enableSync(tenantId: string) {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");

    await db.update(tenants).set({ syncEnabled: true }).where(eq(tenants.id, tenantId));
    
    // Ideally trigger initial sync immediately via Inngest
}
