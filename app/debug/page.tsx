import { db } from "@/db";
import { applications, syncLogs, tenants } from "@/db/schema";
import { sql, desc } from "drizzle-orm";
import { getTenant } from "@/app/actions/tenant";

export default async function DebugPage() {
  const tenant = await getTenant();
  
  // Get total count
  const [countResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(applications);
  const totalCount = countResult?.count || 0;

  // Get sample records
  const records = await db
    .select()
    .from(applications)
    .orderBy(desc(applications.createdAt))
    .limit(10);

  // Get sync logs
  const logs = tenant
    ? await db
        .select()
        .from(syncLogs)
        .where(sql`${syncLogs.tenantId} = ${tenant.id}`)
        .orderBy(desc(syncLogs.startedAt))
        .limit(5)
    : [];

  // Search for specific names
  const searchNames = ["Aisha Patel", "Miguel Torres", "Emily Chen"];
  const foundRecords = records.filter((record) => {
    const customFields = JSON.stringify(record.customFields || {});
    const keyFields = JSON.stringify(record.keyFields || {});
    const allFields = customFields + keyFields;
    return searchNames.some((name) => allFields.includes(name));
  });

  return (
    <div className="container mx-auto py-10">
      <h1 className="text-2xl font-bold mb-6">Database Debug Info</h1>

      <div className="space-y-6">
        {/* Tenant Info */}
        <div className="border rounded-md p-4">
          <h2 className="text-lg font-semibold mb-2">Tenant Info</h2>
          {tenant ? (
            <div className="space-y-1 text-sm">
              <p>ID: {tenant.id}</p>
              <p>Name: {tenant.name}</p>
              <p>Sync Enabled: {tenant.syncEnabled ? "Yes" : "No"}</p>
              <p>
                Last Sync:{" "}
                {tenant.lastSyncAt
                  ? new Date(tenant.lastSyncAt).toLocaleString()
                  : "Never"}
              </p>
            </div>
          ) : (
            <p className="text-muted-foreground">No tenant found</p>
          )}
        </div>

        {/* Application Count */}
        <div className="border rounded-md p-4">
          <h2 className="text-lg font-semibold mb-2">Applications</h2>
          <p className="text-2xl font-bold">{totalCount}</p>
          <p className="text-sm text-muted-foreground">
            Total records in database
          </p>
        </div>

        {/* Sync Logs */}
        {tenant && (
          <div className="border rounded-md p-4">
            <h2 className="text-lg font-semibold mb-2">Recent Sync Logs</h2>
            {logs.length > 0 ? (
              <div className="space-y-2">
                {logs.map((log) => (
                  <div key={log.id} className="text-sm border-l-2 pl-2">
                    <p>
                      <strong>Status:</strong> {log.status} |{" "}
                      <strong>Type:</strong> {log.syncType}
                    </p>
                    <p>
                      <strong>Records:</strong> {log.recordsProcessed || 0} |{" "}
                      <strong>Failed:</strong> {log.recordsFailed || 0}
                    </p>
                    <p>
                      <strong>Started:</strong>{" "}
                      {new Date(log.startedAt).toLocaleString()}
                    </p>
                    {log.completedAt && (
                      <p>
                        <strong>Completed:</strong>{" "}
                        {new Date(log.completedAt).toLocaleString()}
                      </p>
                    )}
                    {log.errorMessage && (
                      <p className="text-red-600">
                        <strong>Error:</strong> {log.errorMessage}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground">No sync logs found</p>
            )}
          </div>
        )}

        {/* Sample Records */}
        <div className="border rounded-md p-4">
          <h2 className="text-lg font-semibold mb-2">Sample Records (Latest 10)</h2>
          {records.length > 0 ? (
            <div className="space-y-4">
              {records.map((record) => (
                <div key={record.id} className="border rounded p-3 text-sm">
                  <p>
                    <strong>ID:</strong> {record.id}
                  </p>
                  <p>
                    <strong>Airtable Record ID:</strong> {record.airtableRecordId}
                  </p>
                  <p>
                    <strong>Status:</strong> {record.status}
                  </p>
                  <p>
                    <strong>Priority Score:</strong> {record.priorityScore || "N/A"}
                  </p>
                  <details className="mt-2">
                    <summary className="cursor-pointer text-blue-600">
                      View Custom Fields
                    </summary>
                    <pre className="mt-2 text-xs bg-gray-100 p-2 rounded overflow-auto">
                      {JSON.stringify(record.customFields, null, 2)}
                    </pre>
                  </details>
                  <details className="mt-2">
                    <summary className="cursor-pointer text-blue-600">
                      View Key Fields
                    </summary>
                    <pre className="mt-2 text-xs bg-gray-100 p-2 rounded overflow-auto">
                      {JSON.stringify(record.keyFields, null, 2)}
                    </pre>
                  </details>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground">No records found</p>
          )}
        </div>

        {/* Search Results */}
        <div className="border rounded-md p-4">
          <h2 className="text-lg font-semibold mb-2">
            Search Results (Aisha Patel, Miguel Torres, Emily Chen)
          </h2>
          {foundRecords.length > 0 ? (
            <div className="space-y-2">
              {foundRecords.map((record) => (
                <div key={record.id} className="text-sm border-l-2 pl-2">
                  <p>
                    <strong>Found in record:</strong> {record.id}
                  </p>
                  <pre className="mt-1 text-xs bg-gray-100 p-2 rounded overflow-auto">
                    {JSON.stringify(
                      { ...record.customFields, ...record.keyFields },
                      null,
                      2
                    )}
                  </pre>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground">
              No records found with those names
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

