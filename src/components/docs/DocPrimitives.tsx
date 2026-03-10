import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ArrowLeft, Info } from "lucide-react";
import { getNextPage, getPrevPage } from "@/data/docs-navigation";

/* ── Reusable doc primitives ── */

export function DocCallout({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-muted/40 px-6 py-4 text-base text-muted-foreground my-6 leading-relaxed">
      {children}
    </div>
  );
}

export function DocTip({ children }: { children: ReactNode }) {
  return (
    <div className="flex gap-3 rounded-xl border border-primary/20 bg-primary/5 px-5 py-4 my-6 text-sm">
      <Info className="h-5 w-5 text-primary shrink-0 mt-0.5" />
      <div className="text-foreground/80 leading-relaxed">{children}</div>
    </div>
  );
}

export function DocHeading({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h2 id={id} className="text-2xl font-bold font-display text-foreground mt-12 mb-4 scroll-mt-20">
      {children}
    </h2>
  );
}

export function DocH3({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h3 id={id} className="text-lg font-semibold font-display text-foreground mt-8 mb-3 scroll-mt-20">
      {children}
    </h3>
  );
}

export function DocParagraph({ children }: { children: ReactNode }) {
  return <p className="text-muted-foreground leading-relaxed mb-4">{children}</p>;
}

export function DocList({ items }: { items: string[] }) {
  return (
    <ul className="list-disc list-inside space-y-1.5 text-muted-foreground mb-6 ml-1">
      {items.map((item, i) => (
        <li key={i} className="leading-relaxed">{item}</li>
      ))}
    </ul>
  );
}

export function DocNav({ slug }: { slug: string }) {
  const prev = getPrevPage(slug);
  const next = getNextPage(slug);

  return (
    <div className="flex items-center justify-between mt-16 pt-6 border-t border-border">
      {prev ? (
        <Link
          to={`/docs/${prev.slug}`}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          {prev.title}
        </Link>
      ) : (
        <div />
      )}
      {next ? (
        <Link
          to={`/docs/${next.slug}`}
          className="flex items-center gap-2 text-sm text-primary hover:text-primary/80 font-medium transition-colors"
        >
          Next: {next.title}
          <ArrowRight className="h-4 w-4" />
        </Link>
      ) : (
        <div />
      )}
    </div>
  );
}

/* ── Table of Contents ── */

export interface TocItem {
  id: string;
  label: string;
  level?: number;
}

export function DocToc({ items }: { items: TocItem[] }) {
  if (items.length === 0) return null;
  return (
    <nav className="hidden xl:block w-56 shrink-0 sticky top-14 h-[calc(100vh-3.5rem)] py-8 px-4 overflow-auto">
      <ul className="space-y-2 text-sm">
        {items.map((item) => (
          <li key={item.id}>
            <a
              href={`#${item.id}`}
              className={`block text-muted-foreground hover:text-foreground transition-colors ${
                item.level === 3 ? "pl-3" : ""
              }`}
            >
              {item.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/* ── Page wrapper ── */

export function DocPage({
  title,
  description,
  slug,
  toc,
  children,
}: {
  title: string;
  description: string;
  slug: string;
  toc: TocItem[];
  children: ReactNode;
}) {
  return (
    <div className="flex">
      <div className="flex-1 min-w-0 max-w-3xl mx-auto px-6 md:px-10 py-10">
        <h1 className="text-4xl font-bold font-display text-foreground mb-2">{title}</h1>
        <DocCallout>{description}</DocCallout>
        {children}
        <DocNav slug={slug} />
      </div>
      <DocToc items={toc} />
    </div>
  );
}
