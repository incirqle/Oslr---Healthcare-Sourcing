import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  loading: true,
  signOut: async () => {},
});

/** Drop every trace of a login the server no longer accepts. */
async function clearLocalLogin() {
  await supabase.auth.signOut({ scope: "local" }).catch(() => {});
  try {
    Object.keys(sessionStorage).filter((k) => k.startsWith("oslr_access_ok:")).forEach((k) => sessionStorage.removeItem(k));
  } catch { /* ignore */ }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let verified = false;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
      // Before the first server check, only trust a sign-out; the check decides the rest.
      if (!verified && s) return;
      setSession(s);
      if (verified || event === "SIGNED_OUT") setLoading(false);
    });

    (async () => {
      const { data: { session: stored } } = await supabase.auth.getSession();
      if (stored) {
        // A saved login is only trusted once the server confirms the account still exists.
        const { data, error } = await supabase.auth.getUser();
        if (error || !data.user) {
          await clearLocalLogin();
          verified = true;
          setSession(null);
          setLoading(false);
          return;
        }
      }
      verified = true;
      const { data: { session: current } } = await supabase.auth.getSession();
      setSession(current);
      setLoading(false);
    })();

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    await clearLocalLogin();
    setSession(null);
  };

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
