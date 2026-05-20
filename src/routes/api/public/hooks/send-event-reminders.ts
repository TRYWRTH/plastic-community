import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const ONESIGNAL_APP_ID = "d208ae10-4afe-4f51-9bd6-f07041c51fe6";

async function sendOneSignal(playerIds: string[], title: string, message: string, url: string) {
  if (playerIds.length === 0) return;
  const restKey = process.env.ONESIGNAL_REST_API_KEY;
  if (!restKey) {
    console.error("ONESIGNAL_REST_API_KEY missing");
    return;
  }
  const res = await fetch("https://onesignal.com/api/v1/notifications", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${restKey}`,
    },
    body: JSON.stringify({
      app_id: ONESIGNAL_APP_ID,
      include_player_ids: playerIds,
      headings: { en: title },
      contents: { en: message },
      url,
    }),
  });
  if (!res.ok) {
    console.error("OneSignal API error", res.status, await res.text());
  }
}

export const Route = createFileRoute("/api/public/hooks/send-event-reminders")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = new URL(request.url);
        const origin = `${url.protocol}//${url.host}`;

        // Find events between 23h and 25h from now (~24h reminder window).
        const now = new Date();
        const from = new Date(now.getTime() + 23 * 60 * 60 * 1000).toISOString();
        const to = new Date(now.getTime() + 25 * 60 * 60 * 1000).toISOString();

        const { data: events, error: evErr } = await supabaseAdmin
          .from("events")
          .select("id, title, place, neighborhood, event_date")
          .gte("event_date", from)
          .lte("event_date", to);

        if (evErr) {
          console.error("events query failed", evErr);
          return new Response(JSON.stringify({ error: evErr.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }

        let totalSent = 0;
        const results: Array<{ event_id: string; recipients: number }> = [];

        for (const ev of events ?? []) {
          const { data: saves, error: sErr } = await supabaseAdmin
            .from("event_saves")
            .select("user_id")
            .eq("event_id", ev.id)
            .eq("notify", true)
            .in("status", ["going", "interested"]);
          if (sErr) {
            console.error("saves query failed", sErr);
            continue;
          }
          const userIds = (saves ?? []).map((s) => s.user_id);
          if (userIds.length === 0) {
            results.push({ event_id: ev.id, recipients: 0 });
            continue;
          }

          const { data: subs, error: pErr } = await supabaseAdmin
            .from("user_push_subscriptions")
            .select("onesignal_player_id")
            .in("user_id", userIds);
          if (pErr) {
            console.error("subs query failed", pErr);
            continue;
          }
          const playerIds = Array.from(
            new Set((subs ?? []).map((r) => r.onesignal_player_id).filter(Boolean)),
          );
          if (playerIds.length === 0) {
            results.push({ event_id: ev.id, recipients: 0 });
            continue;
          }

          const title = "Event tomorrow";
          const message = `${ev.title} is tomorrow — ${ev.place}, ${ev.neighborhood}`;
          const eventUrl = `${origin}/event/${ev.id}`;
          await sendOneSignal(playerIds, title, message, eventUrl);
          totalSent += playerIds.length;
          results.push({ event_id: ev.id, recipients: playerIds.length });
        }

        return new Response(
          JSON.stringify({
            ok: true,
            events_checked: events?.length ?? 0,
            notifications_sent: totalSent,
            results,
          }),
          { headers: { "Content-Type": "application/json" } },
        );
      },
    },
  },
});
