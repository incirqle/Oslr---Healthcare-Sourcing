import { CATEGORY_LABELS, CATEGORY_ORDER, articlesByCategory } from "@/content/resources/manifest";
import { ArticleCard } from "./ArticleCard";

export function ResourcesHub() {
  return (
    <div className="max-w-6xl mx-auto space-y-10">
      <header>
        <h1 className="text-3xl font-display font-semibold text-foreground">Resources</h1>
        <p className="text-muted-foreground mt-1">
          Step-by-step guides with real screens for every part of Oslr: where to go, what each button does, and what it costs.
        </p>
      </header>

      {CATEGORY_ORDER.map((cat) => (
        <section key={cat}>
          <h2 className="text-xl font-display font-semibold text-foreground mb-4">{CATEGORY_LABELS[cat]}</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {articlesByCategory(cat).map((a) => (
              <ArticleCard key={a.slug} article={a} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
