import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useNavigate } from "react-router-dom";
import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  RESOURCE_ARTICLES,
  ResourceArticle,
  findArticle,
} from "@/content/resources/manifest";
import { ResourceSidebar } from "./ResourceSidebar";
import { ArticleContent } from "./ArticleContent";
import { PreviewBanner } from "./PreviewBanner";

// Eagerly load every markdown file as a raw string at build time.
const MD_FILES = import.meta.glob("/src/content/resources/**/*.md", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

function getMarkdown(slug: string): string | null {
  const path = `/src/content/resources/${slug}.md`;
  return MD_FILES[path] ?? null;
}

function MobileArticleSelect({ current }: { current: ResourceArticle }) {
  const navigate = useNavigate();
  return (
    <div className="md:hidden mb-4">
      <Select
        value={current.slug}
        onValueChange={(v) => navigate(`/resources/${v}`)}
      >
        <SelectTrigger>
          <SelectValue placeholder="Browse all articles" />
        </SelectTrigger>
        <SelectContent>
          {CATEGORY_ORDER.map((cat) => (
            <div key={cat}>
              <div className="px-2 pt-2 pb-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                {CATEGORY_LABELS[cat]}
              </div>
              {RESOURCE_ARTICLES.filter((a) => a.category === cat).map((a) => (
                <SelectItem key={a.slug} value={a.slug}>
                  {a.title}
                </SelectItem>
              ))}
            </div>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function ResourceArticlePage({ slug }: { slug: string }) {
  const article = findArticle(slug);
  const markdown = getMarkdown(slug);

  if (!article || !markdown) {
    return (
      <div className="max-w-2xl mx-auto py-12 text-center">
        <h2 className="text-xl font-semibold">Article not found</h2>
        <Link to="/resources" className="text-primary hover:underline mt-2 inline-block">
          Back to Resources
        </Link>
      </div>
    );
  }

  const categoryLabel = CATEGORY_LABELS[article.category];
  // Category index path only exists for best-practices and templates
  const hasCategoryIndex =
    article.category === "best-practices" || article.category === "templates";
  const categoryHref = hasCategoryIndex ? `/resources/${article.category}` : null;

  return (
    <div className="max-w-7xl mx-auto flex gap-8">
      {/* Sidebar - desktop only */}
      <aside className="hidden md:block w-64 shrink-0">
        <div className="sticky top-20">
          <ResourceSidebar />
        </div>
      </aside>

      {/* Article content — ~70ch reading column for legibility */}
      <div className="flex-1 min-w-0 max-w-[680px] py-8">
        {/* Breadcrumb */}
        <nav className="mb-4 flex items-center gap-1.5 text-sm text-muted-foreground flex-wrap">
          <Link to="/resources" className="hover:text-foreground">Resources</Link>
          <ChevronRight className="h-3.5 w-3.5" />
          {categoryHref ? (
            <Link to={categoryHref} className="hover:text-foreground">{categoryLabel}</Link>
          ) : (
            <span>{categoryLabel}</span>
          )}
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-foreground">{article.title}</span>
        </nav>

        <MobileArticleSelect current={article} />

        {article.preview && <PreviewBanner />}

        <ArticleContent markdown={markdown} />
      </div>
    </div>
  );
}
