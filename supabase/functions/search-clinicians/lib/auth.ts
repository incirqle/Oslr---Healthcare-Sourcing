// Auth resolver for search-clinicians. Oslr uses real Supabase auth only —
// the reference engine's localStorage profile_id passcode fallback is a
// RepGPT surface this product does not have, so it is deliberately not
// ported. A request without a valid JWT is rejected.

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface Caller {
  userId: string;
  email: string | null;
  isAdmin: boolean;
}

export async function resolveCaller(
  adminClient: SupabaseClient,
  req: Request,
): Promise<Caller | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return null;
  const jwt = authHeader.replace(/^Bearer\s+/i, "");
  try {
    const { data, error } = await adminClient.auth.getUser(jwt);
    if (!error && data?.user) {
      let isAdmin = false;
      try {
        const { data: roles } = await adminClient
          .from("user_roles")
          .select("role")
          .eq("user_id", data.user.id);
        isAdmin = Array.isArray(roles) && roles.some((r) => r.role === "admin");
      } catch (_) { /* role lookup is best-effort */ }
      return {
        userId: data.user.id,
        email: data.user.email ?? null,
        isAdmin,
      };
    }
  } catch (_) { /* fall through */ }
  return null;
}
