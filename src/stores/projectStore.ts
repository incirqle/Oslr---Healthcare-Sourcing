import { create } from "zustand";
import { Project, ProjectCandidate, CandidateStatus } from "@/types/project";

interface ProjectStore {
  projects: Project[];
  addProject: (name: string, description?: string) => string;
  deleteProject: (id: string) => void;
  addCandidateToProject: (projectId: string, candidate: Omit<ProjectCandidate, "status" | "notes" | "tags" | "added_at">) => void;
  updateCandidateStatus: (projectId: string, candidateId: string, status: CandidateStatus) => void;
  removeCandidateFromProject: (projectId: string, candidateId: string) => void;
  getProject: (id: string) => Project | undefined;
}

export const useProjectStore = create<ProjectStore>((set, get) => ({
  projects: [],

  addProject: (name, description) => {
    const id = crypto.randomUUID();
    set((state) => ({
      projects: [
        ...state.projects,
        {
          id,
          name,
          description: description || null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          candidates: [],
        },
      ],
    }));
    return id;
  },

  deleteProject: (id) => {
    set((state) => ({
      projects: state.projects.filter((p) => p.id !== id),
    }));
  },

  addCandidateToProject: (projectId, candidate) => {
    set((state) => ({
      projects: state.projects.map((p) => {
        if (p.id !== projectId) return p;
        // Skip if already added
        if (p.candidates.some((c) => c.id === candidate.id)) return p;
        return {
          ...p,
          updated_at: new Date().toISOString(),
          candidates: [
            ...p.candidates,
            { ...candidate, status: "new", notes: null, tags: [], added_at: new Date().toISOString(), pdl_id: candidate.pdl_id || null },
          ],
        };
      }),
    }));
  },

  updateCandidateStatus: (projectId, candidateId, status) => {
    set((state) => ({
      projects: state.projects.map((p) => {
        if (p.id !== projectId) return p;
        return {
          ...p,
          updated_at: new Date().toISOString(),
          candidates: p.candidates.map((c) =>
            c.id === candidateId ? { ...c, status } : c
          ),
        };
      }),
    }));
  },

  removeCandidateFromProject: (projectId, candidateId) => {
    set((state) => ({
      projects: state.projects.map((p) => {
        if (p.id !== projectId) return p;
        return {
          ...p,
          updated_at: new Date().toISOString(),
          candidates: p.candidates.filter((c) => c.id !== candidateId),
        };
      }),
    }));
  },

  getProject: (id) => {
    return get().projects.find((p) => p.id === id);
  },
}));
