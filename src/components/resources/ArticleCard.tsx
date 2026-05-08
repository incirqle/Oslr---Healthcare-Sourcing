import { Link } from "react-router-dom";
import * as Icons from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ResourceArticle } from "@/content/resources/manifest";
import { cn } from "@/lib/utils";

type IconKey = keyof typeof Icons;

export function ArticleCard({
  article,
  className,
}: {
  article: ResourceArticle;
  className?: string;
}) {
  const Icon = (Icons[article.icon as IconKey] as Icons.LucideIcon) ?? Icons.FileText;
  return (
    <Link to={`/resources/${article.slug}`} className="group block">
      <Card
        className={cn(
          "p-4 h-full border-border/60 transition-all duration-150 group-hover:-translate-y-0.5 group-hover:border-primary/60 group-hover:shadow-md",
          className,
        )}
      >
        <div className="flex items-start gap-3">
          <div className="rounded-md bg-primary/10 text-primary p-2 shrink-0">
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-[15px] font-semibold text-foreground truncate">
                {article.title}
              </h3>
              {article.preview && (
                <Badge variant="outline" className="text-[10px] uppercase tracking-wide border-amber-500/40 text-amber-300">
                  Preview
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              {article.description}
            </p>
          </div>
        </div>
      </Card>
    </Link>
  );
}
