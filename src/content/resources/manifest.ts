export type ResourceCategory =
  | "getting-started"
  | "product-guides"
  | "best-practices"
  | "templates";

export type ResourceArticle = {
  slug: string;
  title: string;
  description: string;
  category: ResourceCategory;
  icon: string;
  preview?: boolean;
  order: number;
};

export const CATEGORY_LABELS: Record<ResourceCategory, string> = {
  "getting-started": "Getting started",
  "product-guides": "Product guides",
  "best-practices": "Best practices",
  templates: "Email templates",
};

export const CATEGORY_ORDER: ResourceCategory[] = [
  "getting-started",
  "product-guides",
  "best-practices",
  "templates",
];

export const RESOURCE_ARTICLES: ResourceArticle[] = [
  { slug: "getting-started", title: "Your first 10 minutes in Oslr", description: "Orientation and what to do first.", category: "getting-started", icon: "Sparkles", order: 1 },

  { slug: "dashboard", title: "Dashboard", description: "Your home screen and day-one view.", category: "product-guides", icon: "LayoutDashboard", order: 1 },
  { slug: "projects", title: "Projects", description: "Folders for each role or pipeline.", category: "product-guides", icon: "FolderKanban", order: 2 },
  { slug: "search", title: "Search", description: "The natural-language search engine.", category: "product-guides", icon: "Search", order: 3 },
  { slug: "contacts", title: "Contacts", description: "Every candidate you've worked with.", category: "product-guides", icon: "Users", order: 4 },
  { slug: "campaigns", title: "Campaigns", description: "Multi-step email sequences.", category: "product-guides", icon: "Mail", preview: true, order: 5 },
  { slug: "analytics", title: "Analytics", description: "Search and pipeline activity.", category: "product-guides", icon: "BarChart3", order: 6 },
  { slug: "news", title: "News", description: "Daily healthcare intelligence feed.", category: "product-guides", icon: "Newspaper", order: 7 },
  { slug: "team-settings", title: "Team Settings", description: "Workspace, members, and account.", category: "product-guides", icon: "Settings", order: 8 },

  { slug: "best-practices/writing-good-searches", title: "Writing good searches", description: "Patterns that work and patterns that don't.", category: "best-practices", icon: "Sparkles", order: 1 },
  { slug: "best-practices/sourcing-healthcare-talent", title: "Sourcing healthcare talent", description: "Tactics by clinical role and specialty.", category: "best-practices", icon: "Stethoscope", order: 2 },
  { slug: "best-practices/managing-pipelines", title: "Managing your pipeline", description: "Status, tags, and weekly reviews.", category: "best-practices", icon: "GitBranch", order: 3 },

  { slug: "templates/physicians", title: "Physicians (attending)", description: "4-email sequence for board-certified attendings.", category: "templates", icon: "Stethoscope", order: 1 },
  { slug: "templates/nps-pas", title: "Nurse Practitioners and PAs", description: "4-email sequence for advanced practice providers.", category: "templates", icon: "Activity", order: 2 },
  { slug: "templates/rns", title: "Registered Nurses", description: "4-email sequence with notes by unit.", category: "templates", icon: "Heart", order: 3 },
];

export const articlesByCategory = (cat: ResourceCategory) =>
  RESOURCE_ARTICLES.filter((a) => a.category === cat).sort((a, b) => a.order - b.order);

export const findArticle = (slug: string) =>
  RESOURCE_ARTICLES.find((a) => a.slug === slug);
