import { Component, type ErrorInfo, type ReactNode, useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChevronDown, Download } from "lucide-react";
import { useCompanyBrief, type PullGroup } from "@/hooks/useCompanyBrief";
import { CompanyHeader, OverviewPanel } from "./company-intel/OverviewPanel";
import { PeoplePanel } from "./company-intel/PeoplePanel";
import { MovementPanel } from "./company-intel/MovementPanel";
import { downloadCompanyBriefPdf, downloadCompanyCsv } from "@/lib/company-brief-export";
import { normalizeDomain, resolveCompanyDomain } from "@/lib/company-domains";

/**
 * Company panel (2026-10-19 redesign): company-level facts first.
 *   Header: logo, name, type, location, website.
 *   Tabs:   Overview (facts, headcount, who works here, movement summary), People, Movement.
 * Data: hooks/useCompanyBrief.ts → company-enrichment edge function.
 */

class PanelErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[CompanyIntelModal] render error", error, info);
  }
  render() {
    if (this.state.error) {
      return (
        <div className="m-6 rounded-2xl border border-dashed border-border py-12 text-center">
          <p className="text-[14px] font-medium text-foreground">This section didn't load</p>
          <button type="button" onClick={() => this.setState({ error: null })} className="mt-3 rounded-full border border-border px-4 py-1.5 text-[13px] font-medium text-foreground hover:bg-muted">
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

interface CompanyIntelModalProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  companyName: string | null | undefined;
  domain?: string | null;
  /** Crustdata company id from the candidate row (job_company_id), when known. */
  companyId?: number | null;
}

const TAB = "rounded-full px-4 py-1.5 text-[13.5px] font-medium text-muted-foreground transition-colors data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm";

export function CompanyIntelModal({ open, onOpenChange, companyName, domain, companyId }: CompanyIntelModalProps) {
  const seedDomain = useMemo(() => normalizeDomain(domain) ?? resolveCompanyDomain(companyName), [domain, companyName]);
  const s = useCompanyBrief({ open, companyName, domain: seedDomain, companyId });
  const [tab, setTab] = useState("overview");
  const [focusGroup, setFocusGroup] = useState<PullGroup | null>(null);
  useEffect(() => { if (open) { setTab("overview"); setFocusGroup(null); } }, [open, companyName]);
  if (!companyName) return null;

  const pulledCount = Object.values(s.pulled).reduce((n, g) => n + (g?.pages.reduce((m, p) => m + p.people.length, 0) ?? 0), 0);
  const canExport = !!s.base && (pulledCount > 0 || !!s.movement);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="h-[90vh] max-w-[72rem] gap-0 overflow-hidden rounded-3xl border border-border/60 bg-background p-0 shadow-2xl !flex !flex-col">
        <Tabs value={tab} onValueChange={setTab} className="flex min-h-0 flex-1 flex-col">
          <div className="shrink-0 border-b border-border/60 bg-background/80 backdrop-blur-xl">
            <CompanyHeader base={s.base} state={s.baseState} fallbackName={companyName} />
            <div className="flex items-center justify-between gap-3 px-7 pb-4">
              <TabsList className="h-auto gap-1 rounded-full bg-muted p-1">
                <TabsTrigger value="overview" className={TAB}>Overview</TabsTrigger>
                <TabsTrigger value="people" className={TAB}>People</TabsTrigger>
                <TabsTrigger value="movement" className={TAB}>Movement</TabsTrigger>
              </TabsList>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    disabled={!canExport}
                    title={canExport ? undefined : "Pull a group or movement to export it"}
                    className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border px-3.5 text-[13px] font-medium text-foreground transition-all duration-150 hover:bg-muted active:scale-[0.97] disabled:opacity-40"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Export
                    <ChevronDown className="h-3 w-3 text-muted-foreground" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem onClick={() => downloadCompanyBriefPdf(s)}>Company brief (PDF)</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => downloadCompanyCsv(s)}>Pulled people and movement (CSV)</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto bg-muted/30 px-7 py-6">
            <PanelErrorBoundary>
              <TabsContent value="overview" className="mt-0">
                <OverviewPanel
                  s={s}
                  onOpenGroup={(g) => { setFocusGroup(g); setTab("people"); }}
                  onOpenMovement={() => setTab("movement")}
                />
              </TabsContent>
              <TabsContent value="people" className="mt-0">
                <PeoplePanel key={focusGroup ?? "none"} s={s} initialPicked={focusGroup ? [focusGroup] : undefined} />
              </TabsContent>
              <TabsContent value="movement" className="mt-0"><MovementPanel s={s} /></TabsContent>
            </PanelErrorBoundary>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
