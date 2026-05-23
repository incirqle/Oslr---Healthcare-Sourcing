// Shared Nylas v3 helpers + state signing.
// Used by nylas-auth-start, nylas-oauth-callback, nylas-disconnect, nylas-webhook.

export const NYLAS_API_URI =
  Deno.env.get("NYLAS_API_URI") ?? "https://api.us.nylas.com";

export function getEnv(name: string): string {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`${name} is not configured`);
  return v;
}

export function projectRef(): string {
  // SUPABASE_URL is always injected into edge functions
  const url = getEnv("SUPABASE_URL");
  const host = new URL(url).host; // <ref>.supabase.co
  return host.split(".")[0];
}

export function callbackUrl(): string {
  return `https://${projectRef()}.supabase.co/functions/v1/nylas-oauth-callback`;
}

export function appOrigin(req: Request): string {
  // Prefer the request origin (handles preview vs prod) and fall back to oslr.health.
  const ref = req.headers.get("referer");
  if (ref) {
    try {
      const u = new URL(ref);
      return `${u.protocol}//${u.host}`;
    } catch (_) { /* ignore */ }
  }
  return "https://oslr.health";
}

// ---------- HMAC-signed state (carries user_id + nonce + return origin) ----------

const enc = new TextEncoder();
const dec = new TextDecoder();

function b64urlEncode(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function b64urlDecode(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const b64 = (s + pad).replaceAll("-", "+").replaceAll("_", "/");
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function hmac(key: string, payload: string): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(payload));
  return b64urlEncode(new Uint8Array(sig));
}

export interface OAuthState {
  user_id: string;
  origin: string;
  ts: number;
}

export async function signState(state: OAuthState): Promise<string> {
  const key = getEnv("NYLAS_API_KEY"); // re-used as HMAC secret
  const payload = b64urlEncode(enc.encode(JSON.stringify(state)));
  const sig = await hmac(key, payload);
  return `${payload}.${sig}`;
}

export async function verifyState(token: string): Promise<OAuthState> {
  const key = getEnv("NYLAS_API_KEY");
  const [payload, sig] = token.split(".");
  if (!payload || !sig) throw new Error("Malformed state");
  const expected = await hmac(key, payload);
  if (expected !== sig) throw new Error("Invalid state signature");
  const data = JSON.parse(dec.decode(b64urlDecode(payload))) as OAuthState;
  if (Date.now() - data.ts > 30 * 60 * 1000) throw new Error("State expired");
  return data;
}

// ---------- Nylas REST helper ----------

export async function nylasFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const apiKey = getEnv("NYLAS_API_KEY");
  const url = `${NYLAS_API_URI}${path}`;
  return await fetch(url, {
    ...init,
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Accept": "application/json",
      ...(init.headers ?? {}),
    },
  });
}

// ---------- Provider scope presets ----------

export const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
  "openid",
];

export const MICROSOFT_SCOPES = [
  "https://graph.microsoft.com/Mail.ReadWrite",
  "https://graph.microsoft.com/Mail.Send",
  "https://graph.microsoft.com/User.Read",
  "offline_access",
];

export function scopesFor(provider: string): string[] {
  if (provider === "google") return GOOGLE_SCOPES;
  if (provider === "microsoft") return MICROSOFT_SCOPES;
  throw new Error(`Unsupported provider: ${provider}`);
}
