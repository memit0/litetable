import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { syncTenant, processOutboundQueue, scheduler } from "@/lib/inngest/functions";

// This API route serves as the entry point for Inngest to execute your background functions.
// When Inngest needs to run a job (like a scheduled sync or an event-triggered task),
// it makes a POST request to this endpoint.
const handlers = serve({
  client: inngest,
  functions: [syncTenant, processOutboundQueue, scheduler],
  // Add logging to see when Inngest calls this endpoint
  onFunctionError: ({ error, step, functionId, event }) => {
    console.error("[Inngest API] Function error:", {
      functionId,
      step,
      error: error.message,
      event: event?.name,
    });
  },
});

// Wrap handlers with logging
export async function GET(request: Request) {
  console.log("[Inngest API] GET request received from:", request.headers.get("user-agent"));
  return handlers.GET(request);
}

export async function POST(request: Request) {
  console.log("[Inngest API] POST request received");
  const body = await request.clone().text();
  console.log("[Inngest API] POST body:", body.substring(0, 500)); // Log first 500 chars
  return handlers.POST(request);
}

