import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  boolean,
  decimal,
  jsonb,
  unique,
  index,
  primaryKey,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// Users
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Tenants
export const tenants = pgTable(
  "tenants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    ownerId: uuid("owner_id").references(() => users.id),
    airtableApiKeyEncrypted: text("airtable_api_key_encrypted").notNull(),
    airtableBaseId: text("airtable_base_id").notNull(),
    airtableTableId: text("airtable_table_id").notNull(),
    syncIntervalMinutes: integer("sync_interval_minutes").default(5),
    lastSyncAt: timestamp("last_sync_at"),
    syncEnabled: boolean("sync_enabled").default(true),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (t) => ({
    uniqueAirtable: unique().on(t.airtableBaseId, t.airtableTableId),
    ownerIdx: index("idx_tenants_owner").on(t.ownerId),
  })
);

// Tenant Users
export const tenantUsers = pgTable(
  "tenant_users",
  {
    tenantId: uuid("tenant_id")
      .references(() => tenants.id, { onDelete: "cascade" })
      .notNull(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    role: text("role").default("member"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.tenantId, t.userId] }),
  })
);

// Field Mappings
export const fieldMappings = pgTable(
  "field_mappings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .references(() => tenants.id, { onDelete: "cascade" })
      .notNull(),
    airtableFieldId: text("airtable_field_id").notNull(),
    airtableFieldName: text("airtable_field_name").notNull(),
    airtableFieldType: text("airtable_field_type").notNull(),
    displayName: text("display_name").notNull(),
    isVisibleInList: boolean("is_visible_in_list").default(false),
    isVisibleInDetail: boolean("is_visible_in_detail").default(true),
    sortOrder: integer("sort_order"),
    isPriorityField: boolean("is_priority_field").default(false),
    priorityWeight: decimal("priority_weight", { precision: 5, scale: 2 }).default("0"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (t) => ({
    uniqueField: unique().on(t.tenantId, t.airtableFieldId),
    tenantIdx: index("idx_field_mappings_tenant").on(t.tenantId),
  })
);

// Priority Configs
export const priorityConfigs = pgTable(
  "priority_configs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .references(() => tenants.id, { onDelete: "cascade" })
      .notNull(),
    scoringFormula: jsonb("scoring_formula").notNull(),
    redFlagPenalty: decimal("red_flag_penalty", { precision: 5, scale: 2 }).default("3"),
    isActive: boolean("is_active").default(true),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (t) => ({
    tenantIdx: index("idx_priority_configs_tenant").on(t.tenantId),
  })
);

// Applications
export const applications = pgTable(
  "applications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .references(() => tenants.id, { onDelete: "cascade" })
      .notNull(),
    airtableRecordId: text("airtable_record_id").notNull(),
    status: text("status").default("pending"),
    priorityScore: decimal("priority_score", { precision: 10, scale: 2 }),
    submittedAt: timestamp("submitted_at"),
    customFields: jsonb("custom_fields").notNull().default({}),
    keyFields: jsonb("key_fields"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
    syncedAt: timestamp("synced_at"),
  },
  (t) => ({
    uniqueRecord: unique().on(t.tenantId, t.airtableRecordId),
    tenantPriorityIdx: index("idx_applications_tenant_priority").on(t.tenantId, t.priorityScore),
    tenantStatusIdx: index("idx_applications_tenant_status").on(t.tenantId, t.status),
    syncedIdx: index("idx_applications_synced").on(t.syncedAt),
    customFieldsIdx: index("idx_applications_custom_fields").using("gin", t.customFields),
    keyFieldsIdx: index("idx_applications_key_fields").using("gin", t.keyFields),
  })
);

// Notes
export const notes = pgTable(
  "notes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    applicationId: uuid("application_id")
      .references(() => applications.id, { onDelete: "cascade" })
      .notNull(),
    userId: uuid("user_id").references(() => users.id),
    body: text("body").notNull(),
    isSyncedToAirtable: boolean("is_synced_to_airtable").default(false),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (t) => ({
    applicationIdx: index("idx_notes_application").on(t.applicationId),
  })
);

// Tags
export const tags = pgTable(
  "tags",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .references(() => tenants.id, { onDelete: "cascade" })
      .notNull(),
    name: text("name").notNull(),
    color: text("color"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (t) => ({
    uniqueTag: unique().on(t.tenantId, t.name),
  })
);

// Application Tags
export const applicationTags = pgTable(
  "application_tags",
  {
    applicationId: uuid("application_id")
      .references(() => applications.id, { onDelete: "cascade" })
      .notNull(),
    tagId: uuid("tag_id")
      .references(() => tags.id, { onDelete: "cascade" })
      .notNull(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.applicationId, t.tagId] }),
  })
);

// Sync Logs
export const syncLogs = pgTable(
  "sync_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .references(() => tenants.id, { onDelete: "cascade" })
      .notNull(),
    syncType: text("sync_type").notNull(), // 'pull' or 'push'
    status: text("status").notNull(), // 'started', 'completed', 'failed'
    recordsProcessed: integer("records_processed").default(0),
    recordsFailed: integer("records_failed").default(0),
    errorMessage: text("error_message"),
    startedAt: timestamp("started_at").defaultNow(),
    completedAt: timestamp("completed_at"),
  },
  (t) => ({
    tenantIdx: index("idx_sync_logs_tenant").on(t.tenantId, t.startedAt),
  })
);

// Outbound Sync Queue
export const outboundSyncQueue = pgTable(
  "outbound_sync_queue",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .references(() => tenants.id, { onDelete: "cascade" })
      .notNull(),
    applicationId: uuid("application_id")
      .references(() => applications.id, { onDelete: "cascade" })
      .notNull(),
    airtableRecordId: text("airtable_record_id").notNull(),
    changeType: text("change_type").notNull(), // 'status', 'tags', 'notes'
    changeData: jsonb("change_data").notNull(),
    status: text("status").default("pending"), // 'pending', 'processing', 'completed', 'failed'
    attempts: integer("attempts").default(0),
    lastAttemptAt: timestamp("last_attempt_at"),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at").defaultNow(),
    completedAt: timestamp("completed_at"),
  },
  (t) => ({
    statusIdx: index("idx_outbound_sync_queue_status").on(t.status, t.createdAt),
    tenantIdx: index("idx_outbound_sync_queue_tenant").on(t.tenantId),
  })
);

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  tenantsOwned: many(tenants),
  tenantMemberships: many(tenantUsers),
  notes: many(notes),
}));

export const tenantsRelations = relations(tenants, ({ one, many }) => ({
  owner: one(users, {
    fields: [tenants.ownerId],
    references: [users.id],
  }),
  members: many(tenantUsers),
  fieldMappings: many(fieldMappings),
  priorityConfigs: many(priorityConfigs),
  applications: many(applications),
  tags: many(tags),
  syncLogs: many(syncLogs),
  outboundSyncQueue: many(outboundSyncQueue),
}));

export const tenantUsersRelations = relations(tenantUsers, ({ one }) => ({
  tenant: one(tenants, {
    fields: [tenantUsers.tenantId],
    references: [tenants.id],
  }),
  user: one(users, {
    fields: [tenantUsers.userId],
    references: [users.id],
  }),
}));

export const applicationsRelations = relations(applications, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [applications.tenantId],
    references: [tenants.id],
  }),
  notes: many(notes),
  tags: many(applicationTags),
}));

export const notesRelations = relations(notes, ({ one }) => ({
  application: one(applications, {
    fields: [notes.applicationId],
    references: [applications.id],
  }),
  user: one(users, {
    fields: [notes.userId],
    references: [users.id],
  }),
}));

export const tagsRelations = relations(tags, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [tags.tenantId],
    references: [tenants.id],
  }),
  applications: many(applicationTags),
}));

export const applicationTagsRelations = relations(applicationTags, ({ one }) => ({
  application: one(applications, {
    fields: [applicationTags.applicationId],
    references: [applications.id],
  }),
  tag: one(tags, {
    fields: [applicationTags.tagId],
    references: [tags.id],
  }),
}));

