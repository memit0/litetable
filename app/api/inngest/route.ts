import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { syncTenant, processOutboundQueue, scheduler } from "@/lib/inngest/functions";

// This API route serves as the entry point for Inngest to execute your background functions.
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [syncTenant, processOutboundQueue, scheduler],
});
