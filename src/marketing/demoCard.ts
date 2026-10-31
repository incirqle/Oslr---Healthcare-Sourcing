import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

/** Cal.com event shown inside the card after visitors share their details. */
const CAL_LINK = "spitchsink/oslr-demo";
const CAL_NS = "oslr-demo";

/* Cal.com's official loader, adapted from their inline embed snippet. */
function loadCal(): any {
  const w = window as any;
  if (!w.Cal) {
    (function (C: any, A: string, L: string) {
      const p = (a: any, ar: any) => a.q.push(ar);
      const d = C.document;
      C.Cal = C.Cal || function (...ar: any[]) {
        const cal = C.Cal;
        if (!cal.loaded) { cal.ns = {}; cal.q = cal.q || []; d.head.appendChild(d.createElement("script")).src = A; cal.loaded = true; }
        if (ar[0] === L) {
          const api: any = function (...a: any[]) { p(api, a); };
          const namespace = ar[1];
          api.q = api.q || [];
          if (typeof namespace === "string") { cal.ns[namespace] = cal.ns[namespace] || api; p(cal.ns[namespace], ar); p(cal, ["initNamespace", namespace]); }
          else p(cal, ar);
          return;
        }
        p(cal, ar);
      };
    })(w, "https://app.cal.com/embed/embed.js", "init");
    w.Cal("init", CAL_NS, { origin: "https://app.cal.com" });
    w.Cal.ns[CAL_NS]("ui", { cssVarsPerTheme: { light: { "cal-brand": "#7AC5B0" }, dark: { "cal-brand": "#7AC5B0" } }, hideEventTypeDetails: false, layout: "month_view", theme: "dark" });
  }
  return w.Cal;
}

const schema = z.object({
  name: z.string().trim().min(1, "Enter your name").max(100),
  email: z.string().trim().email("Enter a valid email").max(255),
  company: z.string().trim().min(1, "Enter your company").max(150),
});

const STYLE_ID = "oslr-demo-card-css";
const css = `
.dc-back{position:fixed;inset:0;z-index:1000;background:rgba(5,8,12,.72);display:flex;align-items:center;justify-content:center;padding:16px;opacity:0;transition:opacity 200ms cubic-bezier(0.23,1,0.32,1)}
.dc-back[data-open]{opacity:1}
.dc{width:100%;max-width:420px;background:var(--ink-1,#11161d);color:var(--fg,#e8edf2);border:1px solid rgba(255,255,255,.1);border-radius:16px;padding:28px;transform:scale(.96);transition:transform 220ms cubic-bezier(0.23,1,0.32,1)}
.dc-back[data-open] .dc{transform:scale(1)}
.dc h2{font:600 24px/1.2 var(--f-display,inherit);margin:0 0 6px}
.dc p{margin:0 0 20px;color:var(--fg-2,#9aa5b1);font-size:15px}
.dc label{display:block;font-size:13px;font-weight:500;margin:0 0 6px}
.dc input{width:100%;box-sizing:border-box;padding:11px 12px;border-radius:10px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.04);color:inherit;font:inherit;font-size:15px;margin-bottom:14px}
.dc input:focus{outline:2px solid var(--sea,#7fe0c0);outline-offset:1px}
.dc .dc-err{color:#ff8a8a;font-size:13px;min-height:18px;margin:-4px 0 10px}
.dc .dc-row{display:flex;gap:10px;justify-content:flex-end;margin-top:6px}
.dc button{cursor:pointer}
.dc.dc--cal{max-width:1000px;max-height:calc(100vh - 32px);display:flex;flex-direction:column;padding:20px}
.dc-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px}
.dc-head h2{margin:0}
.dc-cal{flex:1;min-height:560px;overflow:auto;border-radius:10px}
@media (prefers-reduced-motion: reduce){.dc{transform:none!important;transition:none}}
`;

export function openDemoCard() {
  if (!document.getElementById(STYLE_ID)) {
    const st = document.createElement("style");
    st.id = STYLE_ID;
    st.textContent = css;
    document.head.appendChild(st);
  }
  const back = document.createElement("div");
  back.className = "dc-back";
  back.innerHTML = `
    <form class="dc" role="dialog" aria-modal="true" aria-labelledby="dc-title" novalidate>
      <h2 id="dc-title">Book a demo</h2>
      <p>Tell us who you are, then pick a time that works for you.</p>
      <label for="dc-name">Name</label><input id="dc-name" name="name" autocomplete="name" maxlength="100">
      <label for="dc-email">Work email</label><input id="dc-email" name="email" type="email" autocomplete="email" maxlength="255">
      <label for="dc-company">Company</label><input id="dc-company" name="company" autocomplete="organization" maxlength="150">
      <div class="dc-err" aria-live="polite"></div>
      <div class="dc-row">
        <button type="button" class="btn btn--ghost" data-close>Cancel</button>
        <button type="submit" class="btn btn--primary">Continue</button>
      </div>
    </form>`;
  document.body.appendChild(back);
  requestAnimationFrame(() => back.setAttribute("data-open", ""));
  const form = back.querySelector("form") as HTMLFormElement;
  const err = back.querySelector(".dc-err") as HTMLElement;
  const submit = back.querySelector('button[type="submit"]') as HTMLButtonElement;
  (back.querySelector("#dc-name") as HTMLInputElement).focus();

  const close = () => {
    back.removeAttribute("data-open");
    document.removeEventListener("keydown", onKey);
    setTimeout(() => back.remove(), 200);
  };
  const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
  document.addEventListener("keydown", onKey);
  back.addEventListener("click", (e) => {
    if (e.target === back || (e.target as HTMLElement).closest("[data-close]")) close();
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form)) as Record<string, string>;
    const parsed = schema.safeParse(data);
    if (!parsed.success) {
      err.textContent = parsed.error.issues[0].message;
      return;
    }
    err.textContent = "";
    submit.disabled = true;
    submit.textContent = "Sending";
    const { error } = await supabase.functions.invoke("demo-request", {
      body: { ...parsed.data, page: window.location.pathname },
    });
    if (error) {
      submit.disabled = false;
      submit.textContent = "Continue";
      err.textContent = "That did not go through. Please try again.";
      return;
    }
    form.classList.add("dc--cal");
    form.innerHTML = `<div class="dc-head"><h2>Pick a time</h2><button type="button" class="btn btn--ghost btn--sm" data-close aria-label="Close">Close</button></div><div id="dc-cal" class="dc-cal"></div>`;
    const Cal = loadCal();
    Cal.ns[CAL_NS]("inline", {
      elementOrSelector: "#dc-cal",
      calLink: CAL_LINK,
      config: { layout: "month_view", useSlotsViewOnSmallScreen: "true", name: parsed.data.name, email: parsed.data.email, notes: `Company: ${parsed.data.company}` },
    });
  });
}
