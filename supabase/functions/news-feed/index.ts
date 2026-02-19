import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

export interface NewsArticle {
  id: string;
  title: string;
  description: string;
  url: string;
  source: string;
  sourceIcon: string;
  publishedAt: string;
  category: string;
}

// ─── VERIFIED WORKING RSS FEEDS ──────────────────────────────────────────────
// Each URL was tested and confirmed to return valid RSS XML with articles.
const FEEDS = [
  // ── Google News (free, comprehensive, no API key) ─────────────────────────
  {
    url: "https://news.google.com/rss/search?q=healthcare+recruiting+nurse+staffing&hl=en-US&gl=US&ceid=US:en",
    source: "Google News",
    category: "Recruiting",
  },
  {
    url: "https://news.google.com/rss/search?q=nursing+shortage+travel+nurses+2025&hl=en-US&gl=US&ceid=US:en",
    source: "Google News",
    category: "Nursing",
  },
  {
    url: "https://news.google.com/rss/search?q=physician+staffing+locum+tenens+recruitment&hl=en-US&gl=US&ceid=US:en",
    source: "Google News",
    category: "Physicians",
  },
  {
    url: "https://news.google.com/rss/search?q=hospital+workforce+burnout+retention+2025&hl=en-US&gl=US&ceid=US:en",
    source: "Google News",
    category: "Workforce",
  },
  {
    url: "https://news.google.com/rss/search?q=healthcare+hiring+trends+salary+2025&hl=en-US&gl=US&ceid=US:en",
    source: "Google News",
    category: "Trends",
  },
  {
    url: "https://news.google.com/rss/search?q=CRNA+anesthesia+staffing+shortage&hl=en-US&gl=US&ceid=US:en",
    source: "Google News",
    category: "Anesthesia",
  },
  {
    url: "https://news.google.com/rss/search?q=orthopedic+surgeon+recruitment+orthopedics&hl=en-US&gl=US&ceid=US:en",
    source: "Google News",
    category: "Physicians",
  },
  {
    url: "https://news.google.com/rss/search?q=site:staffingindustry.com+healthcare+nurses&hl=en-US&gl=US&ceid=US:en",
    source: "Staffing Industry Analysts",
    category: "Staffing",
  },

  // ── Becker's Healthcare (verified working feeds) ──────────────────────────
  {
    url: "https://www.beckershospitalreview.com/feed/",
    source: "Becker's Hospital Review",
    category: "Industry",
  },
  {
    url: "https://www.beckersasc.com/feed/",
    source: "Becker's ASC Review",
    category: "Staffing",
  },
  {
    url: "https://www.beckershospitalreview.com/healthcare-information-technology/feed/",
    source: "Becker's Health IT",
    category: "Trends",
  },
  {
    url: "https://www.beckershospitalreview.com/finance/feed/",
    source: "Becker's Hospital CFO",
    category: "Industry",
  },

  // ── Healthcare Dive (verified working) ────────────────────────────────────
  {
    url: "https://www.healthcaredive.com/feeds/news/",
    source: "Healthcare Dive",
    category: "Industry",
  },

  // ── Fierce Healthcare (verified working) ─────────────────────────────────
  {
    url: "https://www.fiercehealthcare.com/rss/xml",
    source: "Fierce Healthcare",
    category: "Industry",
  },

  // ── Additional Google News topic feeds ────────────────────────────────────
  {
    url: "https://news.google.com/rss/search?q=emergency+medicine+physician+jobs&hl=en-US&gl=US&ceid=US:en",
    source: "Google News",
    category: "Physicians",
  },
  {
    url: "https://news.google.com/rss/search?q=healthcare+labor+union+contract+nurses&hl=en-US&gl=US&ceid=US:en",
    source: "Google News",
    category: "Workforce",
  },
  {
    url: "https://news.google.com/rss/search?q=AMN+healthcare+cross+country+staffing+agency&hl=en-US&gl=US&ceid=US:en",
    source: "Google News",
    category: "Staffing",
  },
  {
    url: "https://news.google.com/rss/search?q=nurse+practitioner+physician+assistant+demand&hl=en-US&gl=US&ceid=US:en",
    source: "Google News",
    category: "Recruiting",
  },
];

function parseRSS(xml: string, defaultSource: string, defaultCategory: string): NewsArticle[] {
  const articles: NewsArticle[] = [];
  const itemMatches = xml.matchAll(/<item>([\s\S]*?)<\/item>/g);

  for (const match of itemMatches) {
    const item = match[1];

    // Title: strip any embedded HTML tags (Fierce wraps titles in <a> tags)
    const rawTitle = extractTag(item, "title");
    const title = decodeEntities(stripHtml(rawTitle));

    const rawDesc = extractTag(item, "description") || extractTag(item, "summary") || "";
    const description = decodeEntities(stripHtml(rawDesc));
    const url = extractLink(item);
    const pubDate = extractTag(item, "pubDate") || extractTag(item, "dc:date") || "";

    // Extract source name if embedded (Google News includes <source> tags)
    const sourceTag = decodeEntities(extractTag(item, "source"));
    const source = sourceTag || defaultSource;

    if (!title || !url || title.length < 10) continue;

    // For Google News feeds, filter to healthcare-relevant only
    if (defaultSource === "Google News") {
      const lowerTitle = title.toLowerCase();
      const relevant =
        lowerTitle.includes("health") ||
        lowerTitle.includes("nurs") ||
        lowerTitle.includes("hospital") ||
        lowerTitle.includes("physician") ||
        lowerTitle.includes("medical") ||
        lowerTitle.includes("surgeon") ||
        lowerTitle.includes("clinic") ||
        lowerTitle.includes("staff") ||
        lowerTitle.includes("recruit") ||
        lowerTitle.includes("workforce") ||
        lowerTitle.includes("patient") ||
        lowerTitle.includes("crna") ||
        lowerTitle.includes("anesthesia") ||
        lowerTitle.includes("locum") ||
        lowerTitle.includes("icu") ||
        lowerTitle.includes("emt") ||
        lowerTitle.includes("labor") ||
        lowerTitle.includes("care");
      if (!relevant) continue;
    }

    let publishedAt: string;
    try {
      publishedAt = pubDate ? new Date(pubDate).toISOString() : new Date().toISOString();
    } catch {
      publishedAt = new Date().toISOString();
    }

    articles.push({
      id: generateId(url),
      title,
      description: description.slice(0, 280),
      url: url,
      source,
      sourceIcon: getSourceIcon(source),
      publishedAt,
      category: defaultCategory,
    });

    if (articles.length >= 10) break;
  }

  return articles;
}

function extractTag(xml: string, tag: string): string {
  // CDATA
  const cdataMatch = xml.match(new RegExp(`<${tag}[^>]*>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>`, "i"));
  if (cdataMatch) return cdataMatch[1].trim();
  // Normal tag
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  if (match) return match[1].trim();
  return "";
}

function extractLink(item: string): string {
  // Try <link> CDATA
  const cdata = item.match(/<link[^>]*><!\[CDATA\[([\s\S]*?)\]\]>/i);
  if (cdata) return cdata[1].trim();
  // Try <link>...</link>
  const tag = item.match(/<link[^>]*>([^<]+)<\/link>/i);
  if (tag) return tag[1].trim();
  // Try naked <link> followed by text before next tag (RSS 2.0 style)
  const naked = item.match(/<link\s*\/?>\s*([^\s<][^<]*)/i);
  if (naked) return naked[1].trim();
  // Fall back to guid
  return extractTag(item, "guid");
}

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, c) => String.fromCharCode(parseInt(c)));
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function generateId(url: string): string {
  let hash = 0;
  for (let i = 0; i < url.length; i++) {
    hash = (hash << 5) - hash + url.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36).padStart(8, "0");
}

function getSourceIcon(source: string): string {
  const lower = source.toLowerCase();
  if (lower.includes("becker")) return "🏥";
  if (lower.includes("modern healthcare")) return "🏨";
  if (lower.includes("fierce")) return "🔥";
  if (lower.includes("healthcare dive")) return "📊";
  if (lower.includes("staffing industry")) return "👔";
  if (lower.includes("health it")) return "💻";
  if (lower.includes("asc")) return "🏨";
  if (lower.includes("cfo")) return "💰";
  return "📰";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const results = await Promise.allSettled(
      FEEDS.map(async (feed) => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 7000);
        try {
          const res = await fetch(feed.url, {
            signal: controller.signal,
            headers: {
              "User-Agent": "Mozilla/5.0 (compatible; MedSourceAI/1.0; RSS Reader)",
              Accept: "application/rss+xml, application/xml, text/xml, */*",
            },
          });
          clearTimeout(timer);
          if (!res.ok) {
            console.error(`Feed ${feed.source} failed: HTTP ${res.status}`);
            return { articles: [], source: feed.source, ok: false };
          }
          const xml = await res.text();
          const articles = parseRSS(xml, feed.source, feed.category);
          console.log(`Feed ${feed.source} (${feed.category}): ${articles.length} articles`);
          return { articles, source: feed.source, ok: true };
        } catch (err: any) {
          clearTimeout(timer);
          console.error(`Feed ${feed.source} error: ${err.message}`);
          return { articles: [], source: feed.source, ok: false };
        }
      })
    );

    // Flatten and deduplicate
    const allArticles: NewsArticle[] = [];
    const seenIds = new Set<string>();

    for (const result of results) {
      if (result.status === "fulfilled") {
        for (const article of result.value.articles) {
          if (!seenIds.has(article.id)) {
            seenIds.add(article.id);
            allArticles.push(article);
          }
        }
      }
    }

    // Sort newest first
    allArticles.sort(
      (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    );

    const categories = [...new Set(FEEDS.map((f) => f.category))];
    const sourceSummary = results
      .filter((r) => r.status === "fulfilled")
      .map((r: any) => ({ source: r.value.source, count: r.value.articles.length, ok: r.value.ok }));

    console.log(`Total articles: ${allArticles.length}`);

    return new Response(
      JSON.stringify({ articles: allArticles, categories, total: allArticles.length, sourceSummary }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("News feed error:", err.message);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
