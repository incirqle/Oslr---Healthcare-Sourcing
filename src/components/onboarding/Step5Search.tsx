import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useOnboarding } from "@/hooks/useOnboarding";

const PLACEHOLDERS = [
  "cardiologists in Boston open to relocation",
  "ICU nurses with BSN within 50 miles of Chicago",
  "hospitalist attendings, 5+ years, Pacific Northwest",
];

export function Step5Search({ onComplete }: { onComplete: () => void }) {
  const navigate = useNavigate();
  const { completeStep } = useOnboarding();
  const [query, setQuery] = useState("");
  const [placeholderIdx, setPlaceholderIdx] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setPlaceholderIdx((i) => (i + 1) % PLACEHOLDERS.length), 3000);
    return () => clearInterval(id);
  }, []);

  const handleRunSearch = () => {
    completeStep.mutate("search");
    onComplete();
    const q = query.trim();
    navigate(`/search${q ? `?q=${encodeURIComponent(q)}` : ""}`);
  };

  return (
    <div className="space-y-4 pl-10">
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && handleRunSearch()}
        placeholder={PLACEHOLDERS[placeholderIdx]}
        className="text-base py-3 h-12"
      />
      <Button onClick={handleRunSearch}>{query.trim() ? "Run search" : "Go to search"}</Button>
    </div>
  );
}
