CREATE TABLE public.institution_email_evidence (
  scope_key text NOT NULL,
  person_hash text NOT NULL,
  address_hash text NOT NULL,
  organization_key text NOT NULL,
  organization_name text NOT NULL,
  domain text NOT NULL,
  cohort text NOT NULL,
  patterns text[] NOT NULL DEFAULT '{}',
  observed_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  verified boolean NOT NULL DEFAULT false,
  identity_bound boolean NOT NULL DEFAULT false,
  current_affiliation boolean NOT NULL DEFAULT false,
  PRIMARY KEY (scope_key, person_hash, address_hash)
);

GRANT ALL ON public.institution_email_evidence TO service_role;

ALTER TABLE public.institution_email_evidence ENABLE ROW LEVEL SECURITY;

CREATE INDEX institution_email_evidence_scope_idx
  ON public.institution_email_evidence (organization_key, cohort, domain, expires_at);
CREATE INDEX institution_email_evidence_address_idx
  ON public.institution_email_evidence (address_hash);

COMMENT ON TABLE public.institution_email_evidence IS
  'Private reusable naming-pattern evidence. Hashes only; reconstructed addresses remain unverified and are never billable found contacts.';