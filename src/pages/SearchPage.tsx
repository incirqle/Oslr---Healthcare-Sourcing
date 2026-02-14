import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, Sparkles } from "lucide-react";

const suggestions = [
  "Registered nurses in Dallas",
  "Cardiologists with 10+ years",
  "Travel nurses in California",
  "ICU nurses at HCA Healthcare",
  "Nurse practitioners in Houston",
];

export default function SearchPage() {
  const [query, setQuery] = useState("");

  const handleChipClick = (suggestion: string) => {
    setQuery(suggestion);
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold font-display text-foreground">Search Candidates</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Use natural language to find healthcare professionals
          </p>
        </div>

        <Card className="overflow-hidden">
          <CardContent className="pt-6 pb-5">
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Sparkles className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-primary" />
                <Input
                  placeholder='Try: "Registered nurses in Dallas with 5+ years experience at HCA Healthcare"'
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="pl-10 h-12 text-sm border-border focus-visible:ring-primary/30 focus-visible:ring-offset-0 focus-visible:ring-[3px]"
                />
              </div>
              <Button className="h-12 px-6 font-medium">
                <Search className="h-4 w-4 mr-2" />
                Search
              </Button>
            </div>
            <div className="flex flex-wrap gap-2 mt-3.5">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => handleChipClick(s)}
                  className="inline-flex items-center rounded-full border border-border bg-secondary/50 px-3 py-1 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors cursor-pointer"
                >
                  {s}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base font-display">Results</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-secondary mb-4">
                <Search className="h-7 w-7 opacity-30" />
              </div>
              <p className="text-sm font-medium">Enter a search query to find healthcare professionals</p>
              <p className="text-xs mt-1.5 opacity-60">
                Powered by People Data Labs
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
