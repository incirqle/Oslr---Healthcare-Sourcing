import { useState } from "react";
import { Loader2, Mail, Phone, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ContactKind, ContactState } from "@/hooks/useContactEnrich";
import { CONTACT_PRICES } from "@/hooks/useContactEnrich";

const OPTIONS: { kind: ContactKind; label: string; icon: typeof Mail }[] = [
  { kind: "work_email", label: "Work email", icon: Mail },
  { kind: "personal_email", label: "Personal email", icon: Mail },
  { kind: "phone", label: "Phone number", icon: Phone },
];

interface Props {
  state: ContactState;
  busy: boolean;
  onEnrich: (kinds: ContactKind[]) => void;
}

function isFound(state: ContactState, k: ContactKind) {
  const c = state.contact;
  if (k === "work_email") return !!c.work_email;
  if (k === "personal_email") return !!c.personal_emails?.length;
  return !!c.phone_numbers?.length;
}

export function ContactEnrichPanel({ state, busy, onEnrich }: Props) {
  const available = OPTIONS.filter((o) => !isFound(state, o.kind) && !state.checked[o.kind]);
  const [picked, setPicked] = useState<ContactKind[]>(["work_email"]);
  const chosen = picked.filter((k) => available.some((o) => o.kind === k));
  const maxCost = chosen.reduce((s, k) => s + CONTACT_PRICES[k], 0);

  if (!available.length) return null;

  return (
    <div className="rounded-xl border border-locked-border bg-locked p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-[15px] font-semibold text-ui-text-primary">Find contact info</h3>
        <span className="inline-flex items-center gap-1 text-[13px] text-ui-text-tertiary">
          <Zap className="h-3.5 w-3.5 text-primary" />
          {state.balance ?? "—"} credits left
        </span>
      </div>
      <div className="mt-4 space-y-2">
        {available.map(({ kind, label, icon: Icon }) => {
          const on = picked.includes(kind);
          return (
            <button
              key={kind}
              type="button"
              onClick={() => setPicked((p) => (on ? p.filter((x) => x !== kind) : [...p, kind]))}
              className={cn(
                "flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left text-[14px] transition-colors",
                on ? "border-primary bg-primary/10 text-ui-text-primary" : "border-border text-ui-text-secondary hover:bg-muted/40",
              )}
            >
              <span className="inline-flex items-center gap-2"><Icon className="h-4 w-4" />{label}</span>
              <span className="text-[13px] text-ui-text-tertiary">{CONTACT_PRICES[kind]} credits</span>
            </button>
          );
        })}
      </div>
      <Button
        type="button"
        disabled={busy || maxCost === 0}
        onClick={() => onEnrich(chosen)}
        className="mt-4 h-11 w-full rounded-lg font-semibold"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : `Find contact info · up to ${maxCost} credits`}
      </Button>
      <p className="mt-2 text-center text-[12px] text-ui-text-muted">
        You're only charged for what we find. Found info stays saved for free.
      </p>
    </div>
  );
}
