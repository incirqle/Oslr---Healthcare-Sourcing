import { describe, expect, it } from "vitest";
import { projectNavigation, projectPath } from "./project-navigation";

describe("project navigation context", () => {
  it("keeps the same project across all four views", () => {
    for (const section of ["candidates", "search", "agents", "connections"] as const) {
      expect(projectNavigation(projectPath("project-123", section), "")).toEqual({ projectId: "project-123", agentId: undefined, section });
    }
  });
  it("resolves an agent separately rather than treating its id as a project", () => {
    expect(projectNavigation("/agents/agent-456", "")).toEqual({ projectId: undefined, agentId: "agent-456", section: "agents" });
  });
  it("retains a project on related workspace screens", () => {
    expect(projectNavigation("/integrations", "?project=project-123").projectId).toBe("project-123");
    expect(projectNavigation("/settings", "?project=project-123").projectId).toBe("project-123");
  });
  it("does not carry project context into global navigation", () => {
    expect(projectNavigation("/agents", "").projectId).toBeUndefined();
    expect(projectNavigation("/search", "").projectId).toBeUndefined();
  });
});