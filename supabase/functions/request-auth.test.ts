import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";

// Exercise the real entrypoints, with all external traffic replaced. These
// fixtures cannot reach a paid provider or read/write production data.
const handlers: Array<(req: Request) => Promise<Response>> = [];
const originalServe = Deno.serve;
Object.defineProperty(Deno, "serve", { configurable: true, value: (handler: (req: Request) => Promise<Response>) => handlers.push(handler) });
const originalEnv = Deno.env.get;
Deno.env.get = (key: string) => ({
  SUPABASE_URL: "https://auth-fixture.example",
  SUPABASE_SERVICE_ROLE_KEY: "fixture-service-key",
}[key]);
await import("./company-enrichment/index.ts");
await import("./search-people/index.ts");
Object.defineProperty(Deno, "serve", { configurable: true, value: originalServe });

const originalFetch = globalThis.fetch;
let downstreamCalls = 0;
globalThis.fetch = async (input, init) => {
  const request = new Request(input, init);
  const url = new URL(request.url);
  if (url.pathname === "/auth/v1/user") {
    return new Response(JSON.stringify(request.headers.get("Authorization") === "Bearer fixture-valid-user"
      ? { id: "00000000-0000-0000-0000-000000000001", email: "fixture@example.test" }
      : { message: "Invalid JWT" }), {
      status: request.headers.get("Authorization") === "Bearer fixture-valid-user" ? 200 : 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  if (url.pathname === "/rest/v1/user_roles") return new Response("[]", { headers: { "Content-Type": "application/json" } });
  downstreamCalls++;
  throw new Error("Unexpected cache/provider access: " + url.pathname);
};

const cases = [
  { name: "company-enrichment", handler: handlers[0], actions: ["base", "preview", "pull", "movement"] },
  { name: "search-people", handler: handlers[1], actions: ["enrich_person", "enrich_contact", "ai_summary", "ai_snapshot", "search_usage", "meter_engagement", "rank_criteria", "explain_criteria", null] },
];
for (const { name, handler, actions } of cases) {
  for (const action of actions) {
    for (const token of [null, "invalid-token", "fixture-public-anon-key"]) {
      Deno.test(`${name} ${action ?? "search"}: rejects ${token === null ? "missing" : token} credentials before cache/providers`, async () => {
        downstreamCalls = 0;
        const response = await handler(new Request("http://localhost/", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), "x-oslr-internal-user": "spoofed-user" },
          body: JSON.stringify({ action, query: "orthopedic surgeons in Philadelphia", company_name: "Example", linkedin_url: "https://www.linkedin.com/in/fixture" }),
        }));
        assertEquals(response.status, 401);
        assertEquals(await response.json(), { error: "Unauthorized" });
        assertEquals(downstreamCalls, 0);
        assertEquals(response.headers.get("Access-Control-Allow-Origin"), "*");
      });
    }
  }
  Deno.test(`${name}: unauthenticated invalid JSON is rejected before parsing`, async () => {
    const response = await handler(new Request("http://localhost/", { method: "POST", body: "{" }));
    assertEquals(response.status, 401);
  });
  Deno.test(`${name}: public browser preflight succeeds without downstream calls`, async () => {
    downstreamCalls = 0;
    const response = await handler(new Request("http://localhost/", { method: "OPTIONS" }));
    assertEquals(response.status, 200);
    assertEquals(downstreamCalls, 0);
    assertEquals(response.headers.get("Access-Control-Allow-Origin"), "*");
  });
}
for (const action of ["enrich_person", "ai_summary", "ai_snapshot"]) {
  Deno.test(`search-people ${action}: signed-in users reach existing validation`, async () => {
    downstreamCalls = 0;
    const response = await handlers[1](new Request("http://localhost/", {
      method: "POST", headers: { Authorization: "Bearer fixture-valid-user" }, body: JSON.stringify({ action }),
    }));
    assertEquals(response.status, 400);
    assertEquals(downstreamCalls, 0);
  });
}
Deno.test("restore test globals", () => {
  globalThis.fetch = originalFetch;
  Deno.env.get = originalEnv;
});