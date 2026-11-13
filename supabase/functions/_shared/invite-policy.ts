export type InviteRedemption =
  | { ok: true }
  | { ok: false; reason: "invalid_code" | "invite_required" };

/** Shared codes identify an offer; the server-side email invite grants access. */
export function redeemPaidInviteCode(code: string, invited: boolean): InviteRedemption {
  const normalized = code.replace(/[\s_-]+/g, "").toLowerCase();
  if (normalized !== "oslrbeta") return { ok: false, reason: "invalid_code" };
  if (!invited) return { ok: false, reason: "invite_required" };
  return { ok: true };
}
