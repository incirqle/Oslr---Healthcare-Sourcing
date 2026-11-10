import { Link } from "react-router-dom";
import { Button, buttonVariants } from "@/components/ui/button";
import { FolderPlus, Search, Sparkles, Phone, BookOpen, ArrowRight, Users, Coins } from "lucide-react";

const steps = [
  { n: 1, icon: Search, title: "Find clinicians", body: "Doctors, nurses and allied health", to: "/search", cta: "Start a search" },
  { n: 2, icon: FolderPlus, title: "Review and save clinicians", body: "Open a profile, check how each person matches your criteria and save the best fits.", to: "/projects", cta: "Open projects" },
  { n: 3, icon: Phone, title: "Get contact info", body: "Work email, personal email and mobile phone", to: "/search", cta: "Find contacts" },
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
    <section aria-label="Start here" className="grid gap-6 border-y border-border py-6 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <p className="text-sm font-semibold text-foreground">Start here</p>
        <h2 className="mt-1 text-xl font-semibold font-display text-foreground">Your first hire, in four steps</h2>
        <ol className="mt-4 grid gap-3 sm:grid-cols-2">
          {steps.map((s) => (
            <li key={s.n}>
              <Link to={s.to} className="group flex h-full flex-col rounded-lg border border-border bg-card p-5 shadow-sm transition-[transform,box-shadow,border-color] hover:border-primary hover:shadow-md active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-safe:hover:-translate-y-0.5 motion-reduce:transform-none">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/25 text-sm font-semibold text-foreground">{s.n}</span>
                  <s.icon className="h-5 w-5 text-foreground" />
                </div>
                <p className="mt-3 font-medium text-foreground">{s.title}</p>
                <p className="mt-1 flex-1 text-sm text-foreground/80">{s.body}</p>
                <span className={buttonVariants({ className: "mt-4 w-full whitespace-normal" })}>
                  {s.cta} <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                </span>
              </Link>
            </li>
          ))}
        </ol>
      </div>
      <div className="lg:border-l lg:border-border lg:pl-6">
        <p className="text-sm font-semibold text-foreground">Guides</p>
        <h2 className="mt-1 text-xl font-semibold font-display text-foreground">Learn the basics</h2>
        <ul className="mt-4 space-y-2">
          {guides.map((g) => (
            <li key={g.to}>
              <Link to={g.to} className="group flex items-center gap-3 rounded-lg px-3 py-3 hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <g.icon className="h-4 w-4 text-foreground" />
                <span className="flex-1 text-sm text-foreground">{g.title}</span>
                <ArrowRight className="h-3.5 w-3.5 text-foreground" />
              </Link>
            </li>
          ))}
        </ul>
        <Button asChild variant="outline" className="mt-3"><Link to="/resources">All resources <ArrowRight /></Link></Button>
      </div>
    </section>
  );
}

export const STARTER_PROMPTS = [
  "Pain management physicians in Arizona",
  "ICU nurses in Dallas with 5+ years",
  "Orthopedic surgeons near Denver",
  "Physical therapists in Florida",
];
