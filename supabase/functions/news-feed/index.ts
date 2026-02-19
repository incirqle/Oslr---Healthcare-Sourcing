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

// Free RSS feed sources — no API key required
const FEEDS = [
  // Google News RSS (free, covers everything)
  {
    url: "https://news.google.com/rss/search?q=healthcare+recruiting+staffing&hl=en-US&gl=US&ceid=US:en",
    source: "Google News",
    category: "Recruiting",
  },
  {
    url: "https://news.google.com/rss/search?q=nursing+shortage+travel+nurses&hl=en-US&gl=US&ceid=US:en",
    source: "Google News",
    category: "Nursing",
  },
  {
    url: "https://news.google.com/rss/search?q=healthcare+hiring+trends+2025&hl=en-US&gl=US&ceid=US:en",
    source: "Google News",
    category: "Trends",
  },
  {
    url: "https://news.google.com/rss/search?q=physician+recruitment+locum+tenens&hl=en-US&gl=US&ceid=US:en",
    source: "Google News",
    category: "Physicians",
  },
  {
    url: "https://news.google.com/rss/search?q=hospital+workforce+burnout+retention&hl=en-US&gl=US&ceid=US:en",
    source: "Google News",
    category: "Workforce",
  },
  // Becker's Hospital Review — excellent free RSS
  {
    url: "https://www.beckershospitalreview.com/rss/nursing.rss",
    source: "Becker's Hospital Review",
    category: "Nursing",
  },
  {
    url: "https://www.beckershospitalreview.com/rss/human-capital-and-staffing.rss",
    source: "Becker's Hospital Review",
    category: "Staffing",
  },
  {
    url: "https://www.beckershospitalreview.com/rss/hospital-management-administration.rss",
    source: "Becker's Hospital Review",
    category: "Trends",
  },
  // Modern Healthcare
  {
    url: "https://www.modernhealthcare.com/section/workforce/rss",
    source: "Modern Healthcare",
    category: "Workforce",
  },
  // Fierce Healthcare
  {
    url: "https://www.fiercehealthcare.com/rss/xml",
    source: "Fierce Healthcare",
    category: "Industry",
  },
  // Healthcare Dive (Industry Media)
  {
    url: "https://www.healthcaredive.com/feeds/news/",
    source: "Healthcare Dive",
    category: "Industry",
  },
  // Staffing Industry Analysts (free articles)
  {
    url: "https://news.google.com/rss/search?q=site:staffingindustry.com+healthcare&hl=en-US&gl=US&ceid=US:en",
    source: "Staffing Industry Analysts",
    category: "Staffing",
  },
];

function parseRSS(xml: string, defaultSource: string, defaultCategory: string): NewsArticle[] {
  const articles: NewsArticle[] = [];

  // Extract items from RSS feed
  const itemMatches = xml.matchAll(/<item>([\s\S]*?)<\/item>/g);

  for (const match of itemMatches) {
    const item = match[1];

    const title = decodeEntities(extractTag(item, "title"));
    const description = decodeEntities(stripHtml(extractTag(item, "description") || extractTag(item, "summary") || ""));
    const url = extractTag(item, "link") || extractTag(item, "guid") || "";
    const pubDate = extractTag(item, "pubDate") || extractTag(item, "published") || "";

    // Try to extract source name for Google News items
    const sourceTag = extractTag(item, "source");
    const source = sourceTag || defaultSource;

    if (!title || !url) continue;

    // Skip duplicates and irrelevant articles
    const lowerTitle = title.toLowerCase();
    const healthcare_relevant =
      lowerTitle.includes("health") ||
      lowerTitle.includes("nurs") ||
      lowerTitle.includes("hospital") ||
      lowerTitle.includes("physician") ||
      lowerTitle.includes("medical") ||
      lowerTitle.includes("clinic") ||
      lowerTitle.includes("staff") ||
      lowerTitle.includes("recruit") ||
      lowerTitle.includes("workforce") ||
      lowerTitle.includes("patient") ||
      lowerTitle.includes("care") ||
      lowerTitle.includes("labor");

    // For Google News results, only keep relevant ones
    if (defaultSource === "Google News" && !healthcare_relevant) continue;

    articles.push({
      id: btoa(url).slice(0, 16),
      title,
      description: description.slice(0, 300),
      url: cleanUrl(url),
      source,
      sourceIcon: getSourceIcon(source),
      publishedAt: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
      category: defaultCategory,
    });

    if (articles.length >= 8) break; // Max 8 per feed
  }

  return articles;
}

function extractTag(xml: string, tag: string): string {
  // Handle CDATA
  const cdataMatch = xml.match(new RegExp(`<${tag}[^>]*>\s*<!\\[CDATA\\[([\s\S]*?)\\]\\]>\s*<\/${tag}>`, "i"));
  if (cdataMatch) return cdataMatch[1].trim();

  const match = xml.match(new RegExp(`<${tag}[^>]*>([\s\S]*?)<\/${tag}>`, "i"));
  if (match) return match[1].trim();

  // Self-closing or link without closing tag (for RSS <link>)
  const selfMatch = xml.match(new RegExp(`<${tag}[^>]*/?>([^<]*)`, "i"));
  if (selfMatch) return selfMatch[1].trim();

  return "";
}

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code)));
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function cleanUrl(url: string): string {
  // Google News redirects — try to extract the actual URL
  if (url.includes("news.google.com")) {
    return url; // Return as-is; user can follow the redirect
  }
  return url;
}

function getSourceIcon(source: string): string {
  const lower = source.toLowerCase();
  if (lower.includes("becker")) return "🏥";
  if (lower.includes("modern healthcare")) return "🏨";
  if (lower.includes("fierce")) return "🔥";
  if (lower.includes("healthcare dive")) return "📊";
  if (lower.includes("staffing industry")) return "👔";
  if (lower.includes("google")) return "📰";
  return "📰";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const category = url.searchParams.get("category") || "all";

    // Filter feeds by category if requested
    const feedsToFetch = category === "all"
      ? FEEDS
      : FEEDS.filter((f) => f.category.toLowerCase() === category.toLowerCase());

    // Fetch all feeds in parallel with a timeout
    const results = await Promise.allSettled(
      feedsToFetch.map(async (feed) => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 6000);
        try {
          const res = await fetch(feed.url, {
            signal: controller.signal,
            headers: {
              "User-Agent": "Mozilla/5.0 (compatible; MedSourceAI/1.0; +https://medsource.ai)",
              Accept: "application/rss+xml, application/xml, text/xml, */*",
            },
          });
          clearTimeout(timeout);
          if (!res.ok) return [];
          const xml = await res.text();
          return parseRSS(xml, feed.source, feed.category);
        } catch {
          clearTimeout(timeout);
          return [];
        }
      })
    );

    // Flatten, deduplicate by URL, and sort by date
    const allArticles: NewsArticle[] = [];
    const seenUrls = new Set<string>();

    for (const result of results) {
      if (result.status === "fulfilled") {
        for (const article of result.value) {
          if (!seenUrls.has(article.url)) {
            seenUrls.add(article.url);
            allArticles.push(article);
          }
        }
      }
    }

    // Sort newest first
    allArticles.sort(
      (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    );

    // Get available categories
    const categories = [...new Set(FEEDS.map((f) => f.category))];

    return new Response(
      JSON.stringify({ articles: allArticles, categories, total: allArticles.length }),
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
