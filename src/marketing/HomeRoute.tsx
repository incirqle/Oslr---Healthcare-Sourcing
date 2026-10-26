import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import MarketingPage from "./MarketingPage";
import { MARKETING_ROUTES } from "./routes";

const HOME = MARKETING_ROUTES.find((r) => r.path === "/")!;

/** The public homepage. Signed-in users go straight to their dashboard, as before. */
export default function HomeRoute() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (!loading && user) navigate("/dashboard", { replace: true });
  }, [user, loading, navigate]);
  return <MarketingPage route={HOME} />;
}
