import { getTenant, getFieldMappings, getPriorityConfig } from "@/app/actions/tenant";
import { redirect } from "next/navigation";
import { ScoringForm } from "./scoring-form";

export default async function ScoringPage() {
  const tenant = await getTenant();
  if (!tenant) {
    redirect("/onboarding/connect");
  }

  const mappings = await getFieldMappings(tenant.id);
  const config = await getPriorityConfig(tenant.id);

  return (
    <div className="container mx-auto py-10">
      <h1 className="text-2xl font-bold mb-6">Configure Priority Scoring</h1>
      <ScoringForm mappings={mappings} initialConfig={config?.scoringFormula} tenantId={tenant.id} />
    </div>
  );
}

