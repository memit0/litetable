import { getTenant } from "@/app/actions/tenant";
import { SyncForm } from "./sync-form";

export default async function SyncPage() {
    const tenant = await getTenant();
    if (!tenant) return null;

    return (
        <div className="container mx-auto py-10 text-center max-w-md">
            <h1 className="text-2xl font-bold mb-6">Ready to Sync</h1>
            <p className="mb-6 text-muted-foreground">
                We'll start pulling data from Airtable every 5 minutes.
            </p>
            <SyncForm tenantId={tenant.id} />
        </div>
    )
}

