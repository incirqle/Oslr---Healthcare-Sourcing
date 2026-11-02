export type ProjectSection = "candidates" | "search" | "agents" | "connections";

export function projectNavigation(pathname: string, search: string) {
  const match = pathname.match(/^\/projects\/([^/]+)(?:\/(search|agents|connections))?\/?$/);
  const agentId = pathname.match(/^\/agents\/([^/]+)\/?$/)?.[1];
  const query = new URLSearchParams(search);
  const related = ["/contacts", "/integrations", "/settings"].includes(pathname) ? query.get("project") : null;
  return {
    projectId: match?.[1] ?? related ?? undefined,
    agentId,
    section: (match?.[2] ?? (agentId ? "agents" : pathname === "/integrations" ? "connections" : "candidates")) as ProjectSection,
  };
}

export function projectPath(projectId: string, section: ProjectSection = "candidates") {
  const root = `/projects/${encodeURIComponent(projectId)}`;
  return section === "candidates" ? root : `${root}/${section}`;
}