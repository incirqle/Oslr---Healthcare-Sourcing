import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { PlanPicker, type PlanSelection } from "@/components/PlanPicker";

/** Shown to signed-in users without a plan: pick Starter or Pro, or redeem an invite code. */
export function PaywallChoice({ onCheckout, onRedeemed, onSignOut }: { onCheckout: (sel: PlanSelection) => void; onRedeemed: () => void; onSignOut: () => void }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [showCode, setShowCode] = useState(false);
  const [selection, setSelection] = useState<PlanSelection>({ plan: "starter", interval: "month" });

  const redeem = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { data, error } = await supabase.rpc("redeem_beta_code", { _code: code });
    setBusy(false);
    if (error) return toast.error("That code couldn't be used right now. Try again.");
    if (!data) return toast.error("That code isn't valid.");
    toast.success("Invite pass active. Enjoy 5 days on Oslr.");
    onRedeemed();
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden p-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_0%,hsl(var(--primary)/0.12),transparent_70%)]" aria-hidden="true" />
      <div className="relative w-full max-w-2xl space-y-6">
        <div className="space-y-2 text-center">
          <p className="font-heading text-sm font-semibold tracking-[0.25em] text-primary">OSLR</p>
          <h1 className="font-heading text-3xl font-semibold">Choose your plan</h1>
          <p className="mx-auto max-w-md text-sm text-muted-foreground">
            Searches, filters and ranking are always free. Credits only spend on contact details you reveal, and you are never charged when nothing is found.
          </p>
        </div>
        <PlanPicker value={selection} onChange={setSelection} />
        <Button className="w-full" size="lg" onClick={() => onCheckout(selection)}>
          Continue to secure checkout
        </Button>
        <div className="text-center">
          <button type="button" className="text-xs text-muted-foreground hover:text-foreground" onClick={() => setShowCode((v) => !v)}>
            Have an invite code?
          </button>
          {showCode && (
            <form onSubmit={redeem} className="mx-auto mt-3 flex max-w-xs gap-2">
              <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Invite code" aria-label="Invite code" />
              <Button type="submit" variant="outline" disabled={busy || !code.trim()}>{busy ? "Checking…" : "Apply"}</Button>
            </form>
          )}
        </div>
        <button className="w-full text-center text-xs text-muted-foreground hover:text-foreground" onClick={onSignOut}>Sign out</button>
      </div>
    </div>
  );
}

const Choice = ({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) => (
  <div className="space-y-2">
    <Label>{label}</Label>
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button type="button" key={o} onClick={() => onChange(o)}
          className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${value === o ? "border-primary bg-primary/15 text-foreground" : "border-border text-muted-foreground hover:text-foreground"}`}>
          {o}
        </button>
      ))}
    </div>
  </div>
);

/** Shown when the beta pass runs out: feedback first, then the paid plan. */
export function BetaEnded({ userId, email, onCheckout, onSignOut }: { userId: string; email?: string | null; onCheckout: () => void; onSignOut: () => void }) {
  const [experience, setExperience] = useState("");
  const [intuitive, setIntuitive] = useState("");
  const [easy, setEasy] = useState("");
  const [suggestions, setSuggestions] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { data: prof } = await supabase.from("profiles").select("company_id").eq("user_id", userId).maybeSingle();
    const { error } = await supabase.from("beta_feedback").insert({
      user_id: userId, company_id: prof?.company_id ?? null, user_email: email ?? null,
      experience, intuitive, easy_to_use: easy, suggestions: suggestions.trim() || null,
    });
    setBusy(false);
    if (error) return toast.error("Your feedback didn't send. Try again.");
    setSent(true);
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md space-y-6 rounded-2xl border border-border bg-card p-6">
        <div className="space-y-1">
          <h1 className="font-heading text-xl font-semibold">Your invite pass has ended</h1>
          <p className="text-sm text-muted-foreground">Thanks for trying Oslr early. Tell us how it went.</p>
        </div>
        {sent ? (
          <div className="space-y-4">
            <p className="text-sm">Feedback sent. Thank you.</p>
            <Button className="w-full" onClick={onCheckout}>Choose a plan to keep going</Button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-5">
            <Choice label="How was your experience?" value={experience} onChange={setExperience} options={["Great", "Good", "Okay", "Poor"]} />
            <Choice label="Was it intuitive?" value={intuitive} onChange={setIntuitive} options={["Yes", "Mostly", "No"]} />
            <Choice label="Was it easy to use?" value={easy} onChange={setEasy} options={["Yes", "Mostly", "No"]} />
            <div className="space-y-2">
              <Label htmlFor="sugg">Any suggestions for future use?</Label>
              <Textarea id="sugg" value={suggestions} onChange={(e) => setSuggestions(e.target.value)} rows={4} maxLength={4000} />
            </div>
            <Button type="submit" className="w-full" disabled={busy || !experience || !intuitive || !easy}>{busy ? "Sending…" : "Send feedback"}</Button>
          </form>
        )}
        <button className="w-full text-xs text-muted-foreground hover:text-foreground" onClick={onSignOut}>Sign out</button>
      </div>
    </div>
  );
}
