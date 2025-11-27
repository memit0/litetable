CREATE TABLE "application_tags" (
	"application_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "application_tags_application_id_tag_id_pk" PRIMARY KEY("application_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"airtable_record_id" text NOT NULL,
	"status" text DEFAULT 'pending',
	"priority_score" numeric(10, 2),
	"submitted_at" timestamp,
	"custom_fields" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"key_fields" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"synced_at" timestamp,
	CONSTRAINT "applications_tenant_id_airtable_record_id_unique" UNIQUE("tenant_id","airtable_record_id")
);
--> statement-breakpoint
CREATE TABLE "field_mappings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"airtable_field_id" text NOT NULL,
	"airtable_field_name" text NOT NULL,
	"airtable_field_type" text NOT NULL,
	"display_name" text NOT NULL,
	"is_visible_in_list" boolean DEFAULT false,
	"is_visible_in_detail" boolean DEFAULT true,
	"sort_order" integer,
	"is_priority_field" boolean DEFAULT false,
	"priority_weight" numeric(5, 2) DEFAULT '0',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "field_mappings_tenant_id_airtable_field_id_unique" UNIQUE("tenant_id","airtable_field_id")
);
--> statement-breakpoint
CREATE TABLE "notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"user_id" uuid,
	"body" text NOT NULL,
	"is_synced_to_airtable" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "outbound_sync_queue" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"application_id" uuid NOT NULL,
	"airtable_record_id" text NOT NULL,
	"change_type" text NOT NULL,
	"change_data" jsonb NOT NULL,
	"status" text DEFAULT 'pending',
	"attempts" integer DEFAULT 0,
	"last_attempt_at" timestamp,
	"error_message" text,
	"created_at" timestamp DEFAULT now(),
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "priority_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"scoring_formula" jsonb NOT NULL,
	"red_flag_penalty" numeric(5, 2) DEFAULT '3',
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sync_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"sync_type" text NOT NULL,
	"status" text NOT NULL,
	"records_processed" integer DEFAULT 0,
	"records_failed" integer DEFAULT 0,
	"error_message" text,
	"started_at" timestamp DEFAULT now(),
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"color" text,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "tags_tenant_id_name_unique" UNIQUE("tenant_id","name")
);
--> statement-breakpoint
CREATE TABLE "tenant_users" (
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text DEFAULT 'member',
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "tenant_users_tenant_id_user_id_pk" PRIMARY KEY("tenant_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "tenants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"owner_id" uuid,
	"airtable_api_key_encrypted" text NOT NULL,
	"airtable_base_id" text NOT NULL,
	"airtable_table_id" text NOT NULL,
	"sync_interval_minutes" integer DEFAULT 5,
	"last_sync_at" timestamp,
	"sync_enabled" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "tenants_airtable_base_id_airtable_table_id_unique" UNIQUE("airtable_base_id","airtable_table_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "application_tags" ADD CONSTRAINT "application_tags_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_tags" ADD CONSTRAINT "application_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "field_mappings" ADD CONSTRAINT "field_mappings_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outbound_sync_queue" ADD CONSTRAINT "outbound_sync_queue_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outbound_sync_queue" ADD CONSTRAINT "outbound_sync_queue_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "priority_configs" ADD CONSTRAINT "priority_configs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_logs" ADD CONSTRAINT "sync_logs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tags" ADD CONSTRAINT "tags_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_users" ADD CONSTRAINT "tenant_users_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_users" ADD CONSTRAINT "tenant_users_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_applications_tenant_priority" ON "applications" USING btree ("tenant_id","priority_score");--> statement-breakpoint
CREATE INDEX "idx_applications_tenant_status" ON "applications" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "idx_applications_synced" ON "applications" USING btree ("synced_at");--> statement-breakpoint
CREATE INDEX "idx_applications_custom_fields" ON "applications" USING gin ("custom_fields");--> statement-breakpoint
CREATE INDEX "idx_applications_key_fields" ON "applications" USING gin ("key_fields");--> statement-breakpoint
CREATE INDEX "idx_field_mappings_tenant" ON "field_mappings" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_notes_application" ON "notes" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "idx_outbound_sync_queue_status" ON "outbound_sync_queue" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "idx_outbound_sync_queue_tenant" ON "outbound_sync_queue" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_priority_configs_tenant" ON "priority_configs" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_sync_logs_tenant" ON "sync_logs" USING btree ("tenant_id","started_at");--> statement-breakpoint
CREATE INDEX "idx_tenants_owner" ON "tenants" USING btree ("owner_id");