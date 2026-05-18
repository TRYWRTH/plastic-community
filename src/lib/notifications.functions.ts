import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const notifySchema = z.object({
  title: z.string().min(1).max(120),
  message: z.string().min(1).max(500),
  url: z.string().url().optional(),
});

export const sendNewEventNotification = createServerFn({ method: "POST" })
  .inputValidator((input) => notifySchema.parse(input))
  .handler(async ({ data }) => {
    const appId = "d208ae10-4afe-4f51-9bd6-f07041c51fe6";
    const apiKey = process.env.ONESIGNAL_REST_API_KEY;
    if (!apiKey) {
      console.error("ONESIGNAL_REST_API_KEY not configured");
      return { ok: false, error: "missing_key" as const };
    }

    try {
      const res = await fetch("https://api.onesignal.com/notifications", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Key ${apiKey}`,
        },
        body: JSON.stringify({
          app_id: appId,
          included_segments: ["Total Subscriptions"],
          headings: { en: data.title },
          contents: { en: data.message },
          url: data.url,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        console.error("OneSignal API error", res.status, text);
        return { ok: false, error: "api_error" as const };
      }

      return { ok: true as const };
    } catch (err) {
      console.error("OneSignal request failed", err);
      return { ok: false, error: "request_failed" as const };
    }
  });
