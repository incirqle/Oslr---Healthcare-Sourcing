import type { MarketingRoute } from "./routes";

export const SITE = "https://oslr.health";
const OG_IMAGE = `${SITE}/og-image.jpg?v=4`;

const SECTION: Record<string, string> = {
  guides: "Resources",
  compare: "Comparisons",
  product: "Products",
};

function upsert(selector: string, create: () => HTMLElement, set: (el: HTMLElement) => void) {
  let el = document.head.querySelector<HTMLElement>(selector);
  if (!el) {
    el = create();
    document.head.appendChild(el);
  }
  set(el);
}

function meta(attr: "name" | "property", key: string, content: string) {
  upsert(
    `meta[${attr}="${key}"]`,
    () => {
      const m = document.createElement("meta");
      m.setAttribute(attr, key);
      return m;
    },
    (m) => m.setAttribute("content", content),
  );
}

/** Structured data an AI engine or search engine can read and cite. */
export function buildJsonLd(route: MarketingRoute) {
  const url = `${SITE}${route.path === "/" ? "/" : route.path}`;
  const parts = route.path.split("/").filter(Boolean);
  const crumbs = [{ name: "Oslr", url: `${SITE}/` }];
  if (parts.length) {
    const sec = parts[0];
    crumbs.push({ name: SECTION[sec] ?? route.title, url: `${SITE}/${sec}` });
    if (parts.length > 1) crumbs.push({ name: route.title, url });
  }
  const graph: Record<string, unknown>[] = [
    {
      "@type": "WebPage",
      "@id": `${url}#webpage`,
      url,
      name: route.title,
      description: route.description,
      inLanguage: "en-US",
      isPartOf: { "@id": `${SITE}/#website` },
      publisher: { "@id": `${SITE}/#organization` },
    },
  ];
  if (crumbs.length > 1) {
    graph.push({
      "@type": "BreadcrumbList",
      itemListElement: crumbs.map((c, i) => ({ "@type": "ListItem", position: i + 1, name: c.name, item: c.url })),
    });
  }
  const isArticle = (parts[0] === "guides" || parts[0] === "compare") && parts.length > 1;
  if (isArticle) {
    graph.push({
      "@type": parts[0] === "guides" ? "TechArticle" : "Article",
      headline: route.title,
      description: route.description,
      url,
      mainEntityOfPage: { "@id": `${url}#webpage` },
      image: OG_IMAGE,
      inLanguage: "en-US",
      about: "Healthcare and clinical recruiting",
      audience: { "@type": "Audience", audienceType: "Healthcare recruiters, health systems, surgery centers and private practices" },
      author: { "@id": `${SITE}/#organization` },
      publisher: { "@id": `${SITE}/#organization` },
    });
  }
  return { "@context": "https://schema.org", "@graph": graph };
}

/** Sets title, description, canonical, social cards and structured data for one public page. */
export function applySeo(route: MarketingRoute) {
  const url = `${SITE}${route.path === "/" ? "/" : route.path}`;
  const title = route.path === "/" ? "Oslr: Smarter healthcare talent sourcing" : `${route.title} | Oslr`;
  document.title = title;
  meta("name", "description", route.description);
  meta("name", "robots", "index, follow, max-image-preview:large, max-snippet:-1");
  meta("property", "og:title", title);
  meta("property", "og:description", route.description);
  meta("property", "og:url", url);
  meta("property", "og:type", route.path.split("/").filter(Boolean).length > 1 ? "article" : "website");
  meta("name", "twitter:title", title);
  meta("name", "twitter:description", route.description);
  upsert(
    'link[rel="canonical"]',
    () => {
      const l = document.createElement("link");
      l.rel = "canonical";
      return l;
    },
    (l) => l.setAttribute("href", url),
  );
  upsert(
    'script[data-oslr-ld="page"]',
    () => {
      const s = document.createElement("script");
      s.type = "application/ld+json";
      s.dataset.oslrLd = "page";
      return s;
    },
    (s) => (s.textContent = JSON.stringify(buildJsonLd(route))),
  );
}

export function clearSeo() {
  document.head.querySelector('script[data-oslr-ld="page"]')?.remove();
  document.head.querySelector('meta[name="robots"]')?.remove();
}
