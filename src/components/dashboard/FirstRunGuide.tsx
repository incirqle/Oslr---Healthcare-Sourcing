import { Link } from "react-router-dom";
import { FolderPlus, Search, Sparkles, Phone, BookOpen, ArrowRight, Users, Coins } from "lucide-react";

const steps = [
  { n: 1, icon: Search, title: "Run your first Talent Search", body: "Describe the clinician you need in plain words. We create a project for it automatically.", to: "/search", cta: "Start a search" },
  { n: 2, icon: FolderPlus, title: "Review and save clinicians", body: "Open a profile, check how each person matches your criteria and save the best fits.", to: "/projects", cta: "Open projects" },
  { n: 3, icon: Phone, title: "Get contact info", body: "Pick work email, personal email or mobile phone. You only pay when we find something.", to: "/resources/contacts", cta: "How it works" },
  { n: 4, icon: Sparkles, title: "Launch an Agent", body: "Let an Agent keep sourcing for a role every day and send you new matches.", to: "/agents", cta: "Meet Agents" },
];

const guides = [
  { title: "Getting started", to: "/resources/getting-started", icon: BookOpen },
  { title: "Writing good searches", to: "/resources/best-practices/writing-good-searches", icon: Search },
  { title: "How credits work", to: "/resources/credits", icon: Coins },
  { title: "Inviting your team", to: "/resources/team-and-seats", icon: Users },
];

export function FirstRunGuide() {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="lg:col-span-2 rounded-xl border border-primary/20 bg-card p-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-primary">Start here</p>
        <h2 className="mt-1 text-xl font-semibold font-display text-foreground">Your first hire, in four steps</h2>
        <ol className="mt-4 grid gap-3 sm:grid-cols-2">
          {steps.map((s) => (
            <li key={s.n}>
              <Link to={s.to} className="group flex h-full flex-col rounded-lg border border-border/60 bg-background/40 p-4 transition-all hover:-translate-y-0.5 hover:border-primary/40">
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-primary">{s.n}</span>
                  <s.icon className="h-4 w-4 text-primary" />
                </div>
                <p className="mt-3 font-medium text-foreground">{s.title}</p>
                <p className="mt-1 flex-1 text-sm text-muted-foreground">{s.body}</p>
                <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary">
                  {s.cta} <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                </span>
              </Link>
            </li>
          ))}
        </ol>
      </div>
      <div className="rounded-xl border border-border/60 bg-card p-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-primary">Guides</p>
        <h2 className="mt-1 text-xl font-semibold font-display text-foreground">Learn the basics</h2>
        <ul className="mt-4 space-y-2">
          {guides.map((g) => (
            <li key={g.to}>
              <Link to={g.to} className="group flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-primary/10">
                <g.icon className="h-4 w-4 text-primary" />
                <span className="flex-1 text-sm text-foreground">{g.title}</span>
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary" />
              </Link>
            </li>
          ))}
        </ul>
        <Link to="/resources" className="mt-3 inline-block px-3 text-sm font-medium text-primary hover:underline">All resources</Link>
      </div>
    </div>
  );
}

export const STARTER_PROMPTS = [
  "Pain management physicians in Arizona",
  "ICU nurses in Dallas with 5+ years",
  "Orthopedic surgeons near Denver",
  "Physical therapists in Florida",
];
