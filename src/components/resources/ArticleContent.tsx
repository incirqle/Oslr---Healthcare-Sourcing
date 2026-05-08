import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

export function ArticleContent({ markdown }: { markdown: string }) {
  return (
    <div
      className={cn(
        "prose prose-slate max-w-none",
        "prose-headings:font-display prose-headings:tracking-tight prose-headings:text-foreground",
        "prose-h1:text-3xl prose-h1:mb-4",
        "prose-h2:text-2xl prose-h2:mt-10",
        "prose-h3:text-lg",
        "prose-p:text-foreground/85 prose-li:text-foreground/85",
        "prose-a:text-primary hover:prose-a:underline",
        "prose-code:text-primary prose-code:before:content-none prose-code:after:content-none prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded",
        "prose-pre:bg-muted prose-pre:border prose-pre:border-border",
        "prose-blockquote:border-l-primary prose-blockquote:text-foreground/80",
        "prose-table:w-full prose-th:border prose-th:border-border prose-td:border prose-td:border-border prose-th:px-3 prose-th:py-2 prose-td:px-3 prose-td:py-2",
        "prose-strong:text-foreground",
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children, ...props }) => {
            if (href && href.startsWith("/")) {
              return <Link to={href}>{children}</Link>;
            }
            return (
              <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
                {children}
              </a>
            );
          },
        }}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
