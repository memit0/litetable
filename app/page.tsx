import { auth } from "@/auth";
import { getTenant } from "@/app/actions/tenant";
import { redirect } from "next/navigation";

export default async function Home() {
  const session = await auth();
  
  if (!session?.user) {
    redirect("/api/auth/signin");
  }

  const tenant = await getTenant();
  
  if (!tenant) {
    redirect("/onboarding/connect");
  }

  redirect("/applications");
}
