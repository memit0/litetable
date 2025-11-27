import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { syncTenant, processOutboundQueue, scheduler } from "@/lib/inngest/functions";

export const { GET, POST } = serve({
  client: inngest,
  functions: [syncTenant, processOutboundQueue, scheduler],
});

