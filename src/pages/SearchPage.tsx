import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, Sparkles } from "lucide-react";

export default function SearchPage() {
  const [query, setQuery] = useState("");

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold font-display text-foreground">Search Candidates</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Use natural language to find healthcare professionals
          </p>
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Sparkles className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary" />
                <Input
                  placeholder='Try: "Registered nurses in Dallas with 5+ years experience at HCA Healthcare"'
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="pl-10 h-11"
                />
              </div>
              <Button className="h-11 px-6">
                <Search className="h-4 w-4 mr-2" />
                Search
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base font-display">Results</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
              <Search className="h-12 w-12 mb-4 opacity-20" />
              <p className="text-sm">Enter a search query to find healthcare professionals</p>
              <p className="text-xs mt-1 opacity-60">
                Powered by People Data Labs
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
