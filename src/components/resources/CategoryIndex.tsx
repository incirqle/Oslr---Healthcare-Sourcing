import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import {
  CATEGORY_LABELS,
  ResourceCategory,
  articlesByCategory,
} from "@/content/resources/manifest";
import { ArticleCard } from "./ArticleCard";

export function CategoryIndex({ category }: { category: ResourceCategory }) {
  const articles = articlesByCategory(category);
  const label = CATEGORY_LABELS[category];

  return (
    <div className="max-w-5xl mx-auto">
      <nav className="mb-4 flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link to="/resources" className="hover:text-foreground">Resources</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-foreground">{label}</span>
      </nav>

      <h1 className="text-3xl font-display font-semibold mb-6">{label}</h1>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {articles.map((a) => (
          <ArticleCard key={a.slug} article={a} />
        ))}
      </div>
    </div>
  );
}
