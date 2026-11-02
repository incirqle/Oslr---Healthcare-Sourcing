import { Link } from "react-router-dom";
import { Bot, FolderKanban, Plug, Search, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { projectPath, type ProjectSection } from "@/lib/project-navigation";

const sections = [
  { key: "candidates", label: "Candidates", icon: Users },
  { key: "search", label: "Talent Search", icon: Search },
  { key: "agents", label: "Agents", icon: Bot },
  { key: "connections", label: "Connections & Sync", icon: Plug },
] as const;

export function ProjectNavigation({ projectId, name, section }: { projectId: string; name?: string; section: ProjectSection }) {
  return (
    <section className="border-b border-border bg-background/95 px-4 pt-5 backdrop-blur-xl sm:px-6">
      <div className="mb-4 flex min-w-0 items-center gap-3">
        <FolderKanban className="h-5 w-5 shrink-0 text-primary" />
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">Project</p>
          <p className="break-words font-display text-xl font-semibold leading-snug">{name ?? "Loading project…"}</p>
        </div>
      </div>
      <nav aria-label="Project navigation" className="flex gap-1 overflow-x-auto pb-2">
        {sections.map(({ key, label, icon: Icon }) => (
          <Button key={key} asChild variant="ghost" className={`h-10 shrink-0 gap-2 rounded-md px-3 active:scale-[0.98] ${section === key ? "bg-primary/15 text-primary hover:bg-primary/20 hover:text-primary" : "text-muted-foreground"}`}>
            <Link to={projectPath(projectId, key)} aria-current={section === key ? "page" : undefined}><Icon className="h-4 w-4" />{label}</Link>
          </Button>
        ))}
      </nav>
    </section>
  );
}