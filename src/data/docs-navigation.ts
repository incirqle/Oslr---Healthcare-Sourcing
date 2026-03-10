import {
  Home, UserCog, Coins, Search, SlidersHorizontal, Sparkles, Filter, Eye,
  Share2, Library, Lightbulb, FolderOpen, CircleDot, BarChart3, Mail,
  FileText, Activity, TrendingUp, Phone, Newspaper, BookmarkCheck,
  Users, Settings, Database, HelpCircle, MessageSquare, Kanban
} from "lucide-react";

export interface DocPage {
  slug: string;
  title: string;
  icon: any;
}

export interface DocSection {
  label: string;
  pages: DocPage[];
}

export const docsNavigation: DocSection[] = [
  {
    label: "Getting Started",
    pages: [
      { slug: "getting-started", title: "Getting Started", icon: Home },
      { slug: "manage-account", title: "Manage Account", icon: UserCog },
      { slug: "credits-usage", title: "Credits & Usage", icon: Coins },
    ],
  },
  {
    label: "Search & AI",
    pages: [
      { slug: "search", title: "Search", icon: Search },
      { slug: "filters-vs-natural-language", title: "Filters vs Natural Language", icon: SlidersHorizontal },
      { slug: "ai-filters", title: "AI Filters", icon: Sparkles },
      { slug: "search-criteria", title: "Search Criteria", icon: Filter },
      { slug: "candidate-insights", title: "Candidate Insights", icon: Eye },
      { slug: "candidate-profiles", title: "Candidate Profiles", icon: CircleDot },
      { slug: "sharing-searches", title: "Sharing Searches", icon: Share2 },
      { slug: "search-library", title: "Search Library", icon: Library },
      { slug: "tips-tricks", title: "Tips & Tricks", icon: Lightbulb },
    ],
  },
  {
    label: "Projects",
    pages: [
      { slug: "projects", title: "Projects", icon: FolderOpen },
      { slug: "candidate-status", title: "Candidate Status", icon: Kanban },
      { slug: "pipeline-management", title: "Pipeline Management", icon: BarChart3 },
    ],
  },
  {
    label: "Campaigns",
    pages: [
      { slug: "email-campaigns", title: "Email Campaigns", icon: Mail },
      { slug: "templates", title: "Templates", icon: FileText },
      { slug: "campaign-tracking", title: "Campaign Tracking", icon: Activity },
      { slug: "campaign-analytics", title: "Campaign Analytics", icon: TrendingUp },
      { slug: "maximize-replies", title: "Maximize Replies", icon: TrendingUp },
      { slug: "contact-data", title: "Contact Data", icon: Phone },
    ],
  },
  {
    label: "Market Intelligence",
    pages: [
      { slug: "news-feed", title: "News Feed", icon: Newspaper },
      { slug: "reading-list", title: "Reading List", icon: BookmarkCheck },
    ],
  },
  {
    label: "Team & Settings",
    pages: [
      { slug: "team-management", title: "Team Management", icon: Users },
      { slug: "email-settings", title: "Email Settings", icon: Settings },
      { slug: "data-sources", title: "Data Sources", icon: Database },
    ],
  },
  {
    label: "Support",
    pages: [
      { slug: "help-center", title: "Help Center", icon: HelpCircle },
      { slug: "contact-support", title: "Contact Support", icon: MessageSquare },
    ],
  },
];

export function findPageBySlug(slug: string): DocPage | undefined {
  for (const section of docsNavigation) {
    const page = section.pages.find((p) => p.slug === slug);
    if (page) return page;
  }
  return undefined;
}

export function getNextPage(slug: string): DocPage | undefined {
  const allPages = docsNavigation.flatMap((s) => s.pages);
  const idx = allPages.findIndex((p) => p.slug === slug);
  return idx >= 0 && idx < allPages.length - 1 ? allPages[idx + 1] : undefined;
}

export function getPrevPage(slug: string): DocPage | undefined {
  const allPages = docsNavigation.flatMap((s) => s.pages);
  const idx = allPages.findIndex((p) => p.slug === slug);
  return idx > 0 ? allPages[idx - 1] : undefined;
}
