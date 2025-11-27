import { getTenant } from "@/app/actions/tenant";

export default async function AirtableInfoPage() {
  const tenant = await getTenant();

  if (!tenant) {
    return <div className="container mx-auto py-10">No tenant found</div>;
  }

  return (
    <div className="container mx-auto py-10">
      <h1 className="text-2xl font-bold mb-6">Airtable Connection Info</h1>
      
      <div className="border rounded-md p-4">
        <div className="space-y-2 text-sm font-mono">
          <p><strong>Base ID:</strong> {tenant.airtableBaseId}</p>
          <p><strong>Table ID:</strong> {tenant.airtableTableId}</p>
          <p><strong>API Key:</strong> {tenant.airtableApiKeyEncrypted.substring(0, 10)}...</p>
        </div>
      </div>
    </div>
  );
}

