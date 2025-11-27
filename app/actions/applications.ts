"use server";

import { auth } from "@/auth";
import { db } from "@/db";
import { applications, outboundSyncQueue, notes, tags, applicationTags, tenants } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function getQueue(tenantId: string, page = 1, limit = 50) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  // Verify tenant ownership
  const [tenant] = await db.select().from(tenants).where(and(eq(tenants.id, tenantId), eq(tenants.ownerId, session.user.id)));
  if (!tenant) throw new Error("Unauthorized or Tenant not found");

  const offset = (page - 1) * limit;

  const data = await db
    .select()
    .from(applications)
    .where(eq(applications.tenantId, tenantId))
    .orderBy(desc(applications.priorityScore))
    .limit(limit)
    .offset(offset);
    
  return data;
}

export async function getApplication(id: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  // Fetch app and check tenant ownership
  const [app] = await db
    .select({
        app: applications,
        tenantOwnerId: tenants.ownerId
    })
    .from(applications)
    .innerJoin(tenants, eq(applications.tenantId, tenants.id))
    .where(eq(applications.id, id));

  if (!app) return null;
  if (app.tenantOwnerId !== session.user.id) throw new Error("Unauthorized");

  const application = app.app;

  // Fetch notes and tags
  const appNotes = await db
    .select()
    .from(notes)
    .where(eq(notes.applicationId, id))
    .orderBy(desc(notes.createdAt));

  // We need to join tags
  const appTags = await db
    .select({
        id: tags.id,
        name: tags.name,
        color: tags.color
    })
    .from(tags)
    .innerJoin(applicationTags, eq(tags.id, applicationTags.tagId))
    .where(eq(applicationTags.applicationId, id));

  return { ...application, notes: appNotes, tags: appTags };
}

export async function updateStatus(
  applicationId: string,
  status: string,
  tenantId: string
) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  // Verify tenant ownership and app belongs to tenant
  const [app] = await db
    .select({
        app: applications,
        tenantOwnerId: tenants.ownerId
    })
    .from(applications)
    .innerJoin(tenants, eq(applications.tenantId, tenants.id))
    .where(and(eq(applications.id, applicationId), eq(tenants.id, tenantId)));

  if (!app || app.tenantOwnerId !== session.user.id) throw new Error("Unauthorized");

  // Update local
  const [updatedApp] = await db
    .update(applications)
    .set({ status })
    .where(eq(applications.id, applicationId))
    .returning();

  // Queue sync
  await db.insert(outboundSyncQueue).values({
    tenantId,
    applicationId,
    airtableRecordId: updatedApp.airtableRecordId,
    changeType: "status",
    changeData: { Status: status }, 
  });

  revalidatePath(`/applications/${applicationId}`);
  return { success: true };
}

export async function addNote(
    applicationId: string,
    body: string,
    tenantId: string
) {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");

    // Verify tenant/app
    const [app] = await db
        .select({
            app: applications,
            tenantOwnerId: tenants.ownerId
        })
        .from(applications)
        .innerJoin(tenants, eq(applications.tenantId, tenants.id))
        .where(and(eq(applications.id, applicationId), eq(tenants.id, tenantId)));

    if (!app || app.tenantOwnerId !== session.user.id) throw new Error("Unauthorized");

    await db.insert(notes).values({
        applicationId,
        userId: session.user.id,
        body
    });
    
    await db.insert(outboundSyncQueue).values({
        tenantId,
        applicationId,
        airtableRecordId: app.app.airtableRecordId,
        changeType: "notes",
        changeData: { Notes: body }, 
    });
    
    revalidatePath(`/applications/${applicationId}`);
}
