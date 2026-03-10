import { Link } from "react-router-dom";
import { docsNavigation } from "@/data/docs-navigation";
import { DocsLayout } from "@/components/docs/DocsLayout";
import { ArrowRight } from "lucide-react";

export default function DocsIndex() {
  return (
    <DocsLayout>
      <div className="max-w-3xl mx-auto px-6 md:px-10 py-10">
        <h1 className="text-4xl font-bold font-display text-foreground mb-2">
          The Knowledge Base
        </h1>
        <div className="rounded-xl border border-border bg-muted/40 px-6 py-4 text-base text-muted-foreground my-6 leading-relaxed">
          Welcome to the Oslr documentation. Learn how to use AI-powered search, manage
          hiring projects, send outreach campaigns, and stay ahead with healthcare market intelligence.
        </div>

        <h2 className="text-2xl font-bold font-display text-foreground mt-10 mb-4">
          What you'll learn
        </h2>
        <ul className="list-disc list-inside space-y-1.5 text-muted-foreground mb-8 ml-1">
          <li>Using natural language AI to search 1.5B+ professional profiles</li>
          <li>Building and managing candidate pipelines with projects</li>
          <li>Creating personalized email outreach campaigns</li>
          <li>Tracking campaign performance and engagement</li>
          <li>Staying informed with the healthcare news feed</li>
        </ul>

        <Link
          to="/docs/getting-started"
          className="inline-flex items-center gap-2 bg-foreground text-background px-5 py-2.5 rounded-lg font-medium text-sm hover:bg-foreground/90 transition-colors"
        >
          Get started <ArrowRight className="h-4 w-4" />
        </Link>

        <h2 className="text-2xl font-bold font-display text-foreground mt-14 mb-6">
          Quick start
        </h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {docsNavigation.slice(0, 3).flatMap((section) =>
            section.pages.slice(0, 2).map((page) => (
              <Link
                key={page.slug}
                to={`/docs/${page.slug}`}
                className="group rounded-xl border border-border bg-card hover:bg-muted/50 p-5 transition-colors"
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="rounded-lg bg-primary/10 p-2">
                    <page.icon className="h-4 w-4 text-primary" />
                  </div>
                  <span className="font-medium text-foreground group-hover:text-primary transition-colors">
                    {page.title}
                  </span>
                </div>
              </Link>
            ))
          )}
        </div>

        <h2 className="text-2xl font-bold font-display text-foreground mt-14 mb-6">
          All sections
        </h2>
        <div className="space-y-8">
          {docsNavigation.map((section) => (
            <div key={section.label}>
              <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
                {section.label}
              </h3>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {section.pages.map((page) => (
                  <Link
                    key={page.slug}
                    to={`/docs/${page.slug}`}
                    className="flex items-center gap-2.5 rounded-lg border border-border/60 px-3.5 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                  >
                    <page.icon className="h-4 w-4 shrink-0" />
                    {page.title}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </DocsLayout>
  );
}
