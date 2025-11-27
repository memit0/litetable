import { getQueue } from "@/app/actions/applications";
import { getTenant, getFieldMappings } from "@/app/actions/tenant";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function ApplicationsPage({
  searchParams,
}: {
  searchParams: { page?: string };
}) {
  const tenant = await getTenant();
  if (!tenant) redirect("/onboarding/connect");

  const page = Number(searchParams?.page) || 1;
  const applications = await getQueue(tenant.id, page);
  const mappings = await getFieldMappings(tenant.id);

  // Filter mappings for list view
  const listFields = mappings.filter((m) => m.isVisibleInList);

  return (
    <div className="container mx-auto py-10">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Review Queue</h1>
        <div className="text-sm text-muted-foreground">
          Sync Status: {tenant.lastSyncAt ? `Last synced ${new Date(tenant.lastSyncAt).toLocaleTimeString()}` : "Never synced"}
        </div>
      </div>

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[100px]">Status</TableHead>
              <TableHead className="w-[100px]">Score</TableHead>
              {listFields.map((field) => (
                <TableHead key={field.id}>{field.displayName}</TableHead>
              ))}
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {applications.map((app) => (
              <TableRow key={app.id}>
                <TableCell>
                  <Badge
                    variant={
                      app.status === "accepted"
                        ? "default" // "success" not standard in shadcn default
                        : app.status === "rejected"
                        ? "destructive"
                        : "secondary"
                    }
                  >
                    {app.status}
                  </Badge>
                </TableCell>
                <TableCell>{app.priorityScore}</TableCell>
                {listFields.map((field) => {
                    // keyFields or customFields
                    // Ideally keyFields has it if isVisibleInList=true
                    const val = (app.keyFields as any)?.[field.airtableFieldName] ?? (app.customFields as any)?.[field.airtableFieldName];
                    return (
                        <TableCell key={field.id}>
                           {typeof val === 'object' ? JSON.stringify(val) : String(val || "")}
                        </TableCell>
                    );
                })}
                <TableCell className="text-right">
                  <Link href={`/applications/${app.id}`}>
                    <Button variant="outline" size="sm">
                      Review
                    </Button>
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      
      {/* Pagination controls would go here */}
    </div>
  );
}

