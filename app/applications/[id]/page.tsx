import { getApplication } from "@/app/actions/applications";
import { getTenant, getFieldMappings } from "@/app/actions/tenant";
import { redirect } from "next/navigation";
import { ApplicationDetail } from "@/components/application/detail-view";

export default async function ApplicationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const tenant = await getTenant();
  if (!tenant) redirect("/onboarding/connect");

  const application = await getApplication(id);
  if (!application) redirect("/applications");

  const mappings = await getFieldMappings(tenant.id);

  return (
    <ApplicationDetail 
        application={application} 
        mappings={mappings} 
        tenantId={tenant.id} 
    />
  );
}

