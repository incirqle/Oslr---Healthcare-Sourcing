import { useLocation, Link } from "react-router-dom";
import { docsNavigation } from "@/data/docs-navigation";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

export function DocsSidebar() {
  const { pathname } = useLocation();
  const currentSlug = pathname.replace("/docs/", "").replace("/docs", "");

  return (
    <aside className="hidden md:block w-64 shrink-0 border-r border-border">
      <ScrollArea className="h-[calc(100vh-3.5rem)] py-6 px-4">
        <nav className="space-y-6">
          {docsNavigation.map((section) => (
            <div key={section.label}>
              <h4 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-2 px-2">
                {section.label}
              </h4>
              <ul className="space-y-0.5">
                {section.pages.map((page) => {
                  const isActive = currentSlug === page.slug;
                  return (
                    <li key={page.slug}>
                      <Link
                        to={`/docs/${page.slug}`}
                        className={cn(
                          "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors",
                          isActive
                            ? "bg-primary/10 text-primary font-medium"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                        )}
                      >
                        <page.icon className="h-4 w-4 shrink-0" />
                        <span className="truncate">{page.title}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
      </ScrollArea>
    </aside>
  );
}
