"use server";

import { getTenant } from "@/app/actions/tenant";
import { AirtableClient } from "@/lib/airtable";

export default async function TestAirtablePage() {
  const tenant = await getTenant();
  
  let result: any = {
    tenantFound: !!tenant,
    error: null,
    records: null,
    tableInfo: null,
  };

  if (tenant) {
    try {
      const airtable = new AirtableClient(
        tenant.airtableApiKeyEncrypted,
        tenant.airtableBaseId
      );
      
      // Try to fetch records
      const records = await airtable.fetchRecords(tenant.airtableTableId, {
        maxRecords: 5,
      });
      
      result.records = records.map((r: any) => ({
        id: r.id,
        fields: r.fields,
      }));
      result.tableInfo = {
        baseId: tenant.airtableBaseId,
        tableId: tenant.airtableTableId,
        recordCount: records.length,
      };
    } catch (error: any) {
      result.error = error.message;
    }
  }

  return (
    <div className="container mx-auto py-10">
      <h1 className="text-2xl font-bold mb-6">Test Airtable Connection</h1>
      
      <div className="space-y-4">
        {!result.tenantFound ? (
          <div className="border border-red-500 rounded-md p-4 bg-red-50">
            <p className="text-red-700">❌ No tenant found</p>
          </div>
        ) : result.error ? (
          <div className="border border-red-500 rounded-md p-4 bg-red-50">
            <p className="text-red-700 font-semibold">❌ Error connecting to Airtable:</p>
            <pre className="mt-2 text-sm text-red-600 whitespace-pre-wrap">
              {result.error}
            </pre>
          </div>
        ) : (
          <>
            <div className="border border-green-500 rounded-md p-4 bg-green-50">
              <p className="text-green-700 font-semibold">
                ✅ Successfully connected to Airtable!
              </p>
              <div className="mt-2 text-sm space-y-1">
                <p><strong>Base ID:</strong> {result.tableInfo.baseId}</p>
                <p><strong>Table ID:</strong> {result.tableInfo.tableId}</p>
                <p><strong>Records fetched:</strong> {result.tableInfo.recordCount}</p>
              </div>
            </div>
            
            <div className="border rounded-md p-4">
              <h2 className="text-lg font-semibold mb-2">Sample Records</h2>
              {result.records && result.records.length > 0 ? (
                <div className="space-y-4">
                  {result.records.map((record: any) => (
                    <div key={record.id} className="border rounded p-3 bg-gray-50">
                      <p className="text-sm font-mono mb-2">
                        <strong>ID:</strong> {record.id}
                      </p>
                      <details>
                        <summary className="cursor-pointer text-blue-600 text-sm">
                          View Fields
                        </summary>
                        <pre className="mt-2 text-xs bg-white p-2 rounded overflow-auto max-h-96">
                          {JSON.stringify(record.fields, null, 2)}
                        </pre>
                      </details>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">No records found</p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

