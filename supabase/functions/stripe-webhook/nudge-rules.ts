export type PaymentStatus = { paid: boolean; trial: boolean; exempt: boolean };

/** Paid, pass-covered and exempt signups must never trigger an unpaid alert. */
export function shouldSendOwnerNudge(kind: string, status: PaymentStatus): boolean {
  if (kind === "owner_unpaid" || kind === "owner_unpaid_day") {
    return !status.paid && !status.trial && !status.exempt;
  }
  if (kind === "abandoned_cart") return !status.paid;
  return true;
}

/** Signup rows can precede workspace provisioning; recover it by the account email. */
export async function companyForNudge(
  nudge: { company_id?: string | null; email: string },
  lookup: (email: string) => Promise<string | null>,
): Promise<string | null> {
  return nudge.company_id ?? await lookup(nudge.email);
}
