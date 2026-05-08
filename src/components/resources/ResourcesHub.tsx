import { articlesByCategory, RESOURCE_ARTICLES } from "@/content/resources/manifest";
import { ArticleCard } from "./ArticleCard";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-xl font-display font-semibold text-foreground mb-4">{title}</h2>
      {children}
    </section>
  );
}

export function ResourcesHub() {
  const gettingStarted = articlesByCategory("getting-started");
  const productGuides = articlesByCategory("product-guides");
  const bestPractices = articlesByCategory("best-practices");
  const templates = articlesByCategory("templates");

  return (
    <div className="max-w-6xl mx-auto space-y-10">
      <header>
        <h1 className="text-3xl font-display font-semibold text-foreground">Resources</h1>
        <p className="text-muted-foreground mt-1">
          Product guides, best practices, and email templates for Oslr.
        </p>
      </header>

      <Section title="Getting started">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {gettingStarted.map((a) => (
            <ArticleCard key={a.slug} article={a} />
          ))}
        </div>
      </Section>

      <Section title="Product guides">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {productGuides.map((a) => (
            <ArticleCard key={a.slug} article={a} />
          ))}
        </div>
      </Section>

      <Section title="Best practices">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {bestPractices.map((a) => (
            <ArticleCard key={a.slug} article={a} />
          ))}
        </div>
      </Section>

      <Section title="Email templates">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {templates.map((a) => (
            <ArticleCard key={a.slug} article={a} />
          ))}
        </div>
      </Section>
    </div>
  );
}
