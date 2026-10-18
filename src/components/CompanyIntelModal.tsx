import { Component, type ErrorInfo, type ReactNode, useMemo } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChevronDown, Download } from "lucide-react";
import { useCompanyBrief } from "@/hooks/useCompanyBrief";
import { CompanyRail } from "./company-intel/CompanyRail";
import { PeoplePanel } from "./company-intel/PeoplePanel";
import { MovementPanel } from "./company-intel/MovementPanel";
import { downloadCompanyBriefPdf, downloadCompanyCsv } from "@/lib/company-brief-export";
import { normalizeDomain, resolveCompanyDomain } from "@/lib/company-domains";

/**
 * Company panel (2026-10-18 rebuild).
 *   Left:  company facts from the initial enrichment, on open.
 *   Right: People (pick groups, see count and cost, pull) and Movement.
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
        <div className="m-6 rounded-lg border border-dashed border-ui-border-medium py-12 text-center">
          <p className="text-[14px] font-medium text-ui-text-primary">This section didn't render</p>
          <button type="button" onClick={() => this.setState({ error: null })} className="mt-3 rounded-md border border-ui-border-medium px-3 py-1 text-[12px] font-medium text-ui-text-primary hover:bg-ui-surface-subtle">
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

const TAB = "rounded-none border-b-2 border-transparent bg-transparent px-1 pb-3 pt-1 text-[13.5px] font-medium text-ui-text-secondary shadow-none data-[state=active]:border-[#0A1F44] data-[state=active]:bg-transparent data-[state=active]:text-ui-text-primary data-[state=active]:shadow-none dark:data-[state=active]:border-ui-text-primary";

export function CompanyIntelModal({ open, onOpenChange, companyName, domain, companyId }: CompanyIntelModalProps) {
  const seedDomain = useMemo(() => normalizeDomain(domain) ?? resolveCompanyDomain(companyName), [domain, companyName]);
  const s = useCompanyBrief({ open, companyName, domain: seedDomain, companyId });
  if (!companyName) return null;

  const pulledCount = Object.values(s.pulled).reduce((n, g) => n + (g?.pages.reduce((m, p) => m + p.people.length, 0) ?? 0), 0);
  const canExport = !!s.base && (pulledCount > 0 || !!s.movement);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[76rem] gap-0 overflow-y-auto md:overflow-hidden border border-ui-border-medium bg-white p-0 shadow-2xl sm:rounded-xl h-[90vh] !grid-cols-none !grid-rows-none !flex !flex-col md:!flex-row dark:bg-background">
        <CompanyRail base={s.base} state={s.baseState} fallbackName={companyName} />
        <div className="flex min-h-[80vh] min-w-0 flex-1 flex-col md:min-h-0">
          <Tabs defaultValue="people" className="flex min-h-0 flex-1 flex-col">
            <div className="flex shrink-0 items-end justify-between gap-3 border-b border-ui-border-medium px-6 pr-14 pt-5">
              <TabsList className="h-auto gap-6 bg-transparent p-0">
                <TabsTrigger value="people" className={TAB}>People</TabsTrigger>
                <TabsTrigger value="movement" className={TAB}>Movement</TabsTrigger>
              </TabsList>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    disabled={!canExport}
                    title={canExport ? undefined : "Pull a group or movement to export it"}
                    className="mb-2.5 inline-flex h-8 items-center gap-1.5 rounded-md border border-ui-border-medium px-2.5 text-[12.5px] font-medium text-ui-text-primary transition-colors duration-150 hover:bg-ui-surface-subtle disabled:opacity-40"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Export
                    <ChevronDown className="h-3 w-3 text-ui-text-muted" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem onClick={() => downloadCompanyBriefPdf(s)}>Company brief (PDF)</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => downloadCompanyCsv(s)}>Pulled people and movement (CSV)</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
              <PanelErrorBoundary>
                <TabsContent value="people" className="mt-0"><PeoplePanel s={s} /></TabsContent>
                <TabsContent value="movement" className="mt-0"><MovementPanel s={s} /></TabsContent>
              </PanelErrorBoundary>
            </div>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}
