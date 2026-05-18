const ONESIGNAL_APP_ID = "d208ae10-4afe-4f51-9bd6-f07041c51fe6";

export async function sendNewEventNotification(params: {
  title: string;
  message: string;
  url?: string;
}) {
  try {
    const res = await fetch("https://onesignal.com/api/v1/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        app_id: ONESIGNAL_APP_ID,
        included_segments: ["All"],
        headings: { en: params.title },
        contents: { en: params.message },
        url: params.url,
      }),
    });
    if (!res.ok) {
      console.error("OneSignal API error", res.status, await res.text());
    }
  } catch (err) {
    console.error("OneSignal request failed", err);
  }
}
