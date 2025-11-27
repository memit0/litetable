# 📘 **TECHNICAL SPECIFICATION DOCUMENT**

For a **multi-tenant** web application that ingests data from Airtable, stores it in a local database, ranks entries by priority, and provides a minimal, keyboard-driven review UI.

---

# **Multi-Tenancy Overview**

This application supports **multiple users/organizations**, each with their own:

* Airtable account/base/table
* Custom field schemas
* Priority scoring formulas
* Sync configurations
* Complete data isolation

---

# **System Architecture**

```
          User Authentication (NextAuth/Clerk)
                       │
              ┌────────┴────────┐
              │  Tenant Context │
              └────────┬────────┘
                       │
         ┌─────────────┼─────────────┐
         │             │             │
         ▼             ▼             ▼
   Tenant A      Tenant B      Tenant C
   Airtable      Airtable      Airtable
         │             │             │
         └─────────────┼─────────────┘
                       │
        (Scheduled Pull Sync: 1–5 min per tenant)
                       ▼
          Per-Tenant Sync Workers
                       │
                       ▼
              Postgres Database
           (Tenant-isolated data)
                       │
    (Direct queries with tenant_id filtering)
                       ▼
            Next.js Application
    (Frontend + API Routes + Server Actions + Hotkeys)
         (Dynamic UI based on field mappings)
```

Data flow is bidirectional:

* **Airtable → Postgres** (pull sync, per tenant)
* **Postgres → Airtable** (push sync, per tenant) performed asynchronously

---

# **Tech Stack**

### **Frontend**

* Next.js 15 (App Router)
* React
* TypeScript
* TailwindCSS
* shadcn/ui components
* Hotkeys library (e.g., `react-hotkeys-hook`)
* React Query (optional) OR Next.js Server Actions for mutations

### **Authentication**

* NextAuth.js
* Session management with tenant context
* Secure credential storage

### **Backend**

* Next.js API Routes or Server Actions for:

  * CRUD operations on applications
  * Status updates
  * Notes/tags
  * Queue retrieval
  * Tenant configuration management
  * Field mapping management
  * Dynamic schema discovery

### **Database**

* Postgres (Supabase, Neon, or Railway)
* Row-level security (RLS) for tenant isolation
* JSONB for flexible field storage

### **Background Jobs**

* Inngest OR external cron-based scheduler
* Per-tenant sync workers
* Runs sync tasks:

  * Airtable → Postgres (per tenant)
  * Postgres → Airtable (per tenant)

### **External Services**

* Airtable REST API v0 or v1
* Airtable Metadata API (for schema discovery)

---

# **Database Schema**

## **Core Multi-Tenant Tables**

### **users**
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### **tenants**
```sql
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  owner_id UUID REFERENCES users(id),
  
  -- Airtable Connection
  airtable_api_key_encrypted TEXT NOT NULL,
  airtable_base_id TEXT NOT NULL,
  airtable_table_id TEXT NOT NULL,
  
  -- Sync Configuration
  sync_interval_minutes INTEGER DEFAULT 5,
  last_sync_at TIMESTAMP,
  sync_enabled BOOLEAN DEFAULT true,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(airtable_base_id, airtable_table_id)
);

CREATE INDEX idx_tenants_owner ON tenants(owner_id);
```

### **tenant_users** (for multi-user tenants)
```sql
CREATE TABLE tenant_users (
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member', -- 'owner', 'admin', 'member', 'viewer'
  created_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (tenant_id, user_id)
);
```

## **Dynamic Schema Tables**

### **field_mappings**
```sql
CREATE TABLE field_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Airtable Field Info
  airtable_field_id TEXT NOT NULL,
  airtable_field_name TEXT NOT NULL,
  airtable_field_type TEXT NOT NULL, -- text, number, singleSelect, multipleSelects, date, etc.
  
  -- Display Configuration
  display_name TEXT NOT NULL,
  is_visible_in_list BOOLEAN DEFAULT false,
  is_visible_in_detail BOOLEAN DEFAULT true,
  sort_order INTEGER,
  
  -- Priority Scoring
  is_priority_field BOOLEAN DEFAULT false,
  priority_weight DECIMAL(5,2) DEFAULT 0,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(tenant_id, airtable_field_id)
);

CREATE INDEX idx_field_mappings_tenant ON field_mappings(tenant_id);
```

### **priority_configs**
```sql
CREATE TABLE priority_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Scoring Formula (stored as JSON for flexibility)
  -- Example: {"experience_score": 3, "referral_score": 5, "fit_score": 3}
  scoring_formula JSONB NOT NULL,
  
  -- Red flag penalties
  red_flag_penalty DECIMAL(5,2) DEFAULT 3,
  
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_priority_configs_tenant ON priority_configs(tenant_id);
```

## **Application Data Tables**

### **applications**
```sql
CREATE TABLE applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Airtable Reference
  airtable_record_id TEXT NOT NULL,
  
  -- Core Fields (always present)
  status TEXT DEFAULT 'pending', -- pending, reviewing, accepted, rejected, waitlisted
  priority_score DECIMAL(10,2),
  submitted_at TIMESTAMP,
  
  -- Flexible Field Storage
  -- All Airtable fields stored as JSONB for maximum flexibility
  custom_fields JSONB NOT NULL DEFAULT '{}',
  
  -- Key fields extracted for quick access (computed from custom_fields)
  key_fields JSONB, -- Subset of fields needed in list view
  
  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  synced_at TIMESTAMP,
  
  UNIQUE(tenant_id, airtable_record_id)
);

-- Performance indexes
CREATE INDEX idx_applications_tenant_priority ON applications(tenant_id, priority_score DESC);
CREATE INDEX idx_applications_tenant_status ON applications(tenant_id, status);
CREATE INDEX idx_applications_synced ON applications(synced_at);

-- JSONB indexes for custom field queries
CREATE INDEX idx_applications_custom_fields ON applications USING GIN (custom_fields);
CREATE INDEX idx_applications_key_fields ON applications USING GIN (key_fields);
```

### **notes**
```sql
CREATE TABLE notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID REFERENCES applications(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  body TEXT NOT NULL,
  is_synced_to_airtable BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_notes_application ON notes(application_id);
```

### **tags**
```sql
CREATE TABLE tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(tenant_id, name)
);

CREATE TABLE application_tags (
  application_id UUID REFERENCES applications(id) ON DELETE CASCADE,
  tag_id UUID REFERENCES tags(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (application_id, tag_id)
);
```

## **Sync Management Tables**

### **sync_logs**
```sql
CREATE TABLE sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  sync_type TEXT NOT NULL, -- 'pull' or 'push'
  status TEXT NOT NULL, -- 'started', 'completed', 'failed'
  records_processed INTEGER DEFAULT 0,
  records_failed INTEGER DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);

CREATE INDEX idx_sync_logs_tenant ON sync_logs(tenant_id, started_at DESC);
```

### **outbound_sync_queue**
```sql
CREATE TABLE outbound_sync_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  application_id UUID REFERENCES applications(id) ON DELETE CASCADE,
  airtable_record_id TEXT NOT NULL,
  
  -- What changed
  change_type TEXT NOT NULL, -- 'status', 'tags', 'notes'
  change_data JSONB NOT NULL,
  
  -- Sync Status
  status TEXT DEFAULT 'pending', -- pending, processing, completed, failed
  attempts INTEGER DEFAULT 0,
  last_attempt_at TIMESTAMP,
  error_message TEXT,
  
  created_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);

CREATE INDEX idx_outbound_sync_queue_status ON outbound_sync_queue(status, created_at);
CREATE INDEX idx_outbound_sync_queue_tenant ON outbound_sync_queue(tenant_id);
```

# **Priority Scoring (Compute Function)**

## **Dynamic Per-Tenant Scoring**

Each tenant defines their own priority formula based on their Airtable fields.

### **Default Formula (Template)**

```
priority_score =
  (experience_score * 3) +
  (referral_score * 5) +
  (fit_score * 3) +
  (essay_quality * 2) +
  (urgency_score * 1) -
  (red_flags * 3)
```

### **Implementation Approach**

1. **Field Mapping**: During tenant onboarding, identify which Airtable fields map to scoring components
2. **Weight Configuration**: Tenant sets weights for each field in `priority_configs` table
3. **Dynamic Computation**: Build scoring query dynamically based on tenant's configuration

### **SQL Function (Pseudo-code)**

```sql
CREATE OR REPLACE FUNCTION calculate_priority_score(
  p_tenant_id UUID,
  p_custom_fields JSONB
) RETURNS DECIMAL AS $$
DECLARE
  v_config JSONB;
  v_score DECIMAL := 0;
  v_field_name TEXT;
  v_weight DECIMAL;
  v_field_value DECIMAL;
BEGIN
  -- Get tenant's scoring formula
  SELECT scoring_formula INTO v_config
  FROM priority_configs
  WHERE tenant_id = p_tenant_id AND is_active = true
  LIMIT 1;
  
  -- Iterate through each field in the formula
  FOR v_field_name, v_weight IN 
    SELECT key, value::decimal 
    FROM jsonb_each_text(v_config)
  LOOP
    -- Extract field value from custom_fields (with type coercion)
    v_field_value := COALESCE(
      (p_custom_fields->>v_field_name)::decimal, 
      0
    );
    
    -- Add to total score
    v_score := v_score + (v_field_value * v_weight);
  END LOOP;
  
  RETURN v_score;
END;
$$ LANGUAGE plpgsql;
```

### **Trigger for Auto-Update**

```sql
CREATE OR REPLACE FUNCTION update_priority_score_trigger()
RETURNS TRIGGER AS $$
BEGIN
  NEW.priority_score := calculate_priority_score(
    NEW.tenant_id,
    NEW.custom_fields
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER applications_priority_score
  BEFORE INSERT OR UPDATE OF custom_fields
  ON applications
  FOR EACH ROW
  EXECUTE FUNCTION update_priority_score_trigger();
```

### **Requirements**

* Update `priority_score` on every sync pull
* Store computed score in `applications.priority_score`
* Allow tenants to modify weights through UI
* Validate that all fields in formula exist in field_mappings

---

# **Airtable Sync Worker**

## **Schema Discovery (One-time per tenant)**

Before syncing data, discover and map the Airtable schema:

### **Steps:**

1. Fetch table metadata:
   ```
   GET https://api.airtable.com/v0/meta/bases/{baseId}/tables
   ```

2. For each field in the table:
   * Store in `field_mappings` table
   * Detect field type (text, number, select, etc.)
   * Set default visibility and display options

3. Prompt tenant to configure:
   * Which fields contribute to priority scoring
   * Field weights
   * Which fields to display in list view

## **Pull Sync (Airtable → Postgres)**

Schedule: every 1–5 minutes **per tenant**.

### **Steps:**

1. **For each tenant** with `sync_enabled = true`:

2. Fetch records updated since last sync:
   ```
   GET https://api.airtable.com/v0/{base}/{table}?filterByFormula=LAST_MODIFIED_TIME() > {timestamp}
   ```

3. For each record:
   * Store ALL fields in `custom_fields` JSONB (no schema assumptions)
   * Extract key fields based on `field_mappings` where `is_visible_in_list = true`
   * Store in `key_fields` JSONB for performance
   * Compute `priority_score` using tenant's formula
   * Upsert into `applications` table with `tenant_id`

4. Insert sync log entry in `sync_logs`

### **Pseudocode:**

```typescript
async function pullSyncForTenant(tenantId: string) {
  const tenant = await getTenant(tenantId);
  const fieldMappings = await getFieldMappings(tenantId);
  
  // Fetch updated records from Airtable
  const records = await airtable
    .base(tenant.airtable_base_id)
    .table(tenant.airtable_table_id)
    .select({
      filterByFormula: `LAST_MODIFIED_TIME() > '${tenant.last_sync_at}'`
    })
    .all();
  
  for (const record of records) {
    // Store all fields as-is
    const customFields = record.fields;
    
    // Extract only the key fields for list view
    const keyFields = extractKeyFields(customFields, fieldMappings);
    
    await db.applications.upsert({
      tenant_id: tenantId,
      airtable_record_id: record.id,
      custom_fields: customFields,
      key_fields: keyFields,
      // priority_score computed by trigger
      synced_at: new Date()
    });
  }
  
  // Update tenant's last sync time
  await db.tenants.update(tenantId, {
    last_sync_at: new Date()
  });
}
```

## **Push Sync (Postgres → Airtable)**

Triggered on:
* Status change
* Added tags
* Added notes

### **Implementation:**

1. **On local change**, insert into `outbound_sync_queue`:
   ```typescript
   await db.outbound_sync_queue.insert({
     tenant_id: tenantId,
     application_id: applicationId,
     airtable_record_id: record.airtable_record_id,
     change_type: 'status',
     change_data: { status: 'accepted' }
   });
   ```

2. **Background worker** processes queue (per tenant):
   ```typescript
   async function processOutboundSync() {
     const pending = await db.outbound_sync_queue
       .where({ status: 'pending' })
       .orderBy('created_at')
       .limit(50);
     
     for (const item of pending) {
       try {
         const tenant = await getTenant(item.tenant_id);
         const fieldMappings = await getFieldMappings(item.tenant_id);
         
         // Map internal field names back to Airtable field names
         const airtableFields = mapToAirtableFields(
           item.change_data,
           fieldMappings
         );
         
         await airtable
           .base(tenant.airtable_base_id)
           .table(tenant.airtable_table_id)
           .update(item.airtable_record_id, {
             fields: airtableFields
           });
         
         await db.outbound_sync_queue.update(item.id, {
           status: 'completed',
           completed_at: new Date()
         });
       } catch (error) {
         await db.outbound_sync_queue.update(item.id, {
           status: 'failed',
           attempts: item.attempts + 1,
           error_message: error.message
         });
       }
     }
   }
   ```

### **Retry Logic:**

* Retry failed syncs up to 3 times
* Exponential backoff: 1min, 5min, 15min
* Alert tenant if sync fails repeatedly

---

# **API Endpoints / Server Actions**

All endpoints require authentication and tenant context.

## **Tenant Configuration**

### **GET /api/tenant**

Returns current tenant configuration:

```json
{
  "id": "uuid",
  "name": "My Organization",
  "airtable_base_id": "...",
  "sync_interval_minutes": 5,
  "last_sync_at": "2025-11-27T10:00:00Z",
  "sync_enabled": true
}
```

### **POST /api/tenant/connect**

Connect or update Airtable configuration:

```json
{
  "airtable_api_key": "...",
  "airtable_base_id": "...",
  "airtable_table_id": "..."
}
```

Action:
* Encrypt and store API key
* Trigger schema discovery
* Return discovered fields

### **POST /api/tenant/discover-schema**

Manually trigger schema discovery:

Response:
```json
{
  "fields": [
    {
      "id": "fld...",
      "name": "Experience Level",
      "type": "singleSelect"
    }
  ]
}
```

## **Field Mapping Configuration**

### **GET /api/field-mappings**

Returns all field mappings for current tenant:

```json
[
  {
    "id": "uuid",
    "airtable_field_name": "Experience Level",
    "display_name": "Experience",
    "is_visible_in_list": true,
    "is_priority_field": true,
    "priority_weight": 3
  }
]
```

### **PUT /api/field-mappings/:id**

Update field mapping configuration:

```json
{
  "display_name": "Experience Score",
  "is_visible_in_list": true,
  "priority_weight": 4
}
```

### **POST /api/priority-config**

Update priority scoring formula:

```json
{
  "scoring_formula": {
    "experience_score": 3,
    "referral_score": 5,
    "fit_score": 3,
    "essay_quality": 2
  },
  "red_flag_penalty": 3
}
```

## **Application Review**

### **GET /api/queue**

Returns top N applications for current tenant:

Query params:
* `limit` (default: 50)
* `status` (default: 'pending')
* `offset` for pagination

Response:

```json
[
  {
    "id": "uuid",
    "priority_score": 85.5,
    "submitted_at": "2025-11-20T...",
    "key_fields": {
      "name": "John Doe",
      "email": "john@example.com",
      "experience": "Senior"
    },
    "tags": ["promising", "urgent"]
  }
]
```

### **GET /api/application/:id**

Returns full application data:

```json
{
  "id": "uuid",
  "airtable_record_id": "rec...",
  "status": "pending",
  "priority_score": 85.5,
  "submitted_at": "2025-11-20T...",
  "custom_fields": {
    // All Airtable fields
  },
  "key_fields": {
    // Subset for display
  },
  "tags": [
    { "id": "uuid", "name": "promising", "color": "#22c55e" }
  ],
  "notes": [
    {
      "id": "uuid",
      "body": "Great experience",
      "user": { "name": "Jane" },
      "created_at": "2025-11-27T..."
    }
  ]
}
```

### **POST /api/application/:id/status**

Update application status:

Body:
```json
{ "status": "accepted" }
```

Action:
* Update Postgres immediately (optimistic UI)
* Queue push sync to Airtable

### **POST /api/application/:id/note**

Add note to application:

Body:
```json
{ "body": "Excellent technical background" }
```

Action:
* Store in `notes` table
* Queue push sync to Airtable (if configured)

### **POST /api/application/:id/tag**

Add tag to application:

Body:
```json
{ "tag": "urgent" }
```

Action:
* Create tag if doesn't exist
* Link to application
* Queue push sync to Airtable (if configured)

### **DELETE /api/application/:id/tag/:tagId**

Remove tag from application.

## **Sync Management**

### **POST /api/sync/trigger**

Manually trigger sync for current tenant:

Body:
```json
{ "type": "pull" }
```

### **GET /api/sync/logs**

Get recent sync history:

Query params:
* `limit` (default: 20)
* `type` (pull/push)

Response:
```json
[
  {
    "id": "uuid",
    "sync_type": "pull",
    "status": "completed",
    "records_processed": 45,
    "records_failed": 0,
    "started_at": "2025-11-27T10:00:00Z",
    "completed_at": "2025-11-27T10:00:15Z"
  }
]
```

### **GET /api/sync/queue**

Get outbound sync queue status:

Response:
```json
{
  "pending": 5,
  "processing": 2,
  "failed": 1,
  "items": [
    {
      "id": "uuid",
      "change_type": "status",
      "attempts": 1,
      "status": "failed",
      "error_message": "Rate limit exceeded"
    }
  ]
}
```

---

# **Tenant Onboarding Flow**

## **Step 1: Create Account**

* User signs up with email/password or OAuth
* Creates a tenant organization

## **Step 2: Connect Airtable**

Interface:
```
┌─────────────────────────────────────┐
│ Connect Your Airtable               │
├─────────────────────────────────────┤
│ Airtable API Key: [____________]    │
│ Base ID: [____________]             │
│ Table ID: [____________]            │
│                                     │
│ [Discover Schema] →                 │
└─────────────────────────────────────┘
```

Action:
* Validate credentials by fetching table metadata
* Store encrypted credentials
* Trigger schema discovery

## **Step 3: Review Discovered Fields**

Display all detected Airtable fields:

```
┌─────────────────────────────────────────────────────────┐
│ Discovered 12 fields from your Airtable                │
├─────────────────────────────────────────────────────────┤
│ Field Name          Type        Show in List?  Priority │
├─────────────────────────────────────────────────────────┤
│ Name                text        ✓              -        │
│ Email               email       ✓              -        │
│ Experience Level    select      ✓              [3]      │
│ Referral Source     text        ✓              [5]      │
│ Essay               longText    ✗              [2]      │
│ ...                                                     │
└─────────────────────────────────────────────────────────┘
```

## **Step 4: Configure Priority Scoring**

Visual formula builder:

```
┌─────────────────────────────────────────────┐
│ Priority Scoring Formula                    │
├─────────────────────────────────────────────┤
│ Experience Level    × [3]   = up to 15 pts  │
│ Referral Source     × [5]   = up to 25 pts  │
│ Fit Score           × [3]   = up to 15 pts  │
│ Essay Quality       × [2]   = up to 10 pts  │
│ Urgency             × [1]   = up to 5 pts   │
│ Red Flags           × [-3]  = penalty       │
│                                             │
│ Total Max Score: 70 points                  │
│                                             │
│ [Use Template] [Save Formula] →             │
└─────────────────────────────────────────────┘
```

## **Step 5: Configure Sync Settings**

```
┌─────────────────────────────────────────┐
│ Sync Settings                           │
├─────────────────────────────────────────┤
│ Pull from Airtable every: [5] minutes   │
│                                         │
│ Push changes to Airtable:               │
│ ☑ Status changes                        │
│ ☑ Tags                                  │
│ ☑ Notes                                 │
│                                         │
│ [Start Syncing] →                       │
└─────────────────────────────────────────┘
```

## **Step 6: Initial Sync**

* Perform first full sync from Airtable
* Display progress
* Redirect to queue view when complete

---

# **Performance Requirements**

### Database query performance:

* Queue load: < 100ms (per tenant)
* Application fetch: < 50ms
* Field mapping lookup: < 20ms (cached)
* Priority score calculation: < 10ms per record

### UI event performance:

* Status update: < 50ms (optimistic update)
* Navigation: < 30ms (prefetched)
* Field mapping UI: < 100ms

### Sync timing:

* Pull sync: every 1–5 minutes (configurable per tenant)
* Push sync: within 1–2 minutes
* Schema discovery: < 5 seconds
* Initial full sync: depends on record count (show progress)

### Scalability targets:

* Support 100+ concurrent tenants
* Handle 10,000+ applications per tenant
* Process 1,000+ records per sync
* Support tenant tables with 50+ custom fields

---

# **Deployment**

### Frontend/Backend:

* **Vercel** (Next.js)
  * Environment variables per environment
  * Automatic HTTPS
  * Edge functions for API routes

### Database:

* **Supabase** or **Neon** (Postgres)
  * Enable Row Level Security (RLS) for tenant isolation
  * Connection pooling (PgBouncer)
  * Automated backups
  * Read replicas for scale (optional)

### Authentication:

* **NextAuth.js** or **Clerk**
  * Session-based auth with tenant context
  * Support for multiple providers (email, Google, GitHub)

### Sync Workers:

* **Inngest** (recommended)
  * Per-tenant scheduled functions
  * Automatic retries and error handling
  * Monitoring and logs
  
* Alternative: **Supabase Edge Functions** or Vercel Cron hitting `/api/sync`

### Secrets Management:

* Vercel environment variables for:
  * Database connection string
  * Airtable API key encryption key
  * NextAuth secret
  * Inngest keys

### Monitoring:

* Vercel Analytics for frontend performance
* Sentry for error tracking
* Custom dashboard for sync status per tenant
* Database query performance monitoring

### Security:

* Encrypt Airtable API keys at rest (using crypto lib)
* Row-level security on all tables
* Rate limiting on API endpoints
* CORS configuration
* Input validation and sanitization

---

# **Additional Considerations**

## **Data Isolation**

* All queries MUST include `tenant_id` filter
* Use Postgres RLS policies to enforce tenant boundaries
* Never expose `tenant_id` in URLs (derive from session)

## **Tenant Limits** (Optional)

Consider implementing usage limits per tenant:
* Max applications: 10,000
* Max field mappings: 100
* Max sync frequency: 1 minute
* Max concurrent syncs: 5

## **Billing Integration** (Future)

If converting to SaaS:
* Stripe integration for subscriptions
* Usage tracking per tenant
* Feature gates based on plan tier

## **Multi-User Collaboration** (Future Enhancement)

* Multiple users per tenant via `tenant_users` table
* Role-based permissions (owner, admin, member, viewer)
* Activity log for accountability
* Real-time collaboration with WebSockets

## **Export/Import** (Future Enhancement)

* Export applications as CSV/JSON
* Bulk import from other sources
* Backup tenant data on demand

---

# **UI/UX Enhancements for Multi-Tenant**

## **Dynamic Form Rendering**

Based on `field_mappings`, render forms dynamically:

```typescript
// Example component structure
<ApplicationDetailView>
  {fieldMappings.map(field => (
    <DynamicField 
      key={field.id}
      type={field.airtable_field_type}
      label={field.display_name}
      value={application.custom_fields[field.airtable_field_name]}
    />
  ))}
</ApplicationDetailView>
```

## **Customizable List View**

Users configure which columns to show:

```
┌─────────────────────────────────────────────────────────────┐
│ Applications Queue                         [⚙ Configure]    │
├─────────────────────────────────────────────────────────────┤
│ Priority │ Name          │ Experience │ Referral │ Status   │
├─────────────────────────────────────────────────────────────┤
│ 95.5     │ John Doe      │ Senior     │ Friend   │ Pending  │
│ 87.3     │ Jane Smith    │ Mid        │ LinkedIn │ Pending  │
│ ...                                                          │
└─────────────────────────────────────────────────────────────┘
```

## **Tenant Settings Dashboard**

Accessible via `/settings`:

```
┌─────────────────────────────────────────────┐
│ Settings                                    │
├─────────────────────────────────────────────┤
│ > Airtable Connection                       │
│ > Field Mappings                            │
│ > Priority Scoring                          │
│ > Sync Settings                             │
│ > Team Members                              │
│ > Keyboard Shortcuts                        │
└─────────────────────────────────────────────┘
```

## **Real-time Sync Status**

Show sync status in UI header:

```
┌─────────────────────────────────────────────┐
│ LiteTable    🔄 Syncing...    [⚙]  [Profile]│
│                                             │
│ Last sync: 2 minutes ago                    │
│ Next sync: in 3 minutes                     │
└─────────────────────────────────────────────┘
```

## **Keyboard Shortcuts** (Unchanged from original spec)

All existing keyboard shortcuts work with dynamic fields:
* `j/k` - Navigate up/down
* `1-5` - Set status
* `t` - Add tag
* `n` - Add note
* `esc` - Return to queue

---

# **Implementation Phases (Updated)**

## **Phase 1: Foundation** (Week 1-2)
- [ ] Next.js 15 project setup
- [ ] Authentication (NextAuth/Clerk)
- [ ] Database schema and migrations
- [ ] Multi-tenant context provider

## **Phase 2: Airtable Integration** (Week 2-3)
- [ ] Airtable API client
- [ ] Schema discovery endpoint
- [ ] Pull sync worker (per tenant)
- [ ] Push sync queue processor

## **Phase 3: Tenant Onboarding** (Week 3-4)
- [ ] Tenant creation flow
- [ ] Airtable connection UI
- [ ] Field mapping configuration
- [ ] Priority scoring builder

## **Phase 4: Application Review UI** (Week 4-5)
- [ ] Queue view with dynamic columns
- [ ] Application detail view with dynamic fields
- [ ] Status update actions
- [ ] Notes and tags

## **Phase 5: Keyboard Shortcuts & Polish** (Week 5-6)
- [ ] Hotkey implementation
- [ ] Optimistic updates
- [ ] Loading states
- [ ] Error handling

## **Phase 6: Production Readiness** (Week 6-7)
- [ ] Performance optimization
- [ ] Security audit
- [ ] Monitoring setup
- [ ] Documentation

---

