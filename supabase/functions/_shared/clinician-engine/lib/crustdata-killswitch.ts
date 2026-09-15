// deno-lint-ignore-file no-explicit-any -- verbatim copy of the reference killswitch
// Global kill switch for ALL outbound Crustdata calls.
//
// Imported for side-effects in every module that talks to api.crustdata.com.
// When KILLED is true (default), any fetch() to api.crustdata.com is
// short-circuited with a 503 response so callers fall through their normal
// error path (insufficientCredits=false, detail="CRUSTDATA_KILLED").
//
// Disable by setting CRUSTDATA_KILLED env var to "1" (or "true").
// Default is OFF (Crustdata calls allowed). Per-recipe pausing (e.g.
// conference attendees) is enforced at the tracker entry points, not here.

const env = (() => { try { return Deno.env.get("CRUSTDATA_KILLED"); } catch { return null; } })();
const KILLED = env === "1" || env === "true";

if (KILLED && !(globalThis as any).__crustdata_kill_installed) {
  (globalThis as any).__crustdata_kill_installed = true;
  const orig = globalThis.fetch.bind(globalThis);
  globalThis.fetch = ((input: any, init?: any) => {
    try {
      const url = typeof input === "string" ? input : (input?.url ?? "");
      if (typeof url === "string" && url.includes("api.crustdata.com")) {
        console.warn("[CRUSTDATA_KILLED] blocked", url);
        return Promise.resolve(new Response(
          JSON.stringify({ error: "CRUSTDATA_KILLED", detail: "All Crustdata calls disabled by kill switch" }),
          { status: 503, headers: { "Content-Type": "application/json" } },
        ));
      }
    } catch { /* fall through */ }
    return orig(input, init);
  }) as typeof fetch;
}

export const CRUSTDATA_KILLED = KILLED;
