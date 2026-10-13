import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export type ContactKind = "work_email" | "personal_email" | "phone";
export const CONTACT_PRICES: Record<ContactKind, number> = { work_email: 2, personal_email: 3, phone: 5 };

export interface ContactState {
  contact: { work_email?: string | null; personal_emails?: string[]; phone_numbers?: string[] };
  checked: Partial<Record<ContactKind, string>>;
  balance: number | null;
}

const EMPTY: ContactState = { contact: {}, checked: {}, balance: null };

export async function enrichContact(linkedinUrl: string, kinds: ContactKind[], candidateName?: string) {
  const { data, error } = await supabase.functions.invoke("search-people", {
    body: { action: "enrich_contact", linkedin_url: linkedinUrl, kinds, candidate_name: candidateName },
  });
  // 402 comes back as an error with the body in context
  let payload = data as Record<string, unknown> | null;
  if (error) {
    try {
      payload = await (error as { context?: Response }).context?.json();
    } catch { /* ignore */ }
    if (!payload) throw error;
  }
  return payload as unknown as ContactState & { charged?: number; found?: ContactKind[]; error?: string; needed?: number };
}

export function useContactEnrich(linkedinUrl: string | null | undefined, candidateName?: string, savedContactId?: string | null, onAutoSave?: (c: { email: string | null; phone: string | null }) => Promise<void> | void) {
  const [state, setState] = useState<ContactState>(EMPTY);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setState(EMPTY);
    if (!linkedinUrl) return;
    let cancelled = false;
    enrichContact(linkedinUrl, [])
      .then((r) => { if (!cancelled && r && !r.error) setState({ contact: r.contact ?? {}, checked: r.checked ?? {}, balance: r.balance ?? null }); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [linkedinUrl]);

  const run = useCallback(async (kinds: ContactKind[]) => {
    if (!linkedinUrl || !kinds.length) return;
    setBusy(true);
    try {
      const r = await enrichContact(linkedinUrl, kinds, candidateName);
      setState({ contact: r.contact ?? {}, checked: r.checked ?? {}, balance: r.balance ?? null });
      if (r.error === "insufficient_credits") {
        toast.error(`Not enough credits. This needs up to ${r.needed} credits.`);
      } else if (r.error) {
        toast.error(r.error);
      } else if (r.found?.length) {
        toast.success(`Contact info found · ${r.charged} credits used`);
        if (savedContactId) {
          const email = r.contact.work_email || r.contact.personal_emails?.[0] || null;
          const phone = r.contact.phone_numbers?.[0] || null;
          const patch: Record<string, unknown> = {};
          if (email) patch.email = email;
          if (phone) patch.phone = phone;
          if (Object.keys(patch).length) await supabase.from("candidates").update(patch).eq("id", savedContactId);
        } else if (onAutoSave) {
          await onAutoSave({
            email: r.contact.work_email || r.contact.personal_emails?.[0] || null,
            phone: r.contact.phone_numbers?.[0] || null,
          });
        }
      } else {
        const onlyEmail = kinds.every((k) => k !== "phone");
        toast(onlyEmail
          ? "No email was found. You will not be charged."
          : "No email or no contact information was found. You will not be charged.");
      }
      window.dispatchEvent(new Event("oslr:credits"));
    } catch {
      toast.error("Contact lookup failed. Try again shortly.");
    } finally {
      setBusy(false);
    }
  }, [linkedinUrl, candidateName, savedContactId, onAutoSave]);

  return { state, busy, run };
}

export function useCreditBalance(companyId: string | null | undefined) {
  const [balance, setBalance] = useState<number | null>(null);
  useEffect(() => {
    if (!companyId) return;
    const load = () =>
      supabase.from("credit_balances").select("balance").eq("company_id", companyId).maybeSingle()
        .then(({ data }) => setBalance((data?.balance as number | undefined) ?? 0));
    void load();
    const h = () => void load();
    window.addEventListener("oslr:credits", h);
    return () => window.removeEventListener("oslr:credits", h);
  }, [companyId]);
  return balance;
}
