import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import HomeRoute from "./marketing/HomeRoute";
import MarketingPage from "./marketing/MarketingPage";
import { MARKETING_ROUTES } from "./marketing/routes";
import Dashboard from "./pages/Dashboard";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AuthProvider } from "./hooks/useAuth";
import SearchPage from "./pages/SearchPage";
import Projects from "./pages/Projects";
import ProjectDetail from "./pages/ProjectDetail";
import Contacts from "./pages/Contacts";
import TeamSettings from "./pages/TeamSettings";
import News from "./pages/News";
import Resources from "./pages/Resources";
import Credits from "./pages/Credits";
import Agents from "./pages/Agents";
import AgentDetail from "./pages/AgentDetail";
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
            <Route path="/" element={<HomeRoute />} />
            {MARKETING_ROUTES.filter((r) => r.path !== "/").map((r) => (
              <Route key={r.path} path={r.path} element={<MarketingPage route={r} />} />
            ))}
            <Route path="/auth" element={<Auth />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/dashboard" element={<P><Dashboard /></P>} />
            <Route path="/search" element={<P><SearchPage /></P>} />
            <Route path="/projects" element={<P><Projects /></P>} />
            <Route path="/projects/:id" element={<P><ProjectDetail /></P>} />
            <Route path="/projects/:projectId/search" element={<P><SearchPage /></P>} />
            <Route path="/agents" element={<P><Agents /></P>} />
            <Route path="/agents/:id" element={<P><AgentDetail /></P>} />
            <Route path="/contacts" element={<P><Contacts /></P>} />
            <Route path="/campaigns/*" element={<Navigate to="/projects" replace />} />
            <Route path="/analytics/*" element={<Navigate to="/dashboard" replace />} />
            <Route path="/news" element={<P><News /></P>} />
            <Route path="/resources/*" element={<P><Resources /></P>} />
            <Route path="/credits" element={<P><Credits /></P>} />
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
