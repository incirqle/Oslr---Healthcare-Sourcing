// Private, service-only audit trail for contact lookups. Provider payloads and
// credentials never cross the browser boundary; this stores bounded outcomes,
// resolved employer details, found fields and the reconstruction decision.
interface Db { from: (table: string) => any }

export type ContactAuditStep = {
  step: string;
  status: "found" | "miss" | "unavailable" | "complete" | "blocked";
  fields?: string[];
  httpStatus?: number;
  detail?: string;
};

export class ContactAudit {
  private steps: ContactAuditStep[] = [];
  private result: Record<string, unknown> = {};

  constructor(private db: Db, private input: {
    companyId: string;
    userId: string;
    linkedinUrl: string;
    candidateName: string | null;
    employer: string | null;
    requested: string[];
    enabled: boolean;
  }) {}

  step(step: ContactAuditStep["step"], status: ContactAuditStep["status"], extra: Omit<ContactAuditStep, "step" | "status"> = {}) {
    this.steps.push({ step, status, ...extra });
  }

  record(values: Record<string, unknown>) { Object.assign(this.result, values); }

  async finish(status: number, outcome: "found" | "not_found" | "cached" | "blocked" | "error", error?: string) {
    if (!this.input.enabled) return;
    const { error: writeError } = await this.db.from("contact_enrichment_logs").insert({
      company_id: this.input.companyId,
      user_id: this.input.userId,
      linkedin_url: this.input.linkedinUrl,
      candidate_name: this.input.candidateName,
      requested_kinds: this.input.requested,
      employer: this.input.employer,
      employer_domain: typeof this.result.employer_domain === "string" ? this.result.employer_domain : null,
      status: outcome,
      http_status: status,
      steps: this.steps,
      result: this.result,
      error: error?.slice(0, 500) ?? null,
    });
    if (writeError) console.warn(`[enrich_contact] audit write failed: ${writeError.message.slice(0, 160)}`);
  }
}
