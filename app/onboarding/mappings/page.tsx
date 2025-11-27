import { getTenant, getFieldMappings } from "@/app/actions/tenant";
import { redirect } from "next/navigation";
import { MappingsForm } from "./mappings-form";

export default async function MappingsPage() {
  const tenant = await getTenant();
  if (!tenant) {
    redirect("/onboarding/connect");
  }

  const mappings = await getFieldMappings(tenant.id);

  return (
    <div className="container mx-auto py-10">
      <h1 className="text-2xl font-bold mb-6">Configure Field Mappings</h1>
      <MappingsForm mappings={mappings} />
    </div>
  );
}

