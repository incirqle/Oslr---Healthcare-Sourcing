-- Add sender configuration to companies table
ALTER TABLE public.companies
ADD COLUMN from_name TEXT,
ADD COLUMN from_email TEXT,
ADD COLUMN reply_to_email TEXT;

-- Add analytics columns to email_campaigns
ALTER TABLE public.email_campaigns
ADD COLUMN sent_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN sent_count INTEGER DEFAULT 0,
ADD COLUMN open_count INTEGER DEFAULT 0,
ADD COLUMN click_count INTEGER DEFAULT 0;

-- Create email_events table for tracking individual recipient interactions
CREATE TABLE public.email_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.email_campaigns(id) ON DELETE CASCADE,
  candidate_id UUID NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('sent', 'delivered', 'opened', 'clicked', 'bounced', 'complained')),
  event_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Enable RLS on email_events
ALTER TABLE public.email_events ENABLE ROW LEVEL SECURITY;

-- Company members can view email events for their campaigns
CREATE POLICY "Company members can view email events"
  ON public.email_events
  FOR SELECT
  USING (is_company_member(auth.uid(), company_id));

-- System can insert email events (will be done via service role in webhook)
CREATE POLICY "Service role can insert email events"
  ON public.email_events
  FOR INSERT
  WITH CHECK (true);

-- Create index for faster event lookups
CREATE INDEX idx_email_events_campaign_id ON public.email_events(campaign_id);
CREATE INDEX idx_email_events_candidate_id ON public.email_events(candidate_id);
CREATE INDEX idx_email_events_type ON public.email_events(event_type);
CREATE INDEX idx_email_events_created_at ON public.email_events(created_at DESC);