import { useState } from "react";
import { Check, Copy, Loader2, Mail, Phone, Briefcase, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ContactKind, ContactState } from "@/hooks/useContactEnrich";
import { CONTACT_PRICES } from "@/hooks/useContactEnrich";

const OPTIONS: { kind: ContactKind; label: string; icon: typeof Mail }[] = [
  { kind: "work_email", label: "Work email", icon: Briefcase },
  { kind: "personal_email", label: "Personal email", icon: Mail },
  { kind: "phone", label: "Mobile phone", icon: Phone },
];

interface Props {
  state: ContactState;
  busy: boolean;
  onEnrich: (kinds: ContactKind[]) => void;
  onCopy: (value: string, label: string) => void;
  /** Contact info already on the saved record (shown only if not duplicated). */
  fallbackEmail?: string | null;
  fallbackPhone?: string | null;
}

function valueFor(state: ContactState, k: ContactKind): string | null {
  const c = state.contact;
  if (k === "work_email") return c.work_email || null;
  // One personal email only — the best one. Extra addresses add noise, not value.
  if (k === "personal_email") return c.personal_emails?.find((e) => e && e.toLowerCase() !== c.work_email?.toLowerCase()) || null;
  return c.phone_numbers?.[0] || null;
}

export function ContactEnrichPanel({ state, busy, onEnrich, onCopy, fallbackEmail, fallbackPhone }: Props) {
  const [picked, setPicked] = useState<ContactKind[]>(["work_email"]);
  const [copied, setCopied] = useState<string | null>(null);

  const rows = OPTIONS.map((o) => {
    const value = valueFor(state, o.kind);
    const status = value ? "found" : state.checked[o.kind] ? "missing" : "available";
    return { ...o, value, status } as const;
  });
  const available = rows.filter((r) => r.status === "available");
  const chosen = picked.filter((k) => available.some((r) => r.kind === k));
  const maxCost = chosen.reduce((s, k) => s + CONTACT_PRICES[k], 0);

  const shown = new Set(rows.map((r) => r.value?.toLowerCase().replace(/\D/g, "") || r.value?.toLowerCase()).filter(Boolean));
  const extras = [
    fallbackEmail && !rows.some((r) => r.value?.toLowerCase() === fallbackEmail.toLowerCase())
      ? { label: "Saved email", value: fallbackEmail, href: `mailto:${fallbackEmail}`, icon: Mail } : null,
    fallbackPhone && !rows.some((r) => r.value && r.value.replace(/\D/g, "") === fallbackPhone.replace(/\D/g, ""))
      ? { label: "Saved phone", value: fallbackPhone, href: `tel:${fallbackPhone}`, icon: Phone } : null,
  ].filter(Boolean) as { label: string; value: string; href: string; icon: typeof Mail }[];
  void shown;

  const copy = (value: string, label: string) => {
    onCopy(value, label);
    setCopied(value);
    window.setTimeout(() => setCopied((c) => (c === value ? null : c)), 1400);
  };

  const toggle = (k: ContactKind) =>
    setPicked((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...p, k]));

  return (
    <section className="space-y-3">
      <header className="flex items-end justify-between px-1">
        <div>
          <h3 className="text-[17px] font-semibold tracking-[-0.01em] text-ui-text-primary">Contact</h3>
          <p className="text-[13px] text-ui-text-muted">Charged only when we find it. Saved forever.</p>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-[12px] font-medium tabular-nums text-primary">
          <Zap className="h-3 w-3" />
          {state.balance ?? "-"} credits
        </span>
      </header>

      <div className="overflow-hidden rounded-2xl border border-ui-border-light bg-card shadow-sm">
        {[...rows.map((r) => ({ ...r, extra: false as const })), ...extras.map((e) => ({ ...e, kind: e.label, status: "found" as const, extra: true as const }))].map((r, i) => {
          const Icon = r.icon;
          const isOn = !r.extra && r.status === "available" && picked.includes(r.kind as ContactKind);
          const href = r.extra ? (r as { href: string }).href : r.kind === "phone" ? `tel:${r.value}` : `mailto:${r.value}`;
          return (
            <div
              key={r.kind}
              className={cn(
                "flex min-h-[60px] items-center gap-3 px-4 py-3",
                i > 0 && "border-t border-ui-border-light",
              )}
            >
              <span
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors duration-150",
                  r.status === "found" ? "bg-primary/15 text-primary" : "bg-muted text-ui-text-muted",
                )}
              >
                <Icon className="h-4 w-4" />
              </span>

              <div className="min-w-0 flex-1">
                <p className="text-[12px] font-medium text-ui-text-muted">{r.label}</p>
                {r.status === "found" && r.value ? (
                  <a href={href} className="block truncate text-[15px] text-ui-text-primary hover:text-primary">
                    {r.value}
                  </a>
                ) : r.status === "missing" ? (
                  <p className="text-[14px] text-ui-text-tertiary">
                    {r.kind === "phone" ? "No phone number was found" : "No email was found"} · you will not be charged
                  </p>
                ) : (
                  <p className="text-[14px] text-ui-text-tertiary">{CONTACT_PRICES[r.kind as ContactKind]} credits if found</p>
                )}
              </div>

              {r.status === "found" && r.value ? (
                <button
                  type="button"
                  onPointerDown={() => copy(r.value!, r.label)}
                  onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && copy(r.value!, r.label)}
                  aria-label={`Copy ${r.label}`}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-ui-text-muted transition-transform duration-100 ease-out hover:bg-muted active:scale-90"
                >
                  {copied === r.value ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
                </button>
              ) : r.status === "available" ? (
                <button
                  type="button"
                  role="switch"
                  aria-checked={isOn}
                  aria-label={`Include ${r.label}`}
                  onClick={() => toggle(r.kind as ContactKind)}
                  className={cn(
                    "relative h-[26px] w-[44px] shrink-0 rounded-full transition-colors duration-200 active:scale-95",
                    isOn ? "bg-primary" : "bg-muted",
                  )}
                >
                  <span
                    className={cn(
                      "absolute top-[3px] h-5 w-5 rounded-full bg-background shadow transition-[left] duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none",
                      isOn ? "left-[21px]" : "left-[3px]",
                    )}
                  />
                </button>
              ) : null}
            </div>
          );
        })}
      </div>

      {available.length > 0 && (
        <button
          type="button"
          disabled={busy || maxCost === 0}
          onClick={() => onEnrich(chosen)}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary text-[15px] font-semibold text-primary-foreground transition-[transform,opacity] duration-100 ease-out active:scale-[0.98] disabled:opacity-40"
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : maxCost === 0 ? (
            "Choose what to find"
          ) : (
            `Find ${chosen.length === 1 ? OPTIONS.find((o) => o.kind === chosen[0])!.label.toLowerCase() : `${chosen.length} items`} · up to ${maxCost} credits`
          )}
        </button>
      )}
    </section>
  );
}
