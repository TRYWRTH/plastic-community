const ONESIGNAL_APP_ID = "d208ae10-4afe-4f51-9bd6-f07041c51fe6";

type BasePayload = {
  title: string;
  message: string;
  url?: string;
};

async function send(body: Record<string, unknown>) {
  try {
    const res = await fetch("https://onesignal.com/api/v1/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ app_id: ONESIGNAL_APP_ID, ...body }),
    });
    if (!res.ok) {
      console.error("OneSignal API error", res.status, await res.text());
    }
  } catch (err) {
    console.error("OneSignal request failed", err);
  }
}

export async function sendNewEventNotification(params: BasePayload) {
  await send({
    included_segments: ["All"],
    headings: { en: params.title },
    contents: { en: params.message },
    url: params.url,
  });
}

export async function sendEventUpdateNotification(
  params: BasePayload & { externalUserIds: string[] },
) {
  if (params.externalUserIds.length === 0) return;
  await send({
    include_aliases: { external_id: params.externalUserIds },
    target_channel: "push",
    headings: { en: params.title },
    contents: { en: params.message },
    url: params.url,
  });
}
