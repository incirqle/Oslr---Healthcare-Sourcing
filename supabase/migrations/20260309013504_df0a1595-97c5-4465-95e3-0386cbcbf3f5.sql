-- Add daily email sending limit to companies (default 200 for good deliverability)
ALTER TABLE public.companies
ADD COLUMN daily_email_limit INTEGER NOT NULL DEFAULT 200;

-- Add bounce_count and complaint_count to campaigns for quick reference
ALTER TABLE public.email_campaigns
ADD COLUMN bounce_count INTEGER DEFAULT 0,
ADD COLUMN delivered_count INTEGER DEFAULT 0;