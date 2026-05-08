import { useParams } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { ResourcesHub } from "@/components/resources/ResourcesHub";
import { ResourceArticlePage } from "@/components/resources/ResourceArticle";
import { CategoryIndex } from "@/components/resources/CategoryIndex";
import { findArticle, ResourceCategory } from "@/content/resources/manifest";

const CATEGORY_INDEX_SLUGS = new Set<string>(["best-practices", "templates"]);

/**
 * Single shell for /resources/* — parses the wildcard path and dispatches
 * to hub, category index, or article view. Avoids declaring 17 separate
 * routes in App.tsx.
 */
export default function Resources() {
  const params = useParams();
  const wildcard = (params["*"] ?? "").replace(/^\/+|\/+$/g, "");

  let body: React.ReactNode;
  if (!wildcard) {
    body = <ResourcesHub />;
  } else if (CATEGORY_INDEX_SLUGS.has(wildcard)) {
    body = <CategoryIndex category={wildcard as ResourceCategory} />;
  } else if (findArticle(wildcard)) {
    body = <ResourceArticlePage slug={wildcard} />;
  } else {
    body = <ResourcesHub />;
  }

  return <AppLayout>{body}</AppLayout>;
}
