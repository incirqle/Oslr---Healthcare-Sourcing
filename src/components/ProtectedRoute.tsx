import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { ReactNode, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

const IS_PREVIEW = window.location.hostname.includes("-preview--");

type Access = "checking" | "ok" | "redirecting" | "error";
// Remember a passed check for this browser tab so every page isn't re-checked.
const okKey = (uid: string) => `oslr_access_ok:${uid}`;

/**
 * Signed-in users need either the paid Starter plan or a workspace the
 * owner has approved (billing_exemptions). Everyone else goes straight
 * to checkout.
 */
function usePaidAccess(userId: string | undefined): [Access, string | null] {
  const [access, setAccess] = useState<Access>("checking");
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    if (sessionStorage.getItem(okKey(userId))) { setAccess("ok"); return; }
    let cancelled = false;
    (async () => {
      try {
        const { data: prof } = await supabase.from("profiles").select("company_id").eq("user_id", userId).maybeSingle();
        const companyId = prof?.company_id;
        if (companyId) {
          const { data: ex } = await supabase.from("billing_exemptions" as never).select("company_id").eq("company_id", companyId).maybeSingle();
          if (ex) { sessionStorage.setItem(okKey(userId), "1"); if (!cancelled) setAccess("ok"); return; }
        }
        const { data: status } = await supabase.functions.invoke("billing", { body: { action: "status" } });
        if (status?.subscribed) { sessionStorage.setItem(okKey(userId), "1"); if (!cancelled) setAccess("ok"); return; }
        if (cancelled) return;
        setAccess("redirecting");
        const { data, error } = await supabase.functions.invoke("billing", { body: { action: "checkout", origin: window.location.origin } });
        if (error || !data?.url) throw new Error(data?.error || "Checkout is unavailable right now.");
        window.location.href = data.url;
      } catch (e) {
        if (cancelled) return;
        setMsg(e instanceof Error ? e.message : "Checkout is unavailable right now.");
        setAccess("error");
      }
    })();
    return () => { cancelled = true; };
  }, [userId]);

  return [access, msg];
}

const Spinner = ({ label }: { label?: string }) => (
  <div className="flex h-screen flex-col items-center justify-center gap-3">
    <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    {label && <p className="text-sm text-muted-foreground">{label}</p>}
  </div>
);

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading, signOut } = useAuth();
  const [access, msg] = usePaidAccess(user?.id);

  // Editor preview without a sign-in stays open for building.
  if (IS_PREVIEW && !user && !loading) return <>{children}</>;
  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/auth" replace />;

  if (access === "ok") return <>{children}</>;
  if (access === "error") {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-sm text-muted-foreground max-w-sm">{msg}</p>
        <div className="flex gap-2">
          <Button onClick={() => window.location.reload()}>Try again</Button>
          <Button variant="outline" onClick={() => signOut()}>Sign out</Button>
        </div>
      </div>
    );
  }
  return <Spinner label={access === "redirecting" ? "Taking you to checkout…" : undefined} />;
}
