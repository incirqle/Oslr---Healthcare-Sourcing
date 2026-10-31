import { useEffect, useRef, useState } from "react";
import type { MarketingRoute } from "./routes";
import { applySeo, clearSeo } from "./seo";
import { openDemoCard } from "./demoCard";

/**
 * Renders one page of the Oslr marketing site exactly as designed.
 * The page HTML, stylesheet (/site/assets/css/oslr.css) and script
 * (/site/assets/js/oslr.js) come from the marketing site build and are
 * regenerated from the marketing site build. The stylesheet is only attached
 * while a marketing page is on screen, so it never touches the app.
 */
const CSS_ID = "oslr-site-css";
const FONT_ID = "oslr-site-font";

function ensureLink(id: string, href: string) {
  if (document.getElementById(id)) return;
  const l = document.createElement("link");
  l.id = id;
  l.rel = "stylesheet";
  l.href = href;
  document.head.appendChild(l);
}

export default function MarketingPage({ route }: { route: MarketingRoute }) {
  const ref = useRef<HTMLDivElement>(null);
  const [html, setHtml] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    route.load().then((m) => alive && setHtml(m.default));
    applySeo(route);
    ensureLink(FONT_ID, "https://fonts.googleapis.com/css2?family=Inter:wght@400..700&display=swap");
    ensureLink(CSS_ID, "/site/assets/css/oslr.css");
    document.documentElement.classList.add("oslr-site");
    return () => {
      alive = false;
      clearSeo();
      document.getElementById(CSS_ID)?.remove();
      document.documentElement.classList.remove("oslr-site", "js");
    };
  }, [route]);

  useEffect(() => {
    if (html === null || !ref.current) return;
    ref.current.innerHTML = html;
    const root = ref.current;
    const primary = root.querySelector(".nav__links");
    const links = [
      ["/about", "Company"],
      ["/pricing", "Pricing"],
      ["/guides", "Resources"],
    ];
    const solutions: { group: string; items: [string, string, string][] }[] = [
      { group: "By setting", items: [
        ["/solutions/private-practices", "Private practices", "Find a partner, an APP or a fellow finishing this year."],
        ["/solutions/practice-groups", "Practice groups and MSOs", "An agent and a project for every office."],
        ["/solutions/surgery-centers", "Surgery centers", "Surgeons, CRNAs, anesthesiologists and OR nurses."],
        ["/solutions/health-systems", "Hospitals and health systems", "Hard-to-fill roles and graduating trainees."],
      ] },
      { group: "By team", items: [
        ["/solutions/health-systems", "Hospital and in-house recruiters", "Clinical search built for talent teams."],
        ["/solutions/recruiters", "Agency and search firm recruiters", "Every client search in one place."],
        ["/solutions", "All solutions", "See every team Oslr is built for."],
      ] },
    ];
    primary?.querySelectorAll(":scope > a, :scope > .dd--sol").forEach((a) => a.remove());
    const chevron = '<svg viewBox="0 0 12 12" width="10" height="10" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 4.5L6 7.5 9 4.5"/></svg>';
    const solDd = document.createElement("div");
    solDd.className = "dd dd--sol";
    solDd.innerHTML = `<button class="dd__btn" type="button" aria-expanded="false" aria-haspopup="true">Solutions ${chevron}</button><div class="dd__panel dd__panel--sol" role="menu"><div class="dd__cols">${solutions
      .map((g) => `<div><p class="dd__h">${g.group}</p>${g.items.map(([h, b, s]) => `<a class="dd__item" role="menuitem" href="${h}"><b>${b}</b><span>${s}</span></a>`).join("")}</div>`)
      .join("")}</div></div>`;
    solDd.querySelector(".dd__btn")?.toggleAttribute("data-current", route.path.startsWith("/solutions"));
    primary?.appendChild(solDd);
    links.forEach(([href, label]) => {
      const a = document.createElement("a");
      a.href = href;
      a.textContent = label;
      if (route.path === href || (href === "/guides" && route.path.startsWith("/guides/"))) {
        a.setAttribute("aria-current", "page");
      }
      primary?.appendChild(a);
    });
    const productButton = primary?.querySelector(".dd__btn");
    productButton?.toggleAttribute("data-current", route.path.startsWith("/product/"));
    const sheet = root.querySelector(".sheet");
    sheet?.querySelectorAll('a.sheet__link:not([data-link]), .sheet__sol').forEach((a) => a.remove());
    const login = sheet?.querySelector('[data-link="login"]');
    const solHead = document.createElement("p");
    solHead.className = "sheet__h sheet__sol";
    solHead.textContent = "Solutions";
    sheet?.insertBefore(solHead, login ?? null);
    solutions[0].items.concat([solutions[1].items[1]]).forEach(([h, b, s]) => {
      const a = document.createElement("a");
      a.className = "sheet__prod sheet__sol";
      a.href = h;
      a.innerHTML = `<b>${b}</b><span>${s}</span>`;
      sheet?.insertBefore(a, login ?? null);
    });
    links.forEach(([href, label]) => {
      const a = document.createElement("a");
      a.className = "sheet__link";
      a.href = href;
      a.textContent = label;
      sheet?.insertBefore(a, login ?? null);
    });
    root.querySelectorAll(".foot__cols h4").forEach((heading) => {
      if (heading.textContent !== "Company") return;
      const list = heading.parentElement?.querySelector("ul");
      if (!list || list.querySelector('a[href="/about"]')) return;
      const item = document.createElement("li");
      const a = document.createElement("a");
      a.href = "/about";
      a.textContent = "About Oslr";
      item.appendChild(a);
      list.prepend(item);
    });
    const productCol = Array.from(root.querySelectorAll(".foot__cols h4")).find((h) => h.textContent === "Product")?.parentElement;
    if (productCol && !root.querySelector(".foot__sol")) {
      const col = document.createElement("div");
      col.className = "foot__sol";
      col.innerHTML = `<h4>Solutions</h4><ul>${[...solutions[0].items, solutions[1].items[1]].map(([h, b]) => `<li><a href="${h}">${b}</a></li>`).join("")}</ul>`;
      productCol.after(col);
    }
    const onDemo = (e: MouseEvent) => {
      const a = (e.target as HTMLElement).closest('a[data-link="demo"], a[href^="mailto:hello@oslr.health"]');
      if (!a || !/demo|sales|Meet Oslr/i.test(a.textContent ?? "")) return;
      e.preventDefault();
      e.stopPropagation();
      openDemoCard();
    };
    root.addEventListener("click", onDemo, true);
    const scripts = ["/site/assets/js/config.js", "/site/assets/js/oslr.js"].map((src) => {
      const s = document.createElement("script");
      s.src = src;
      s.async = false;
      s.dataset.oslrSite = "1";
      document.body.appendChild(s);
      return s;
    });
    const hash = window.location.hash;
    if (hash) requestAnimationFrame(() => document.querySelector(hash)?.scrollIntoView());
    return () => {
      root.removeEventListener("click", onDemo, true);
      scripts.forEach((s) => s.remove());
    };
  }, [html, route.path]);

  return <div ref={ref} className="oslr-site-root" />;
}
