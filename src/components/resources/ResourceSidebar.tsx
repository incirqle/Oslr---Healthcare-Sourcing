import { Link, useLocation } from "react-router-dom";
import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  RESOURCE_ARTICLES,
} from "@/content/resources/manifest";
import { cn } from "@/lib/utils";

export function ResourceSidebar() {
  const { pathname } = useLocation();
  const currentSlug = pathname.replace(/^\/resources\/?/, "");

  return (
    <nav className="space-y-6">
      {CATEGORY_ORDER.map((cat) => {
        const items = RESOURCE_ARTICLES.filter((a) => a.category === cat).sort(
          (a, b) => a.order - b.order,
        );
        return (
          <div key={cat}>
            <h4 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-2 px-2">
              {CATEGORY_LABELS[cat]}
            </h4>
            <ul className="space-y-0.5">
              {items.map((a) => {
                const isActive = currentSlug === a.slug;
                return (
                  <li key={a.slug}>
                    <Link
                      to={`/resources/${a.slug}`}
                      className={cn(
                        "block rounded-md px-2.5 py-1.5 text-sm transition-colors",
                        isActive
                          ? "bg-primary/15 text-primary font-medium"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
                      )}
                    >
                      {a.title}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}
