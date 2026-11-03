import { useState } from "react";
import { Check, Copy, Loader2, Mail, MapPin, Phone, ThumbsDown, ThumbsUp, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { OrgLogo, PersonAvatar } from "@/components/search/Avatars";
import { MatchFacts } from "./MatchFacts";
import { CONTACT_PRICES, enrichContact, type ContactKind } from "@/hooks/useContactEnrich";
import { ContactKindPicker } from "@/components/ContactKindPicker";
import type { DecisionRow, PoolItem, Tag } from "@/hooks/useAgents";

export function cityOf(p: Record<string, unknown>): string {
  return String(p.location ?? "").split(",")[0]?.trim() ?? "";
}

interface Props {
  item: PoolItem;
  decision?: DecisionRow;
  tags: { approve: Tag[]; pass: Tag[] };
  active?: boolean;
  draft: "approved" | "passed" | null;
  onDraft: (d: "approved" | "passed" | null) => void;
  onOpen: () => void;
  onSubmit: (b: { decision: "approved" | "passed"; tags: string[]; note?: string; skip_city?: string | null }) => Promise<void>;
  onFound?: (c: { email: string | null; phone: string | null }) => Promise<void> | void;
}

export function AgentReviewCard({ item, decision, tags, active, draft, onDraft, onOpen, onSubmit, onFound }: Props) {
  const p = item.profile as Record<string, string | null | undefined>;
  const [picked, setPicked] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [skipCity, setSkipCity] = useState(false);
  const [busy, setBusy] = useState(false);
  const [contactBusy, setContactBusy] = useState(false);
  const [contact, setContact] = useState<{ email: string | null; phone: string | null } | null>(() => {
    const email = p.email || p.work_email || null;
    const phone = (p.phone as string) || null;
    return email || phone ? { email, phone } : null;
  });

  const [pickOpen, setPickOpen] = useState(false);
  const [kinds, setKinds] = useState<ContactKind[]>(["work_email"]);
  const findContact = async () => {
    if (!p.linkedin_url || contactBusy || !kinds.length) return;
    setContactBusy(true);
    try {
      const r = await enrichContact(p.linkedin_url, kinds, p.full_name ?? undefined);
      setPickOpen(false);
      if (r.error === "insufficient_credits") {
        toast.error(`Not enough credits. This needs up to ${r.needed} credits.`);
      } else if (r.error) {
        toast.error(r.error);
      } else if (r.found?.length) {
        const email = r.contact.work_email || r.contact.personal_emails?.[0] || null;
        const phone = r.contact.phone_numbers?.[0] || null;
        setContact({ email, phone });
        toast.success(r.unlimited ? "Contact info found" : `Contact info found · ${r.charged} credits used`);
        await onFound?.({ email, phone });
      } else {
        toast("Nothing was found. We're sorry. You aren't charged a credit.");
      }
      window.dispatchEvent(new Event("oslr:credits"));
    } catch {
      toast.error("Contact lookup failed. Try again shortly.");
    } finally {
      setContactBusy(false);
    }
  };
  const city = cityOf(item.profile);
  const tagLabel = (id: string) => [...tags.approve, ...tags.pass].find((t) => t.id === id)?.label ?? id;

  const submit = async (d: "approved" | "passed") => {
    setBusy(true);
    try {
      await onSubmit({ decision: d, tags: picked, note: note.trim() || undefined, skip_city: d === "passed" && skipCity ? city : null });
      setPicked([]); setNote(""); setSkipCity(false);
    } finally { setBusy(false); }
  };

  const options = draft === "approved" ? tags.approve : tags.pass;

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Open ${p.full_name ?? ""} full profile`}
      onClick={(e) => { if (!(e.target as HTMLElement).closest("button, a, input, textarea, label, [role=checkbox], [data-noopen]")) onOpen(); }}
      onKeyDown={(e) => { if (e.key === "Enter" && e.target === e.currentTarget) onOpen(); }}
      className={cn(
      "agent-enter cursor-pointer rounded-2xl border bg-card/80 p-4 backdrop-blur transition-[border-color,box-shadow,transform] duration-200 active:scale-[0.995] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      active ? "border-mint/40 shadow-[0_8px_30px_-12px_hsl(var(--mint)/0.35)]" : "border-border/70 hover:border-mint/30",
    )}>
      <div className="flex items-start gap-3.5">
        <button onClick={onOpen} aria-label={`Open ${p.full_name ?? ""} profile`} className="shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <PersonAvatar name={p.full_name ?? "?"} src={p.profile_pic_url} className="h-12 w-12" textClassName="text-sm" />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={onOpen} className="truncate text-left font-display text-[16px] font-semibold tracking-tight hover:text-mint-ink">{p.full_name}</button>
            {decision && (
              <span className={cn(
                "rounded-full px-2 py-0.5 text-[12px] font-medium",
                decision.decision === "approved" ? "bg-mint-soft text-mint-ink" : "bg-secondary text-muted-foreground",
              )}>
                {decision.decision === "approved" ? "Liked" : "Passed"}{decision.tags[0] ? `: ${tagLabel(decision.tags[0]).toLowerCase()}` : ""}
              </span>
            )}
          </div>
          <p className="mt-0.5 text-[14px] text-foreground/80">{p.title}</p>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted-foreground">
            {p.current_employer && (
              <span className="flex items-center gap-1.5">
                <OrgLogo name={p.current_employer} src={p.company_logo_url} fallbackSrc={p.company_domain ? `https://www.google.com/s2/favicons?domain=${p.company_domain}&sz=64` : null} className="h-4 w-4" />
                {p.current_employer}
              </span>
            )}
            {p.location && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{p.location}</span>}
          </div>
          {item.why && !decision && <p className="mt-2 text-[13px] leading-relaxed text-foreground/70">{item.why}</p>}
          {!decision && <MatchFacts item={item} />}
          <button onClick={onOpen} className="mt-2 text-[13px] font-medium text-mint-ink hover:underline">View full profile</button>
          <div data-noopen className="mt-2" onClick={(e) => e.stopPropagation()}>
            {contact ? (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border border-mint/30 bg-mint-soft/50 px-3 py-2 text-[13px]">
                {contact.email && (
                  <span className="flex min-w-0 items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5 shrink-0 text-mint-ink" />
                    <span className="truncate">{contact.email}</span>
                    <button aria-label="Copy email" className="shrink-0 text-muted-foreground hover:text-foreground" onClick={async () => { await navigator.clipboard.writeText(contact.email!); toast.success("Email copied"); }}><Copy className="h-3 w-3" /></button>
                  </span>
                )}
                {contact.phone && (
                  <span className="flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5 shrink-0 text-mint-ink" />
                    <span>{contact.phone}</span>
                    <button aria-label="Copy phone" className="shrink-0 text-muted-foreground hover:text-foreground" onClick={async () => { await navigator.clipboard.writeText(contact.phone!); toast.success("Phone copied"); }}><Copy className="h-3 w-3" /></button>
                  </span>
                )}
              </div>
            ) : p.linkedin_url ? (
              pickOpen ? (
                <div className="space-y-2 rounded-xl border border-mint/30 bg-mint-soft/30 p-3">
                  <p className="text-[13px] font-medium">What would you like to find?</p>
                  <ContactKindPicker value={kinds} onChange={setKinds} disabled={contactBusy} />
                  <div className="flex items-center gap-2">
                    <button onClick={findContact} disabled={contactBusy || !kinds.length}
                      className="inline-flex items-center gap-1.5 rounded-full bg-mint px-3.5 py-1.5 text-[13px] font-semibold text-mint-foreground hover:bg-mint-ink disabled:opacity-50">
                      {contactBusy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                      {kinds.length ? `Find · up to ${kinds.reduce((s, k) => s + CONTACT_PRICES[k], 0)} credits` : "Choose at least one"}
                    </button>
                    <button onClick={() => setPickOpen(false)} disabled={contactBusy} className="text-[13px] text-muted-foreground hover:text-foreground">Cancel</button>
                  </div>
                  <p className="text-[12px] text-muted-foreground">Charged only for what we find.</p>
                </div>
              ) : (
                <button onClick={() => setPickOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-full border-2 border-mint px-3 py-1 text-[13px] font-semibold text-mint-ink transition-colors hover:bg-mint-soft">
                  <Mail className="h-3.5 w-3.5" />
                  Find contact info
                </button>
              )
            ) : null}
          </div>
          {decision?.note && <p className="mt-2 border-l-2 border-primary/40 pl-3 text-[13px] italic text-foreground/80">"{decision.note}"</p>}
        </div>
        {!decision && !draft && (
          <div className="flex shrink-0 gap-1.5">
            <Button size="icon" variant="outline" className="h-10 w-10 rounded-full" aria-label={`Pass on ${p.full_name ?? ""}`} onClick={() => onDraft("passed")}><ThumbsDown className="h-4 w-4" /></Button>
            <Button size="icon" className="h-10 w-10 rounded-full bg-mint text-mint-foreground hover:bg-mint/90" aria-label={`Approve ${p.full_name ?? ""}`} onClick={() => onDraft("approved")}><ThumbsUp className="h-4 w-4" /></Button>
          </div>
        )}
      </div>

      {!decision && draft && (
        <div data-noopen className="mt-4 cursor-default space-y-3 rounded-xl border border-border/60 bg-background/50 p-4 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-1">
          <p className="text-[13px] font-medium">{draft === "approved" ? "What did you like? Pick any." : "Why not? Pick any."}</p>
          <div className="flex flex-wrap gap-2">
            {options.map((t) => {
              const on = picked.includes(t.id);
              return (
                <button key={t.id} onClick={() => setPicked((x) => on ? x.filter((y) => y !== t.id) : [...x, t.id])}
                  className={cn("rounded-full border px-3 py-1.5 text-[13px] transition-colors active:scale-[0.97]",
                    on ? "border-mint bg-mint-soft text-mint-ink" : "border-border text-foreground/80 hover:border-primary/40")}>
                  {on && <Check className="mr-1 inline h-3 w-3" />}{t.label}
                </button>
              );
            })}
          </div>
          {draft === "passed" && city && (
            <label className="flex items-center gap-2 text-[13px] text-foreground/80">
              <Checkbox checked={skipCity} onCheckedChange={(v) => setSkipCity(!!v)} />
              Skip everyone in {city} from now on
            </label>
          )}
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={1000}
            placeholder="Optional note for your agent, e.g. only people who run their own practice" className="resize-none text-[14px]" />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => onDraft(null)} disabled={busy}><X className="mr-1 h-3.5 w-3.5" />Cancel</Button>
            <Button size="sm" variant={draft === "approved" ? "default" : "secondary"} onClick={() => submit(draft)} disabled={busy} className={cn("rounded-full px-4", draft === "approved" && "bg-mint text-mint-foreground hover:bg-mint/90")}>
              {busy && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              {draft === "approved" ? "Looks good, save" : "Not a fit"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
