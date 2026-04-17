import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Auth from "./pages/Auth";
import Landing from "./pages/Landing";
import Dashboard from "./pages/Dashboard";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AuthProvider } from "./hooks/useAuth";
import SearchPage from "./pages/SearchPage";
import SearchEntry from "./pages/SearchEntry";
import Projects from "./pages/Projects";
import ProjectDetail from "./pages/ProjectDetail";
import Campaigns from "./pages/Campaigns";
import TeamSettings from "./pages/TeamSettings";
import News from "./pages/News";
import NotFound from "./pages/NotFound";
import DocsIndex from "./pages/docs/DocsIndex";
import DocsPageRouter from "./pages/docs/DocsPageRouter";

const queryClient = new QueryClient();

const P = ({ children }: { children: React.ReactNode }) => (
  <ProtectedRoute>{children}</ProtectedRoute>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/dashboard" element={<P><Dashboard /></P>} />
            <Route path="/search" element={<P><SearchEntry /></P>} />
            <Route path="/projects" element={<P><Projects /></P>} />
            <Route path="/projects/:id" element={<P><ProjectDetail /></P>} />
            <Route path="/projects/:projectId/search" element={<P><SearchPage /></P>} />
            <Route path="/agents" element={<Navigate to="/dashboard" replace />} />
            <Route path="/agents/:id" element={<Navigate to="/dashboard" replace />} />
            <Route path="/campaigns" element={<P><Campaigns /></P>} />
            <Route path="/news" element={<P><News /></P>} />
            <Route path="/settings" element={<P><TeamSettings /></P>} />
            <Route path="/docs" element={<DocsIndex />} />
            <Route path="/docs/:slug" element={<DocsPageRouter />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
