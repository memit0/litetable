import { getTenant } from "@/app/actions/tenant";
import { Button } from "@/components/ui/button";
import { inngest } from "@/lib/inngest/client";

export default async function TestSyncPage() {
  const tenant = await getTenant();

  async function triggerSync() {
    "use server";
    const tenant = await getTenant();
    if (!tenant) {
      console.log("[TestSync] No tenant found");
      return { error: "No tenant found" };
    }

    console.log("[TestSync] Manually triggering sync for tenant:", tenant.id);
    
    try {
      const result = await inngest.send({
        name: "app/sync.tenant",
        data: { tenantId: tenant.id },
      });
      console.log("[TestSync] Event sent, result:", result);
      return { success: true, result };
    } catch (error) {
      console.error("[TestSync] Error sending event:", error);
      return { error: String(error) };
    }
  }

  return (
    <div className="container mx-auto py-10">
      <h1 className="text-2xl font-bold mb-6">Test Sync</h1>
      
      <div className="space-y-4">
        <div className="border rounded-md p-4">
          <h2 className="font-semibold mb-2">Current Tenant</h2>
          {tenant ? (
            <div className="text-sm space-y-1">
              <p><strong>ID:</strong> {tenant.id}</p>
              <p><strong>Name:</strong> {tenant.name}</p>
              <p><strong>Sync Enabled:</strong> {tenant.syncEnabled ? "Yes" : "No"}</p>
              <p><strong>Base ID:</strong> {tenant.airtableBaseId}</p>
              <p><strong>Table ID:</strong> {tenant.airtableTableId}</p>
            </div>
          ) : (
            <p className="text-muted-foreground">No tenant found</p>
          )}
        </div>

        <form action={triggerSync}>
          <Button type="submit" size="lg">
            Manually Trigger Sync
          </Button>
        </form>

        <div className="border rounded-md p-4 bg-muted">
          <h3 className="font-semibold mb-2">Instructions:</h3>
          <ol className="text-sm space-y-1 list-decimal list-inside">
            <li>Make sure Inngest dev server is running: <code>npx inngest-cli@latest dev</code></li>
            <li>Click the button above to trigger a sync</li>
            <li>Check your terminal for <code>[TestSync]</code> and <code>[syncTenant]</code> logs</li>
            <li>Check Inngest dashboard at <a href="http://localhost:8288" target="_blank" className="text-blue-600 underline">http://localhost:8288</a></li>
            <li>Go to <a href="/debug" className="text-blue-600 underline">/debug</a> to see if data was synced</li>
          </ol>
        </div>
      </div>
    </div>
  );
}

