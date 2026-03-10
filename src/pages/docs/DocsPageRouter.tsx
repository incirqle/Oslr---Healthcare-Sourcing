import { useParams, Navigate } from "react-router-dom";
import { DocsLayout } from "@/components/docs/DocsLayout";
import { findPageBySlug } from "@/data/docs-navigation";

// Getting Started pages
import { GettingStartedPage, ManageAccountPage, CreditsUsagePage } from "./GettingStartedPages";
// Search pages
import {
  SearchPage, FiltersVsNLPage, AIFiltersPage, SearchCriteriaPage,
  CandidateInsightsPage, CandidateProfilesPage, SharingSearchesPage,
  SearchLibraryPage, TipsTricksPage,
} from "./SearchPages";
// Project pages
import { ProjectsPage, CandidateStatusPage, PipelineManagementPage } from "./ProjectPages";
// Campaign pages
import {
  EmailCampaignsPage, TemplatesPage, CampaignTrackingPage,
  CampaignAnalyticsPage, MaximizeRepliesPage, ContactDataPage,
} from "./CampaignPages";
// Remaining pages
import {
  NewsFeedPage, ReadingListPage, TeamManagementPage, EmailSettingsPage,
  DataSourcesPage, HelpCenterPage, ContactSupportPage,
} from "./RemainingPages";

const PAGE_COMPONENTS: Record<string, React.ComponentType> = {
  "getting-started": GettingStartedPage,
  "manage-account": ManageAccountPage,
  "credits-usage": CreditsUsagePage,
  "search": SearchPage,
  "filters-vs-natural-language": FiltersVsNLPage,
  "ai-filters": AIFiltersPage,
  "search-criteria": SearchCriteriaPage,
  "candidate-insights": CandidateInsightsPage,
  "candidate-profiles": CandidateProfilesPage,
  "sharing-searches": SharingSearchesPage,
  "search-library": SearchLibraryPage,
  "tips-tricks": TipsTricksPage,
  "projects": ProjectsPage,
  "candidate-status": CandidateStatusPage,
  "pipeline-management": PipelineManagementPage,
  "email-campaigns": EmailCampaignsPage,
  "templates": TemplatesPage,
  "campaign-tracking": CampaignTrackingPage,
  "campaign-analytics": CampaignAnalyticsPage,
  "maximize-replies": MaximizeRepliesPage,
  "contact-data": ContactDataPage,
  "news-feed": NewsFeedPage,
  "reading-list": ReadingListPage,
  "team-management": TeamManagementPage,
  "email-settings": EmailSettingsPage,
  "data-sources": DataSourcesPage,
  "help-center": HelpCenterPage,
  "contact-support": ContactSupportPage,
};

export default function DocsPageRouter() {
  const { slug } = useParams<{ slug: string }>();

  if (!slug || !findPageBySlug(slug)) {
    return <Navigate to="/docs" replace />;
  }

  const PageComponent = PAGE_COMPONENTS[slug];
  if (!PageComponent) {
    return <Navigate to="/docs" replace />;
  }

  return (
    <DocsLayout>
      <PageComponent />
    </DocsLayout>
  );
}
