import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { DocsSidebar } from "./DocsSidebar";
import { Search, Menu } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import OslrWordmark from "@/assets/oslr-wordmark.svg";

function MobileSidebar() {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <button className="md:hidden p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
          <Menu className="h-5 w-5" />
        </button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72 p-0">
        <div className="pt-14">
          <DocsSidebar />
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function DocsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top nav */}
      <header className="h-14 border-b border-border bg-background sticky top-0 z-50 flex items-center justify-between px-4 md:px-6">
        <div className="flex items-center gap-3">
          <MobileSidebar />
          <Link to="/docs" className="flex items-center gap-2.5">
            <img src={OslrWordmark} alt="Oslr" className="h-5 brightness-0 dark:brightness-100" />
          </Link>
          <span className="text-muted-foreground text-sm hidden sm:inline">Docs</span>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/auth"
            className="text-sm font-medium text-foreground bg-foreground/10 hover:bg-foreground/15 px-4 py-1.5 rounded-lg transition-colors"
          >
            Sign in
          </Link>
        </div>
      </header>

      {/* Body */}
      <div className="flex flex-1">
        <DocsSidebar />
        <main className="flex-1 min-w-0">
          {children}
        </main>
      </div>
    </div>
  );
}
