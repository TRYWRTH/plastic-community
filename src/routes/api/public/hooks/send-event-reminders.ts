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

const DEFAULT_REMINDER_HOURS = 24;
// Window of ±1h around the user's preferred reminder offset; cron should run hourly.
const WINDOW_HOURS = 1;

export const Route = createFileRoute("/api/public/hooks/send-event-reminders")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = new URL(request.url);
        const origin = `${url.protocol}//${url.host}`;
        const now = Date.now();

        // Pull all candidate saves: future events, notify on, going/interested,
        // not yet reminded. We do the per-user-pref window filtering in JS.
        const horizonHours = 48 + WINDOW_HOURS;
        const horizonIso = new Date(now + horizonHours * 60 * 60 * 1000).toISOString();
        const nowIso = new Date(now).toISOString();

        const { data: saves, error: sErr } = await supabaseAdmin
          .from("event_saves")
          .select(
            "id, user_id, event_id, event:events(id, title, place, neighborhood, event_date)",
          )
          .eq("notify", true)
          .in("status", ["going", "interested"])
          .is("reminded_at", null);

        if (sErr) {
          console.error("saves query failed", sErr);
          return new Response(JSON.stringify({ error: sErr.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }

        const candidateSaves = (saves ?? []).filter((s) => {
          if (!s.event) return false;
          const t = new Date(s.event.event_date).getTime();
          return t > now && t <= now + horizonHours * 60 * 60 * 1000;
        });
        void horizonIso;
        void nowIso;

        if (candidateSaves.length === 0) {
          return new Response(
            JSON.stringify({ ok: true, notifications_sent: 0, checked: 0 }),
            { headers: { "Content-Type": "application/json" } },
          );
        }

        // Load reminder prefs for involved users.
        const userIds = Array.from(new Set(candidateSaves.map((s) => s.user_id)));
        const { data: prefs } = await supabaseAdmin
          .from("user_preferences")
          .select("user_id, reminder_hours")
          .in("user_id", userIds);
        const prefByUser = new Map<string, number>();
        for (const p of prefs ?? []) prefByUser.set(p.user_id, p.reminder_hours);

        // Filter saves where the time-until-event matches the user's pref ± window.
        const due = candidateSaves.filter((s) => {
          const hoursUntil = (new Date(s.event!.event_date).getTime() - now) / (60 * 60 * 1000);
          const pref = prefByUser.get(s.user_id) ?? DEFAULT_REMINDER_HOURS;
          return hoursUntil >= pref - WINDOW_HOURS && hoursUntil <= pref + WINDOW_HOURS;
        });

        if (due.length === 0) {
          return new Response(
            JSON.stringify({ ok: true, notifications_sent: 0, checked: candidateSaves.length }),
            { headers: { "Content-Type": "application/json" } },
          );
        }

        // Load player IDs for the due users.
        const dueUserIds = Array.from(new Set(due.map((s) => s.user_id)));
        const { data: subs, error: pErr } = await supabaseAdmin
          .from("user_push_subscriptions")
          .select("user_id, onesignal_player_id")
          .in("user_id", dueUserIds);
        if (pErr) {
          console.error("subs query failed", pErr);
          return new Response(JSON.stringify({ error: pErr.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
        const playersByUser = new Map<string, string[]>();
        for (const r of subs ?? []) {
          if (!r.onesignal_player_id) continue;
          const arr = playersByUser.get(r.user_id) ?? [];
          arr.push(r.onesignal_player_id);
          playersByUser.set(r.user_id, arr);
        }

        let totalSent = 0;
        const sentSaveIds: string[] = [];
        for (const s of due) {
          const players = playersByUser.get(s.user_id) ?? [];
          const ev = s.event!;
          const pref = prefByUser.get(s.user_id) ?? DEFAULT_REMINDER_HOURS;
          const when = pref >= 24 ? `in ${Math.round(pref / 24)} day(s)` : `in ${pref} hours`;
          const title = "Upcoming event reminder";
          const message = `${ev.title} is ${when} — ${ev.place}, ${ev.neighborhood}`;
          const eventUrl = `${origin}/event/${ev.id}`;
          if (players.length > 0) {
            await sendOneSignal(players, title, message, eventUrl);
            totalSent += players.length;
          }
          sentSaveIds.push(s.id);
        }

        if (sentSaveIds.length > 0) {
          const { error: uErr } = await supabaseAdmin
            .from("event_saves")
            .update({ reminded_at: new Date().toISOString() })
            .in("id", sentSaveIds);
          if (uErr) console.error("failed to mark reminded_at", uErr);
        }

        return new Response(
          JSON.stringify({
            ok: true,
            checked: candidateSaves.length,
            due: due.length,
            notifications_sent: totalSent,
          }),
          { headers: { "Content-Type": "application/json" } },
        );
      },
    },
  },
});
