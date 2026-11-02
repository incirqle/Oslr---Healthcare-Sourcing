export type ResourceCategory =
  | "getting-started"
  | "product-guides"
  | "account-billing"
  | "best-practices";

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
  "account-billing": "Account, team & billing",
  "best-practices": "Best practices",
};

export const CATEGORY_ORDER: ResourceCategory[] = [
  "getting-started",
  "product-guides",
  "account-billing",
  "best-practices",
];

export const RESOURCE_ARTICLES: ResourceArticle[] = [
  { slug: "getting-started", title: "Your first 10 minutes in Oslr", description: "Sign in, run a search, save your first clinician.", category: "getting-started", icon: "Sparkles", order: 1 },
  { slug: "finding-your-way", title: "Finding your way around", description: "The sidebar, the project bar and how to get back.", category: "getting-started", icon: "Compass", order: 2 },
  { slug: "faq", title: "Questions and fixes", description: "Quick answers when something looks off.", category: "getting-started", icon: "LifeBuoy", order: 3 },

  { slug: "dashboard", title: "Dashboard", description: "Your home screen and today's numbers.", category: "product-guides", icon: "LayoutDashboard", order: 1 },
  { slug: "projects", title: "Projects", description: "One home for every role you are hiring for.", category: "product-guides", icon: "FolderKanban", order: 2 },
  { slug: "search", title: "Talent Search", description: "Describe who you need in plain English.", category: "product-guides", icon: "Search", order: 3 },
  { slug: "candidate-review", title: "Reviewing a clinician", description: "Match criteria, the profile and company insights.", category: "product-guides", icon: "UserCheck", order: 4 },
  { slug: "contacts", title: "Contact info and Contacts", description: "Finding emails and phones, and what it costs.", category: "product-guides", icon: "Users", order: 5 },
  { slug: "agents", title: "Oslr Agents", description: "A sourcer that learns your taste and works daily.", category: "product-guides", icon: "Bot", order: 6 },
  { slug: "live-sync", title: "Live sync: Sheets, Slack, Excel", description: "Send approved clinicians where your team works.", category: "product-guides", icon: "Zap", order: 7 },
  { slug: "integrations", title: "ATS and CRM integrations", description: "Push candidates into your hiring system.", category: "product-guides", icon: "Plug", order: 8 },
  { slug: "news", title: "News", description: "Daily healthcare hiring news.", category: "product-guides", icon: "Newspaper", order: 9 },

  { slug: "team-settings", title: "Settings tour", description: "Every section of Settings, explained.", category: "account-billing", icon: "Settings", order: 1 },
  { slug: "team-and-seats", title: "Inviting your team", description: "Seats, roles and invitations.", category: "account-billing", icon: "UserPlus", order: 2 },
  { slug: "credits", title: "Credits and spending limits", description: "What costs credits, what is free, and caps.", category: "account-billing", icon: "Coins", order: 3 },
  { slug: "billing", title: "Plans, billing and invoices", description: "Prices, upgrades, cards and receipts.", category: "account-billing", icon: "CreditCard", order: 4 },
  { slug: "account-and-domain", title: "Sign-in, emails and domain", description: "Your account, oslr.health and the emails we send.", category: "account-billing", icon: "Globe", order: 5 },

  { slug: "best-practices/writing-good-searches", title: "Writing good searches", description: "Patterns that work and patterns that don't.", category: "best-practices", icon: "Sparkles", order: 1 },
  { slug: "best-practices/sourcing-healthcare-talent", title: "Sourcing healthcare talent", description: "Tactics by clinical role and specialty.", category: "best-practices", icon: "Stethoscope", order: 2 },
  { slug: "best-practices/managing-pipelines", title: "Managing your pipeline", description: "Status, tags, and weekly reviews.", category: "best-practices", icon: "GitBranch", order: 3 },
];

export function findArticle(slug: string): ResourceArticle | undefined {
  return RESOURCE_ARTICLES.find((a) => a.slug === slug);
}

export function articlesByCategory(cat: ResourceCategory): ResourceArticle[] {
  return RESOURCE_ARTICLES.filter((a) => a.category === cat).sort((a, b) => a.order - b.order);
}
