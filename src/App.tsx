import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Auth from "./pages/Auth";
import Landing from "./pages/Landing";
import Dashboard from "./pages/Dashboard";
import SearchPage from "./pages/SearchPage";
import Projects from "./pages/Projects";
import ProjectDetail from "./pages/ProjectDetail";
import Campaigns from "./pages/Campaigns";
import TeamSettings from "./pages/TeamSettings";
import News from "./pages/News";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/dashboard" element={<Dashboard />} />
          {/* Standalone /search redirects to projects — search must be done inside a project */}
          <Route path="/search" element={<Navigate to="/projects" replace />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/projects/:id" element={<ProjectDetail />} />
          {/* Scoped search — always tied to a project */}
          <Route path="/projects/:projectId/search" element={<SearchPage />} />
          <Route path="/campaigns" element={<Campaigns />} />
          <Route path="/news" element={<News />} />
          <Route path="/settings" element={<TeamSettings />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
