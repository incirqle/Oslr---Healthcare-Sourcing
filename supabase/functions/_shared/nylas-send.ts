// Shared Nylas v3 send helper. Used by send-campaign.
import { nylasFetch } from "./nylas.ts";

export interface NylasSendArgs {
  grantId: string;
  to: { email: string; name?: string }[];
  subject: string;
  html: string;
  replyTo?: { email: string; name?: string }[];
  replyToMessageId?: string;
  trackingLabel?: string;
  listUnsubscribe?: string;       // e.g. "<mailto:unsub@x.com>, <https://.../unsubscribe?t=...>"
  listUnsubscribePost?: boolean;  // omit for Microsoft / iCloud
  customHeaders?: { name: string; value: string }[];
}

export interface NylasSendResult {
  message_id: string;
  thread_id?: string;
}

const MAX_ATTEMPTS = 3;

export async function sendViaNylas(args: NylasSendArgs): Promise<NylasSendResult> {
  const headers: { name: string; value: string }[] = [...(args.customHeaders ?? [])];
  if (args.listUnsubscribe) {
    headers.push({ name: "List-Unsubscribe", value: args.listUnsubscribe });
    if (args.listUnsubscribePost) {
      headers.push({
        name: "List-Unsubscribe-Post",
        value: "List-Unsubscribe=One-Click",
      });
    }
  }

  const body: Record<string, unknown> = {
    to: args.to,
    subject: args.subject,
    body: args.html,
    tracking_options: {
      opens: true,
      links: true,
      thread_replies: true,
      ...(args.trackingLabel ? { label: args.trackingLabel } : {}),
    },
  };
  if (args.replyTo) body.reply_to = args.replyTo;
  if (args.replyToMessageId) body.reply_to_message_id = args.replyToMessageId;
  if (headers.length) body.custom_headers = headers;

  let lastErr: string | undefined;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 150_000);
    let res: Response;
    try {
      res = await nylasFetch(`/v3/grants/${args.grantId}/messages/send`, {
        method: "POST",
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });
    } catch (e) {
      lastErr = `network error: ${(e as Error).message}`;
      clearTimeout(timer);
      if (attempt < MAX_ATTEMPTS) {
        await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
        continue;
      }
      throw new Error(lastErr);
    }
    clearTimeout(timer);

    if (res.ok) {
      const json = await res.json();
      const data = json?.data ?? json;
      return { message_id: data.id, thread_id: data.thread_id };
    }

    const text = await res.text();
    lastErr = `Nylas ${res.status}: ${text}`;

    // 503/429 → backoff and retry. Other errors → fail fast.
    if ((res.status === 503 || res.status === 429) && attempt < MAX_ATTEMPTS) {
      await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
      continue;
    }
    throw new Error(lastErr);
  }
  throw new Error(lastErr ?? "Nylas send failed");
}
