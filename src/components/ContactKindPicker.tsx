import { Briefcase, Check, Mail, Phone } from "lucide-react";
import { cn } from "@/lib/utils";
import { CONTACT_PRICES, type ContactKind } from "@/hooks/useContactEnrich";

export const CONTACT_OPTIONS: { kind: ContactKind; label: string; icon: typeof Mail }[] = [
  { kind: "work_email", label: "Work email", icon: Briefcase },
  { kind: "personal_email", label: "Personal email", icon: Mail },
  { kind: "phone", label: "Mobile phone", icon: Phone },
];

/** Pick which contact pools to look up: work email, personal email, phone. Each shows its own price. */
export function ContactKindPicker({ value, onChange, disabled, perPerson = 1 }: {
  value: ContactKind[]; onChange: (k: ContactKind[]) => void; disabled?: boolean; perPerson?: number;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {CONTACT_OPTIONS.map(({ kind, label, icon: Icon }) => {
        const on = value.includes(kind);
        return (
          <button key={kind} type="button" role="switch" aria-checked={on} disabled={disabled}
            onClick={() => onChange(on ? value.filter((k) => k !== kind) : [...value, kind])}
            className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] transition-colors active:scale-[0.97] disabled:opacity-50",
              on ? "border-mint bg-mint text-mint-foreground" : "border-border bg-card text-foreground/80 hover:border-mint/50")}>
            {on ? <Check className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
            {label}
            <span className={cn("text-[12px]", on ? "opacity-80" : "text-muted-foreground")}>
              {CONTACT_PRICES[kind] * perPerson} cr
            </span>
          </button>
        );
      })}
    </div>
  );
}
