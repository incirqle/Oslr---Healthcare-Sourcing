import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { ExternalLink, RefreshCw, Newspaper, Clock, AlertCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface NewsArticle {
  id: string;
  title: string;
  description: string;
  url: string;
  source: string;
  sourceIcon: string;
  publishedAt: string;
  category: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  Recruiting: "bg-primary/10 text-primary border-primary/20",
  Nursing: "bg-blue-500/10 text-blue-600 border-blue-500/20 dark:text-blue-400",
  Staffing: "bg-violet-500/10 text-violet-600 border-violet-500/20 dark:text-violet-400",
  Trends: "bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400",
  Workforce: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400",
  Physicians: "bg-rose-500/10 text-rose-600 border-rose-500/20 dark:text-rose-400",
  Industry: "bg-slate-500/10 text-slate-600 border-slate-500/20 dark:text-slate-400",
  Anesthesia: "bg-purple-500/10 text-purple-600 border-purple-500/20 dark:text-purple-400",
};

const ALL_CATEGORIES = ["All", "Recruiting", "Nursing", "Staffing", "Trends", "Workforce", "Physicians", "Anesthesia", "Industry"];

function ArticleSkeleton() {
  return (
    <div className="rounded-xl border border-border p-5 space-y-3">
      <div className="flex items-center gap-2">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-16" />
      </div>
      <Skeleton className="h-5 w-full" />
      <Skeleton className="h-5 w-4/5" />
      <Skeleton className="h-4 w-3/5" />
      <div className="flex items-center gap-2 pt-1">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-3 w-16" />
      </div>
    </div>
  );
}

function ArticleCard({ article }: { article: NewsArticle }) {
  const categoryClass = CATEGORY_COLORS[article.category] || CATEGORY_COLORS.Industry;
  const timeAgo = (() => {
    try {
      return formatDistanceToNow(new Date(article.publishedAt), { addSuffix: true });
    } catch {
      return "";
    }
  })();

  return (
    <a
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group block rounded-xl border border-border bg-card p-5 hover:border-primary/30 hover:shadow-md transition-all duration-200"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-base">{article.sourceIcon}</span>
          <span className="text-xs font-medium text-muted-foreground">{article.source}</span>
          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${categoryClass}`}>
            {article.category}
          </Badge>
        </div>
        <ExternalLink className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity mt-0.5" />
      </div>

      <h3 className="text-sm font-semibold text-foreground leading-snug mb-2 group-hover:text-primary transition-colors line-clamp-2">
        {article.title}
      </h3>

      {article.description && (
        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2 mb-3">
          {article.description}
        </p>
      )}

      {timeAgo && (
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground/60">
          <Clock className="h-3 w-3" />
          {timeAgo}
        </div>
      )}
    </a>
  );
}

export default function News() {
  const [activeCategory, setActiveCategory] = useState("All");

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["news-feed"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("news-feed", {});
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as { articles: NewsArticle[]; total: number };
    },
    staleTime: 1000 * 60 * 10, // Cache for 10 minutes
    refetchOnWindowFocus: false,
  });

  const articles = data?.articles ?? [];
  const filtered = activeCategory === "All"
    ? articles
    : articles.filter((a) => a.category === activeCategory);

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold font-display text-foreground">Healthcare News</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Live feed from the top healthcare recruiting publications and news outlets
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="shrink-0"
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        {/* Category filter pills */}
        <div className="flex items-center gap-2 flex-wrap">
          {ALL_CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-150 border ${
                activeCategory === cat
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-secondary/50 text-muted-foreground border-border hover:border-primary/30 hover:text-foreground"
              }`}
            >
              {cat}
              {cat !== "All" && data && (
                <span className="ml-1.5 opacity-60">
                  {articles.filter((a) => a.category === cat).length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Sources banner */}
        <div className="rounded-lg border border-border/60 bg-secondary/20 px-4 py-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-muted-foreground">
          <span className="font-medium text-foreground/60 flex items-center gap-1.5">
            <Newspaper className="h-3.5 w-3.5" /> Sources:
          </span>
          {["🏥 Becker's Hospital Review", "🏨 Becker's ASC Review", "💻 Becker's Health IT", "📊 Healthcare Dive", "🔥 Fierce Healthcare", "📰 Google News (8 topic feeds)"].map((s) => (
            <span key={s}>{s}</span>
          ))}
        </div>

        {/* Error state */}
        {isError && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="rounded-full bg-destructive/10 p-4 mb-4">
              <AlertCircle className="h-8 w-8 text-destructive" />
            </div>
            <p className="text-sm font-medium text-foreground mb-1">Failed to load news</p>
            <p className="text-xs text-muted-foreground mb-4">There was a problem fetching the latest articles.</p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>Try Again</Button>
          </div>
        )}

        {/* Articles grid */}
        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 9 }).map((_, i) => <ArticleSkeleton key={i} />)}
          </div>
        ) : filtered.length === 0 && !isError ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="rounded-full bg-muted p-4 mb-4">
              <Newspaper className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground mb-1">No articles in this category</p>
            <p className="text-xs text-muted-foreground">Try selecting a different category or refresh.</p>
          </div>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filtered.map((article) => (
                <ArticleCard key={article.id} article={article} />
              ))}
            </div>
            <p className="text-center text-xs text-muted-foreground pb-2">
              Showing {filtered.length} articles · Refreshes automatically every 10 minutes
            </p>
          </>
        )}
      </div>
    </AppLayout>
  );
}
