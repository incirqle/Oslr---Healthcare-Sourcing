import { useEffect, useRef, useState } from "react";
import type { MarketingRoute } from "./routes";
import { applySeo, clearSeo } from "./seo";

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

function setMeta(name: string, content: string) {
  let m = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  if (!m) {
    m = document.createElement("meta");
    m.name = name;
    document.head.appendChild(m);
  }
  m.content = content;
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
      document.getElementById(CSS_ID)?.remove();
      document.documentElement.classList.remove("oslr-site", "js");
    };
  }, [route]);

  useEffect(() => {
    if (html === null || !ref.current) return;
    ref.current.innerHTML = html;
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
    return () => scripts.forEach((s) => s.remove());
  }, [html]);

  return <div ref={ref} className="oslr-site-root" />;
}
