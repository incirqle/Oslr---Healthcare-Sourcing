import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import {
  ExternalLink,
  RefreshCw,
  Newspaper,
  Clock,
  AlertCircle,
  Bookmark,
  BookmarkCheck,
  Search,
  LayoutGrid,
  List,
  TrendingUp,
  Filter,
  X,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
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

const SOURCE_URLS: Record<string, string> = {
  "Becker's Hospital Review": "https://www.beckershospitalreview.com",
  "Becker's ASC Review": "https://www.beckersasc.com",
  "Becker's Health IT": "https://www.beckershospitalreview.com/healthcare-information-technology",
  "Becker's Hospital CFO": "https://www.beckershospitalreview.com/finance",
  "Healthcare Dive": "https://www.healthcaredive.com",
  "Fierce Healthcare": "https://www.fiercehealthcare.com",
  "Staffing Industry Analysts": "https://www.staffingindustry.com",
  "Google News": "https://news.google.com",
};

const ALL_CATEGORIES = ["All", "Saved", "Recruiting", "Nursing", "Staffing", "Trends", "Workforce", "Physicians", "Anesthesia", "Industry"];
const SORT_OPTIONS = ["Newest", "Oldest", "Source A–Z"] as const;
type SortOption = typeof SORT_OPTIONS[number];

function ArticleSkeleton({ layout }: { layout: "grid" | "list" }) {
  if (layout === "list") {
    return (
      <div className="rounded-xl border border-border p-4 flex gap-4">
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-16" />
          </div>
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-4 w-3/5" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
    );
  }
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

function ArticleCard({
  article,
  isSaved,
  onToggleSave,
  isSaving,
  layout,
  onSourceClick,
}: {
  article: NewsArticle;
  isSaved: boolean;
  onToggleSave: (article: NewsArticle) => void;
  isSaving: boolean;
  layout: "grid" | "list";
  onSourceClick: (source: string) => void;
}) {
  const categoryClass = CATEGORY_COLORS[article.category] || CATEGORY_COLORS.Industry;
  const timeAgo = (() => {
    try {
      return formatDistanceToNow(new Date(article.publishedAt), { addSuffix: true });
    } catch {
      return "";
    }
  })();
  const sourceUrl = SOURCE_URLS[article.source];

  if (layout === "list") {
    return (
      <div className="group relative rounded-xl border border-border bg-card px-5 py-4 hover:border-primary/30 hover:shadow-sm transition-all duration-200 flex items-start gap-4">
        {/* Bookmark */}
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggleSave(article); }}
          disabled={isSaving}
          title={isSaved ? "Remove from reading list" : "Save to reading list"}
          className={`shrink-0 mt-0.5 rounded-md p-1.5 transition-all duration-150 ${
            isSaved
              ? "text-primary bg-primary/10 hover:bg-primary/20"
              : "text-muted-foreground/40 hover:text-primary hover:bg-primary/10 opacity-0 group-hover:opacity-100"
          }`}
        >
          {isSaved ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
        </button>

        <div className="flex-1 min-w-0">
          {/* Meta row */}
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <span className="text-sm">{article.sourceIcon}</span>
            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onSourceClick(article.source); }}
              className="text-xs font-medium text-muted-foreground hover:text-primary transition-colors"
            >
              {article.source}
            </button>
            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${categoryClass}`}>
              {article.category}
            </Badge>
            {timeAgo && (
              <span className="text-[11px] text-muted-foreground/50 flex items-center gap-1">
                <Clock className="h-2.5 w-2.5" />
                {timeAgo}
              </span>
            )}
          </div>
          <a href={article.url} target="_blank" rel="noopener noreferrer" className="block group/link">
            <h3 className="text-sm font-semibold text-foreground leading-snug group-hover/link:text-primary transition-colors line-clamp-1">
              {article.title}
            </h3>
            {article.description && (
              <p className="text-xs text-muted-foreground leading-relaxed line-clamp-1 mt-0.5">
                {article.description}
              </p>
            )}
          </a>
        </div>

        <a href={article.url} target="_blank" rel="noopener noreferrer" className="shrink-0 mt-1">
          <ExternalLink className="h-3.5 w-3.5 text-muted-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity" />
        </a>
      </div>
    );
  }

  return (
    <div className="group relative rounded-xl border border-border bg-card p-5 hover:border-primary/30 hover:shadow-md transition-all duration-200 flex flex-col">
      {/* Bookmark button */}
      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggleSave(article); }}
        disabled={isSaving}
        title={isSaved ? "Remove from reading list" : "Save to reading list"}
        className={`absolute top-4 right-4 z-10 rounded-md p-1.5 transition-all duration-150 ${
          isSaved
            ? "text-primary bg-primary/10 hover:bg-primary/20"
            : "text-muted-foreground/40 hover:text-primary hover:bg-primary/10 opacity-0 group-hover:opacity-100"
        }`}
      >
        {isSaved ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
      </button>

      <div className="flex items-center gap-2 flex-wrap mb-3 pr-8">
        <span className="text-base">{article.sourceIcon}</span>
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onSourceClick(article.source); }}
          className="text-xs font-medium text-muted-foreground hover:text-primary transition-colors underline-offset-2 hover:underline"
        >
          {article.source}
        </button>
        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${categoryClass}`}>
          {article.category}
        </Badge>
      </div>

      <a href={article.url} target="_blank" rel="noopener noreferrer" className="flex flex-col flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="text-sm font-semibold text-foreground leading-snug group-hover:text-primary transition-colors line-clamp-2 flex-1">
            {article.title}
          </h3>
          <ExternalLink className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity mt-0.5" />
        </div>

        {article.description && (
          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2 mb-3">
            {article.description}
          </p>
        )}

        {timeAgo && (
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground/60 mt-auto pt-2">
            <Clock className="h-3 w-3" />
            {timeAgo}
            {sourceUrl && (
              <>
                <span className="mx-1 opacity-40">·</span>
                <a
                  href={sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="hover:text-primary transition-colors hover:underline"
                >
                  Visit source ↗
                </a>
              </>
            )}
          </div>
        )}
      </a>
    </div>
  );
}

// ── Source stats sidebar card ─────────────────────────────────────────────────
function SourceItem({
  icon,
  name,
  count,
  isActive,
  onClick,
}: {
  icon: string;
  name: string;
  count: number;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-xs transition-all duration-150 ${
        isActive
          ? "bg-primary/10 text-primary font-medium"
          : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
      }`}
    >
      <span className="flex items-center gap-2 min-w-0">
        <span className="text-sm shrink-0">{icon}</span>
        <span className="truncate">{name}</span>
      </span>
      <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
        isActive ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
      }`}>
        {count}
      </span>
    </button>
  );
}

export default function News() {
  const [activeCategory, setActiveCategory] = useState("All");
  const [activeSource, setActiveSource] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [layout, setLayout] = useState<"grid" | "list">("grid");
  const [sortBy, setSortBy] = useState<SortOption>("Newest");
  const [showFilters, setShowFilters] = useState(false);
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["news-feed"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("news-feed", {});
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as { articles: NewsArticle[]; total: number };
    },
    staleTime: 1000 * 60 * 10,
    refetchOnWindowFocus: false,
  });

  const { data: savedArticles } = useQuery({
    queryKey: ["reading-list", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("reading_list" as any)
        .select("article_id, title, description, url, source, source_icon, published_at, category")
        .eq("user_id", user.id);
      if (error) throw error;
      return data as any[];
    },
    enabled: !!user,
  });

  const savedIds = new Set((savedArticles ?? []).map((a: any) => a.article_id));

  const { mutate: toggleSave, isPending: isSaving } = useMutation({
    mutationFn: async (article: NewsArticle) => {
      if (!user) throw new Error("Not authenticated");
      if (savedIds.has(article.id)) {
        const { error } = await supabase
          .from("reading_list" as any)
          .delete()
          .eq("user_id", user.id)
          .eq("article_id", article.id);
        if (error) throw error;
        return { action: "removed" };
      } else {
        const { error } = await supabase
          .from("reading_list" as any)
          .insert({
            user_id: user.id,
            article_id: article.id,
            title: article.title,
            description: article.description,
            url: article.url,
            source: article.source,
            source_icon: article.sourceIcon,
            published_at: article.publishedAt,
            category: article.category,
          });
        if (error) throw error;
        return { action: "saved" };
      }
    },
    onSuccess: ({ action }) => {
      queryClient.invalidateQueries({ queryKey: ["reading-list", user?.id] });
      toast({
        title: action === "saved" ? "Saved to reading list" : "Removed from reading list",
        description: action === "saved"
          ? "Find it under the Saved tab."
          : "Article removed from your reading list.",
      });
    },
    onError: () => {
      toast({ title: "Something went wrong", description: "Please try again.", variant: "destructive" });
    },
  });

  const articles = data?.articles ?? [];

  // Build source stats from live articles
  const sourceCounts = useMemo(() => {
    const map: Record<string, { icon: string; count: number }> = {};
    for (const a of articles) {
      if (!map[a.source]) map[a.source] = { icon: a.sourceIcon, count: 0 };
      map[a.source].count++;
    }
    return Object.entries(map)
      .sort((a, b) => b[1].count - a[1].count)
      .map(([name, { icon, count }]) => ({ name, icon, count }));
  }, [articles]);

  // Filtered & sorted articles
  const filtered = useMemo(() => {
    if (activeCategory === "Saved") {
      return (savedArticles ?? []).map((a: any) => ({
        id: a.article_id,
        title: a.title,
        description: a.description ?? "",
        url: a.url,
        source: a.source,
        sourceIcon: a.source_icon ?? "📰",
        publishedAt: a.published_at ?? "",
        category: a.category ?? "Industry",
      })) as NewsArticle[];
    }

    let list = activeCategory === "All" ? articles : articles.filter((a) => a.category === activeCategory);
    if (activeSource) list = list.filter((a) => a.source === activeSource);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((a) =>
        a.title.toLowerCase().includes(q) ||
        a.description.toLowerCase().includes(q) ||
        a.source.toLowerCase().includes(q)
      );
    }
    if (sortBy === "Oldest") list = [...list].sort((a, b) => new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime());
    else if (sortBy === "Source A–Z") list = [...list].sort((a, b) => a.source.localeCompare(b.source));
    // Newest is default (already sorted newest-first from API)
    return list;
  }, [activeCategory, activeSource, articles, savedArticles, search, sortBy]);

  const hasActiveFilters = !!activeSource || search.trim().length > 0 || sortBy !== "Newest";

  const handleSourceClick = (source: string) => {
    setActiveCategory("All");
    setActiveSource((prev) => (prev === source ? null : source));
  };

  const clearFilters = () => {
    setActiveSource(null);
    setSearch("");
    setSortBy("Newest");
  };

  return (
    <AppLayout>
      <div className="space-y-5">
        {/* ── Header ── */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold font-display text-foreground">Healthcare News</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Live feed from top healthcare recruiting publications · {articles.length} articles
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
            >
              <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isFetching ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* ── Search + controls bar ── */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Search */}
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              placeholder="Search articles…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-9 pl-9 pr-3 rounded-lg border border-border bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Sort */}
          <div className="relative">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="h-9 pl-3 pr-8 rounded-lg border border-border bg-background text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring appearance-none cursor-pointer"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          </div>

          {/* Layout toggle */}
          <div className="flex items-center rounded-lg border border-border overflow-hidden">
            <button
              onClick={() => setLayout("grid")}
              className={`p-2 transition-colors ${layout === "grid" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-secondary"}`}
              title="Grid view"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setLayout("list")}
              className={`p-2 transition-colors ${layout === "list" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-secondary"}`}
              title="List view"
            >
              <List className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Filter toggle (mobile) */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-1.5 h-9 px-3 rounded-lg border border-border text-xs font-medium transition-colors ${
              showFilters ? "bg-primary text-primary-foreground border-primary" : "bg-background text-muted-foreground hover:bg-secondary"
            }`}
          >
            <Filter className="h-3.5 w-3.5" />
            Filters
            {hasActiveFilters && <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />}
          </button>

          {/* Clear filters */}
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-3 w-3" />
              Clear
            </button>
          )}
        </div>

        {/* ── Category pills ── */}
        <div className="flex items-center gap-2 flex-wrap">
          {ALL_CATEGORIES.map((cat) => {
            const isSavedTab = cat === "Saved";
            const count = isSavedTab
              ? (savedArticles?.length ?? 0)
              : cat === "All"
              ? articles.length
              : articles.filter((a) => a.category === cat).length;

            return (
              <button
                key={cat}
                onClick={() => { setActiveCategory(cat); setActiveSource(null); }}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-150 border flex items-center gap-1.5 ${
                  activeCategory === cat
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-secondary/50 text-muted-foreground border-border hover:border-primary/30 hover:text-foreground"
                }`}
              >
                {isSavedTab && <Bookmark className="h-3 w-3" />}
                {cat}
                <span className="opacity-60">{count}</span>
              </button>
            );
          })}
        </div>

        {/* ── Active source pill ── */}
        {activeSource && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Filtered by source:</span>
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium border border-primary/20">
              {sourceCounts.find((s) => s.name === activeSource)?.icon} {activeSource}
              <button onClick={() => setActiveSource(null)} className="ml-1 hover:text-primary/70">
                <X className="h-3 w-3" />
              </button>
            </span>
          </div>
        )}

        {/* ── Main content: articles + sidebar ── */}
        <div className="flex gap-6 items-start">
          {/* Articles column */}
          <div className="flex-1 min-w-0 space-y-4">
            {/* Error */}
            {isError && activeCategory !== "Saved" && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="rounded-full bg-destructive/10 p-4 mb-4">
                  <AlertCircle className="h-8 w-8 text-destructive" />
                </div>
                <p className="text-sm font-medium text-foreground mb-1">Failed to load news</p>
                <p className="text-xs text-muted-foreground mb-4">There was a problem fetching the latest articles.</p>
                <Button variant="outline" size="sm" onClick={() => refetch()}>Try Again</Button>
              </div>
            )}

            {/* Saved empty state */}
            {activeCategory === "Saved" && filtered.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="rounded-full bg-muted p-4 mb-4">
                  <Bookmark className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium text-foreground mb-1">No saved articles yet</p>
                <p className="text-xs text-muted-foreground">
                  Click the bookmark icon on any article to save it here for later.
                </p>
              </div>
            )}

            {/* Loading skeletons */}
            {isLoading && activeCategory !== "Saved" && (
              <div className={layout === "grid" ? "grid gap-4 md:grid-cols-2 xl:grid-cols-3" : "flex flex-col gap-3"}>
                {Array.from({ length: 9 }).map((_, i) => <ArticleSkeleton key={i} layout={layout} />)}
              </div>
            )}

            {/* Empty search result */}
            {!isLoading && filtered.length === 0 && !isError && activeCategory !== "Saved" && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="rounded-full bg-muted p-4 mb-4">
                  <Newspaper className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium text-foreground mb-1">No articles found</p>
                <p className="text-xs text-muted-foreground mb-4">
                  {search ? `No results for "${search}"` : "Try selecting a different category or refreshing."}
                </p>
                {hasActiveFilters && (
                  <Button variant="outline" size="sm" onClick={clearFilters}>Clear Filters</Button>
                )}
              </div>
            )}

            {/* Articles */}
            {!isLoading && filtered.length > 0 && (
              <>
                <div className={layout === "grid"
                  ? "grid gap-4 md:grid-cols-2 xl:grid-cols-3"
                  : "flex flex-col gap-2"
                }>
                  {filtered.map((article) => (
                    <ArticleCard
                      key={article.id}
                      article={article}
                      isSaved={savedIds.has(article.id)}
                      onToggleSave={toggleSave}
                      isSaving={isSaving}
                      layout={layout}
                      onSourceClick={handleSourceClick}
                    />
                  ))}
                </div>
                <p className="text-center text-xs text-muted-foreground pb-2">
                  {activeCategory === "Saved"
                    ? `${filtered.length} saved article${filtered.length !== 1 ? "s" : ""} in your reading list`
                    : `Showing ${filtered.length}${articles.length !== filtered.length ? ` of ${articles.length}` : ""} articles · Refreshes every 10 min`}
                </p>
              </>
            )}
          </div>

          {/* ── Source sidebar ── */}
          {activeCategory !== "Saved" && !isLoading && sourceCounts.length > 0 && (
            <div className="hidden xl:block w-56 shrink-0">
              <div className="rounded-xl border border-border bg-card p-4 sticky top-20 space-y-3">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs font-semibold text-foreground">Sources</span>
                </div>
                <div className="space-y-0.5">
                  {sourceCounts.map(({ name, icon, count }) => (
                    <SourceItem
                      key={name}
                      icon={icon}
                      name={name}
                      count={count}
                      isActive={activeSource === name}
                      onClick={() => handleSourceClick(name)}
                    />
                  ))}
                </div>
                {activeSource && (
                  <button
                    onClick={() => setActiveSource(null)}
                    className="w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors pt-1 border-t border-border"
                  >
                    Show all sources
                  </button>
                )}

                {/* Source links */}
                <div className="pt-2 border-t border-border space-y-1">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Visit Sources</p>
                  {Object.entries(SOURCE_URLS).map(([name, url]) => (
                    <a
                      key={name}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between text-xs text-muted-foreground hover:text-primary transition-colors py-0.5 group/src"
                    >
                      <span className="truncate">{name}</span>
                      <ExternalLink className="h-2.5 w-2.5 shrink-0 opacity-0 group-hover/src:opacity-100 ml-1" />
                    </a>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
