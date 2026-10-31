export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      agent_leads: {
        Row: {
          agent_id: string | null
          ai_summary: string | null
          created_at: string | null
          email_opens: number | null
          email_replies: number | null
          id: string
          last_contacted_at: string | null
          match_label: string | null
          match_reasoning: string | null
          match_score: number | null
          person_id: string
          profile_snapshot: Json
          reviewer_feedback: string | null
          sequence_step: number | null
          status: string | null
          user_id: string
        }
        Insert: {
          agent_id?: string | null
          ai_summary?: string | null
          created_at?: string | null
          email_opens?: number | null
          email_replies?: number | null
          id?: string
          last_contacted_at?: string | null
          match_label?: string | null
          match_reasoning?: string | null
          match_score?: number | null
          person_id: string
          profile_snapshot: Json
          reviewer_feedback?: string | null
          sequence_step?: number | null
          status?: string | null
          user_id: string
        }
        Update: {
          agent_id?: string | null
          ai_summary?: string | null
          created_at?: string | null
          email_opens?: number | null
          email_replies?: number | null
          id?: string
          last_contacted_at?: string | null
          match_label?: string | null
          match_reasoning?: string | null
          match_score?: number | null
          person_id?: string
          profile_snapshot?: Json
          reviewer_feedback?: string | null
          sequence_step?: number | null
          status?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_leads_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "sourcing_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_outreach_log: {
        Row: {
          agent_id: string | null
          body: string
          bounced: boolean | null
          email_provider: string | null
          from_email: string | null
          from_name: string | null
          id: string
          lead_id: string | null
          message_id: string | null
          opened_at: string | null
          replied_at: string | null
          resend_batch_id: string | null
          resend_email_id: string | null
          sent_at: string | null
          step: number
          subject: string
          to_email: string
          user_id: string
        }
        Insert: {
          agent_id?: string | null
          body: string
          bounced?: boolean | null
          email_provider?: string | null
          from_email?: string | null
          from_name?: string | null
          id?: string
          lead_id?: string | null
          message_id?: string | null
          opened_at?: string | null
          replied_at?: string | null
          resend_batch_id?: string | null
          resend_email_id?: string | null
          sent_at?: string | null
          step: number
          subject: string
          to_email: string
          user_id: string
        }
        Update: {
          agent_id?: string | null
          body?: string
          bounced?: boolean | null
          email_provider?: string | null
          from_email?: string | null
          from_name?: string | null
          id?: string
          lead_id?: string | null
          message_id?: string | null
          opened_at?: string | null
          replied_at?: string | null
          resend_batch_id?: string | null
          resend_email_id?: string | null
          sent_at?: string | null
          step?: number
          subject?: string
          to_email?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_outreach_log_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "sourcing_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_outreach_log_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "agent_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_sequences: {
        Row: {
          created_at: string | null
          from_name: string | null
          id: string
          name: string
          reply_to_email: string | null
          steps: Json
          user_id: string
        }
        Insert: {
          created_at?: string | null
          from_name?: string | null
          id?: string
          name: string
          reply_to_email?: string | null
          steps: Json
          user_id: string
        }
        Update: {
          created_at?: string | null
          from_name?: string | null
          id?: string
          name?: string
          reply_to_email?: string | null
          steps?: Json
          user_id?: string
        }
        Relationships: []
      }
      beta_access: {
        Row: {
          activated_at: string
          company_id: string
          enrich_limit: number
          expires_at: string
          search_limit: number
          user_id: string
        }
        Insert: {
          activated_at?: string
          company_id: string
          enrich_limit?: number
          expires_at?: string
          search_limit?: number
          user_id: string
        }
        Update: {
          activated_at?: string
          company_id?: string
          enrich_limit?: number
          expires_at?: string
          search_limit?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "beta_access_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      beta_feedback: {
        Row: {
          company_id: string | null
          created_at: string
          easy_to_use: string | null
          experience: string | null
          id: string
          intuitive: string | null
          suggestions: string | null
          user_email: string | null
          user_id: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          easy_to_use?: string | null
          experience?: string | null
          id?: string
          intuitive?: string | null
          suggestions?: string | null
          user_email?: string | null
          user_id: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          easy_to_use?: string | null
          experience?: string | null
          id?: string
          intuitive?: string | null
          suggestions?: string | null
          user_email?: string | null
          user_id?: string
        }
        Relationships: []
      }
      beta_plan_invites: {
        Row: {
          created_at: string
          email: string
          note: string | null
        }
        Insert: {
          created_at?: string
          email: string
          note?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          note?: string | null
        }
        Relationships: []
      }
      billing_events: {
        Row: {
          account: string
          company_id: string | null
          created_at: string
          payload: Json
          stripe_event_id: string
          type: string
        }
        Insert: {
          account: string
          company_id?: string | null
          created_at?: string
          payload?: Json
          stripe_event_id: string
          type: string
        }
        Update: {
          account?: string
          company_id?: string | null
          created_at?: string
          payload?: Json
          stripe_event_id?: string
          type?: string
        }
        Relationships: []
      }
      billing_exemptions: {
        Row: {
          company_id: string
          created_at: string
          note: string | null
          unlimited_access: boolean
        }
        Insert: {
          company_id: string
          created_at?: string
          note?: string | null
          unlimited_access?: boolean
        }
        Update: {
          company_id?: string
          created_at?: string
          note?: string | null
          unlimited_access?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "billing_exemptions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_nudges: {
        Row: {
          canceled_at: string | null
          company_id: string | null
          created_at: string
          dedupe_key: string
          email: string
          error: string | null
          id: string
          kind: string
          send_after: string
          sent_at: string | null
        }
        Insert: {
          canceled_at?: string | null
          company_id?: string | null
          created_at?: string
          dedupe_key: string
          email: string
          error?: string | null
          id?: string
          kind: string
          send_after?: string
          sent_at?: string | null
        }
        Update: {
          canceled_at?: string | null
          company_id?: string | null
          created_at?: string
          dedupe_key?: string
          email?: string
          error?: string | null
          id?: string
          kind?: string
          send_after?: string
          sent_at?: string | null
        }
        Relationships: []
      }
      campaign_sends: {
        Row: {
          bounced: boolean
          campaign_id: string
          candidate_id: string | null
          clicked_at: string | null
          company_id: string
          created_at: string
          error: string | null
          id: string
          nylas_message_id: string | null
          nylas_thread_id: string | null
          opened_at: string | null
          recipient_email: string
          recipient_name: string | null
          replied_at: string | null
          sent_at: string | null
        }
        Insert: {
          bounced?: boolean
          campaign_id: string
          candidate_id?: string | null
          clicked_at?: string | null
          company_id: string
          created_at?: string
          error?: string | null
          id?: string
          nylas_message_id?: string | null
          nylas_thread_id?: string | null
          opened_at?: string | null
          recipient_email: string
          recipient_name?: string | null
          replied_at?: string | null
          sent_at?: string | null
        }
        Update: {
          bounced?: boolean
          campaign_id?: string
          candidate_id?: string | null
          clicked_at?: string | null
          company_id?: string
          created_at?: string
          error?: string | null
          id?: string
          nylas_message_id?: string | null
          nylas_thread_id?: string | null
          opened_at?: string | null
          recipient_email?: string
          recipient_name?: string | null
          replied_at?: string | null
          sent_at?: string | null
        }
        Relationships: []
      }
      candidate_fit: {
        Row: {
          created_at: string
          id: string
          person_id: string
          status: Database["public"]["Enums"]["candidate_fit_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          person_id: string
          status?: Database["public"]["Enums"]["candidate_fit_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          person_id?: string
          status?: Database["public"]["Enums"]["candidate_fit_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      candidate_notes: {
        Row: {
          body: string
          created_at: string
          id: string
          person_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          body?: string
          created_at?: string
          id?: string
          person_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          person_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      candidates: {
        Row: {
          added_by: string | null
          avg_tenure_months: number | null
          company_id: string
          created_at: string
          current_employer: string | null
          email: string | null
          full_name: string
          id: string
          linkedin_url: string | null
          location: string | null
          notes: string | null
          person_id: string | null
          phone: string | null
          project_id: string
          raw_data: Json | null
          salary_max: number | null
          salary_min: number | null
          skills: string[] | null
          status: string
          tags: string[] | null
          title: string | null
          updated_at: string
        }
        Insert: {
          added_by?: string | null
          avg_tenure_months?: number | null
          company_id: string
          created_at?: string
          current_employer?: string | null
          email?: string | null
          full_name: string
          id?: string
          linkedin_url?: string | null
          location?: string | null
          notes?: string | null
          person_id?: string | null
          phone?: string | null
          project_id: string
          raw_data?: Json | null
          salary_max?: number | null
          salary_min?: number | null
          skills?: string[] | null
          status?: string
          tags?: string[] | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          added_by?: string | null
          avg_tenure_months?: number | null
          company_id?: string
          created_at?: string
          current_employer?: string | null
          email?: string | null
          full_name?: string
          id?: string
          linkedin_url?: string | null
          location?: string | null
          notes?: string | null
          person_id?: string | null
          phone?: string | null
          project_id?: string
          raw_data?: Json | null
          salary_max?: number | null
          salary_min?: number | null
          skills?: string[] | null
          status?: string
          tags?: string[] | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "candidates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidates_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      clin_agent_decisions: {
        Row: {
          agent_id: string
          company_id: string
          created_at: string
          decision: string
          id: string
          note: string | null
          pool_id: string
          skip_city: string | null
          tags: string[]
          user_id: string
        }
        Insert: {
          agent_id: string
          company_id: string
          created_at?: string
          decision: string
          id?: string
          note?: string | null
          pool_id: string
          skip_city?: string | null
          tags?: string[]
          user_id: string
        }
        Update: {
          agent_id?: string
          company_id?: string
          created_at?: string
          decision?: string
          id?: string
          note?: string | null
          pool_id?: string
          skip_city?: string | null
          tags?: string[]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "clin_agent_decisions_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "clin_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clin_agent_decisions_pool_id_fkey"
            columns: ["pool_id"]
            isOneToOne: false
            referencedRelation: "clin_agent_pool"
            referencedColumns: ["id"]
          },
        ]
      }
      clin_agent_events: {
        Row: {
          agent_id: string
          company_id: string
          created_at: string
          event_type: string
          id: string
          payload: Json
        }
        Insert: {
          agent_id: string
          company_id: string
          created_at?: string
          event_type: string
          id?: string
          payload?: Json
        }
        Update: {
          agent_id?: string
          company_id?: string
          created_at?: string
          event_type?: string
          id?: string
          payload?: Json
        }
        Relationships: [
          {
            foreignKeyName: "clin_agent_events_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "clin_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      clin_agent_lease: {
        Row: {
          id: number
          locked_until: string
        }
        Insert: {
          id: number
          locked_until?: string
        }
        Update: {
          id?: number
          locked_until?: string
        }
        Relationships: []
      }
      clin_agent_pool: {
        Row: {
          agent_id: string
          base_score: number
          boost: number
          company_id: string
          created_at: string
          decided_at: string | null
          decision: string | null
          features: string[]
          final_score: number
          id: string
          person_id: string
          profile: Json
          pruned: boolean
          served_at: string | null
          why: string | null
        }
        Insert: {
          agent_id: string
          base_score?: number
          boost?: number
          company_id: string
          created_at?: string
          decided_at?: string | null
          decision?: string | null
          features?: string[]
          final_score?: number
          id?: string
          person_id: string
          profile: Json
          pruned?: boolean
          served_at?: string | null
          why?: string | null
        }
        Update: {
          agent_id?: string
          base_score?: number
          boost?: number
          company_id?: string
          created_at?: string
          decided_at?: string | null
          decision?: string | null
          features?: string[]
          final_score?: number
          id?: string
          person_id?: string
          profile?: Json
          pruned?: boolean
          served_at?: string | null
          why?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clin_agent_pool_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "clin_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      clin_agents: {
        Row: {
          brief: string
          company_id: string
          created_at: string
          creation_request_id: string | null
          email_updates: boolean
          empty_runs: number
          finish_date: string | null
          goal: number | null
          id: string
          last_reviewed_at: string | null
          last_run_at: string | null
          name: string
          next_run_at: string | null
          owner_id: string
          pause_reason: string | null
          per_day: number
          preferences: Json
          project_id: string | null
          run_hour: number
          status: string
          taste_memo: string | null
          timezone: string
          updated_at: string
        }
        Insert: {
          brief: string
          company_id: string
          created_at?: string
          creation_request_id?: string | null
          email_updates?: boolean
          empty_runs?: number
          finish_date?: string | null
          goal?: number | null
          id?: string
          last_reviewed_at?: string | null
          last_run_at?: string | null
          name: string
          next_run_at?: string | null
          owner_id: string
          pause_reason?: string | null
          per_day?: number
          preferences?: Json
          project_id?: string | null
          run_hour?: number
          status?: string
          taste_memo?: string | null
          timezone?: string
          updated_at?: string
        }
        Update: {
          brief?: string
          company_id?: string
          created_at?: string
          creation_request_id?: string | null
          email_updates?: boolean
          empty_runs?: number
          finish_date?: string | null
          goal?: number | null
          id?: string
          last_reviewed_at?: string | null
          last_run_at?: string | null
          name?: string
          next_run_at?: string | null
          owner_id?: string
          pause_reason?: string | null
          per_day?: number
          preferences?: Json
          project_id?: string | null
          run_hour?: number
          status?: string
          taste_memo?: string | null
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clin_agents_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clin_agents_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      clinician_search_intelligence: {
        Row: {
          audit_summary: Json | null
          cache_hit: boolean | null
          created_at: string
          credit_ceiling: number | null
          credits_charged: number | null
          credits_session: number | null
          criteria: Json | null
          engine: string
          engine_version: string | null
          error: string | null
          error_code: string | null
          id: string
          latency_ms: number | null
          page: number | null
          parsed_payload: Json | null
          provider_query: Json | null
          raw_query: string | null
          result_count: number | null
          run_id: string
          size: number | null
          total_count: number | null
          user_id: string | null
          widen_options: Json | null
          widened: boolean | null
        }
        Insert: {
          audit_summary?: Json | null
          cache_hit?: boolean | null
          created_at?: string
          credit_ceiling?: number | null
          credits_charged?: number | null
          credits_session?: number | null
          criteria?: Json | null
          engine?: string
          engine_version?: string | null
          error?: string | null
          error_code?: string | null
          id?: string
          latency_ms?: number | null
          page?: number | null
          parsed_payload?: Json | null
          provider_query?: Json | null
          raw_query?: string | null
          result_count?: number | null
          run_id: string
          size?: number | null
          total_count?: number | null
          user_id?: string | null
          widen_options?: Json | null
          widened?: boolean | null
        }
        Update: {
          audit_summary?: Json | null
          cache_hit?: boolean | null
          created_at?: string
          credit_ceiling?: number | null
          credits_charged?: number | null
          credits_session?: number | null
          criteria?: Json | null
          engine?: string
          engine_version?: string | null
          error?: string | null
          error_code?: string | null
          id?: string
          latency_ms?: number | null
          page?: number | null
          parsed_payload?: Json | null
          provider_query?: Json | null
          raw_query?: string | null
          result_count?: number | null
          run_id?: string
          size?: number | null
          total_count?: number | null
          user_id?: string | null
          widen_options?: Json | null
          widened?: boolean | null
        }
        Relationships: []
      }
      clinician_searches: {
        Row: {
          created_at: string
          filters: Json
          id: string
          query: string
          result_count: number
          user_id: string
        }
        Insert: {
          created_at?: string
          filters?: Json
          id?: string
          query: string
          result_count?: number
          user_id: string
        }
        Update: {
          created_at?: string
          filters?: Json
          id?: string
          query?: string
          result_count?: number
          user_id?: string
        }
        Relationships: []
      }
      companies: {
        Row: {
          created_at: string
          daily_email_limit: number
          from_email: string | null
          from_name: string | null
          id: string
          name: string
          primary_specialty: string | null
          recruiting_roles: string[] | null
          reply_to_email: string | null
          team_size: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          daily_email_limit?: number
          from_email?: string | null
          from_name?: string | null
          id?: string
          name: string
          primary_specialty?: string | null
          recruiting_roles?: string[] | null
          reply_to_email?: string | null
          team_size?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          daily_email_limit?: number
          from_email?: string | null
          from_name?: string | null
          id?: string
          name?: string
          primary_specialty?: string | null
          recruiting_roles?: string[] | null
          reply_to_email?: string | null
          team_size?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      company_enrichment_cache: {
        Row: {
          cache_key: string
          company_id: number
          created_at: string
          data: Json
        }
        Insert: {
          cache_key: string
          company_id: number
          created_at?: string
          data: Json
        }
        Update: {
          cache_key?: string
          company_id?: number
          created_at?: string
          data?: Json
        }
        Relationships: []
      }
      company_entity_cache: {
        Row: {
          canonical_name: string
          created_at: string
          data: Json
          updated_at: string
        }
        Insert: {
          canonical_name: string
          created_at?: string
          data: Json
          updated_at?: string
        }
        Update: {
          canonical_name?: string
          created_at?: string
          data?: Json
          updated_at?: string
        }
        Relationships: []
      }
      company_features: {
        Row: {
          agents_enabled: boolean
          billing_hold: string | null
          cancel_at_period_end: boolean
          canceled_at: string | null
          company_id: string
          plan: string
          updated_at: string
        }
        Insert: {
          agents_enabled?: boolean
          billing_hold?: string | null
          cancel_at_period_end?: boolean
          canceled_at?: string | null
          company_id: string
          plan?: string
          updated_at?: string
        }
        Update: {
          agents_enabled?: boolean
          billing_hold?: string | null
          cancel_at_period_end?: boolean
          canceled_at?: string | null
          company_id?: string
          plan?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_features_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_invites: {
        Row: {
          accepted_at: string | null
          company_id: string
          created_at: string
          email: string
          id: string
          invited_by: string | null
          role: Database["public"]["Enums"]["app_role"]
          token: string
        }
        Insert: {
          accepted_at?: string | null
          company_id: string
          created_at?: string
          email: string
          id?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          token?: string
        }
        Update: {
          accepted_at?: string | null
          company_id?: string
          created_at?: string
          email?: string
          id?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_invites_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_onboarding: {
        Row: {
          company_id: string
          created_at: string
          step_connectors_complete: boolean
          step_invites_complete: boolean
          step_project_complete: boolean
          step_search_complete: boolean
          step_team_complete: boolean
          success_banner_dismissed: boolean
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          step_connectors_complete?: boolean
          step_invites_complete?: boolean
          step_project_complete?: boolean
          step_search_complete?: boolean
          step_team_complete?: boolean
          success_banner_dismissed?: boolean
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          step_connectors_complete?: boolean
          step_invites_complete?: boolean
          step_project_complete?: boolean
          step_search_complete?: boolean
          step_team_complete?: boolean
          success_banner_dismissed?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_onboarding_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      connector_interest: {
        Row: {
          company_id: string
          connector: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          company_id: string
          connector: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          company_id?: string
          connector?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "connector_interest_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_unlocks: {
        Row: {
          checked: Json
          company_id: string
          created_at: string
          data: Json
          linkedin_url: string
          updated_at: string
        }
        Insert: {
          checked?: Json
          company_id: string
          created_at?: string
          data?: Json
          linkedin_url: string
          updated_at?: string
        }
        Update: {
          checked?: Json
          company_id?: string
          created_at?: string
          data?: Json
          linkedin_url?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_unlocks_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_balances: {
        Row: {
          balance: number
          company_id: string
          monthly_allowance: number
          updated_at: string
        }
        Insert: {
          balance?: number
          company_id: string
          monthly_allowance?: number
          updated_at?: string
        }
        Update: {
          balance?: number
          company_id?: string
          monthly_allowance?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_balances_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_transactions: {
        Row: {
          candidate_name: string | null
          company_id: string
          created_at: string
          credits: number
          id: string
          kind: string
          linkedin_url: string | null
          note: string | null
          stripe_ref: string | null
          user_id: string | null
        }
        Insert: {
          candidate_name?: string | null
          company_id: string
          created_at?: string
          credits: number
          id?: string
          kind: string
          linkedin_url?: string | null
          note?: string | null
          stripe_ref?: string | null
          user_id?: string | null
        }
        Update: {
          candidate_name?: string | null
          company_id?: string
          created_at?: string
          credits?: number
          id?: string
          kind?: string
          linkedin_url?: string | null
          note?: string | null
          stripe_ref?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "credit_transactions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      crustdata_cache: {
        Row: {
          cache_key: string
          created_at: string
          data: Json
          id: string
          next_cursor: string | null
          total: number
        }
        Insert: {
          cache_key: string
          created_at?: string
          data?: Json
          id?: string
          next_cursor?: string | null
          total?: number
        }
        Update: {
          cache_key?: string
          created_at?: string
          data?: Json
          id?: string
          next_cursor?: string | null
          total?: number
        }
        Relationships: []
      }
      doctor_intel_cache: {
        Row: {
          cache_key: string
          created_at: string
          data: Json
        }
        Insert: {
          cache_key: string
          created_at?: string
          data?: Json
        }
        Update: {
          cache_key?: string
          created_at?: string
          data?: Json
        }
        Relationships: []
      }
      email_campaigns: {
        Row: {
          bounce_count: number | null
          click_count: number | null
          company_id: string
          created_at: string
          created_by: string | null
          delivered_count: number | null
          id: string
          mailbox_id: string | null
          name: string
          open_count: number | null
          project_id: string | null
          recipient_count: number
          sent_at: string | null
          sent_count: number | null
          status: string
          template_id: string | null
          updated_at: string
        }
        Insert: {
          bounce_count?: number | null
          click_count?: number | null
          company_id: string
          created_at?: string
          created_by?: string | null
          delivered_count?: number | null
          id?: string
          mailbox_id?: string | null
          name: string
          open_count?: number | null
          project_id?: string | null
          recipient_count?: number
          sent_at?: string | null
          sent_count?: number | null
          status?: string
          template_id?: string | null
          updated_at?: string
        }
        Update: {
          bounce_count?: number | null
          click_count?: number | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          delivered_count?: number | null
          id?: string
          mailbox_id?: string | null
          name?: string
          open_count?: number | null
          project_id?: string | null
          recipient_count?: number
          sent_at?: string | null
          sent_count?: number | null
          status?: string
          template_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_campaigns_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_campaigns_mailbox_id_fkey"
            columns: ["mailbox_id"]
            isOneToOne: false
            referencedRelation: "user_mailboxes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_campaigns_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_campaigns_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "email_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      email_events: {
        Row: {
          campaign_id: string
          candidate_id: string
          company_id: string
          created_at: string
          event_data: Json | null
          event_type: string
          id: string
        }
        Insert: {
          campaign_id: string
          candidate_id: string
          company_id: string
          created_at?: string
          event_data?: Json | null
          event_type: string
          id?: string
        }
        Update: {
          campaign_id?: string
          candidate_id?: string
          company_id?: string
          created_at?: string
          event_data?: Json | null
          event_type?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_events_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "email_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_events_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      email_suppressions: {
        Row: {
          company_id: string
          created_at: string
          email: string
          id: string
          reason: string
        }
        Insert: {
          company_id: string
          created_at?: string
          email: string
          id?: string
          reason: string
        }
        Update: {
          company_id?: string
          created_at?: string
          email?: string
          id?: string
          reason?: string
        }
        Relationships: []
      }
      email_templates: {
        Row: {
          body: string
          company_id: string
          created_at: string
          created_by: string | null
          id: string
          name: string
          subject: string
          updated_at: string
        }
        Insert: {
          body?: string
          company_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          subject?: string
          updated_at?: string
        }
        Update: {
          body?: string
          company_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          subject?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_templates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      email_unsubscribe_tokens: {
        Row: {
          campaign_id: string | null
          company_id: string
          created_at: string
          email: string
          token: string
        }
        Insert: {
          campaign_id?: string | null
          company_id: string
          created_at?: string
          email: string
          token: string
        }
        Update: {
          campaign_id?: string | null
          company_id?: string
          created_at?: string
          email?: string
          token?: string
        }
        Relationships: []
      }
      oslr_searches: {
        Row: {
          created_at: string | null
          filters: Json | null
          id: string
          query: string | null
          result_count: number | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          filters?: Json | null
          id?: string
          query?: string | null
          result_count?: number | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          filters?: Json | null
          id?: string
          query?: string | null
          result_count?: number | null
          user_id?: string
        }
        Relationships: []
      }
      people_enrichments: {
        Row: {
          created_at: string
          enriched_data: Json
          id: string
          linkedin_url: string | null
          person_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          enriched_data: Json
          id?: string
          linkedin_url?: string | null
          person_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          enriched_data?: Json
          id?: string
          linkedin_url?: string | null
          person_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          company_id: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          company_id?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          company_id?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          location: string | null
          name: string
          role_title: string | null
          target_start_date: string | null
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          location?: string | null
          name: string
          role_title?: string | null
          target_start_date?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          location?: string | null
          name?: string
          role_title?: string | null
          target_start_date?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      reading_list: {
        Row: {
          article_id: string
          category: string | null
          description: string | null
          id: string
          published_at: string | null
          saved_at: string
          source: string
          source_icon: string | null
          title: string
          url: string
          user_id: string
        }
        Insert: {
          article_id: string
          category?: string | null
          description?: string | null
          id?: string
          published_at?: string | null
          saved_at?: string
          source: string
          source_icon?: string | null
          title: string
          url: string
          user_id: string
        }
        Update: {
          article_id?: string
          category?: string | null
          description?: string | null
          id?: string
          published_at?: string | null
          saved_at?: string
          source?: string
          source_icon?: string | null
          title?: string
          url?: string
          user_id?: string
        }
        Relationships: []
      }
      search_audit_logs: {
        Row: {
          cache_hit: boolean | null
          cascade_steps: Json | null
          cascade_used: boolean | null
          created_at: string
          error_message: string | null
          guard: string | null
          id: string
          meta: Json | null
          parsed_filters: Json | null
          parsed_payload: Json | null
          phase: string
          profiles_fetched: number | null
          provider_query: Json | null
          query_text: string | null
          reported_total: number | null
          timing_ms: number | null
          user_id: string | null
          winning_step: string | null
        }
        Insert: {
          cache_hit?: boolean | null
          cascade_steps?: Json | null
          cascade_used?: boolean | null
          created_at?: string
          error_message?: string | null
          guard?: string | null
          id?: string
          meta?: Json | null
          parsed_filters?: Json | null
          parsed_payload?: Json | null
          phase: string
          profiles_fetched?: number | null
          provider_query?: Json | null
          query_text?: string | null
          reported_total?: number | null
          timing_ms?: number | null
          user_id?: string | null
          winning_step?: string | null
        }
        Update: {
          cache_hit?: boolean | null
          cascade_steps?: Json | null
          cascade_used?: boolean | null
          created_at?: string
          error_message?: string | null
          guard?: string | null
          id?: string
          meta?: Json | null
          parsed_filters?: Json | null
          parsed_payload?: Json | null
          phase?: string
          profiles_fetched?: number | null
          provider_query?: Json | null
          query_text?: string | null
          reported_total?: number | null
          timing_ms?: number | null
          user_id?: string | null
          winning_step?: string | null
        }
        Relationships: []
      }
      search_history: {
        Row: {
          company_id: string
          created_at: string
          id: string
          query_text: string
          result_count: number | null
          search_params: Json | null
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          query_text: string
          result_count?: number | null
          search_params?: Json | null
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          query_text?: string
          result_count?: number | null
          search_params?: Json | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "search_history_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      search_meter_events: {
        Row: {
          created_at: string
          id: string
          kind: string
          query_norm: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          query_norm?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          query_norm?: string | null
          user_id?: string
        }
        Relationships: []
      }
      sourcing_agents: {
        Row: {
          calibration_approved: number | null
          calibration_locked: boolean | null
          calibration_notes: string[] | null
          created_at: string | null
          criteria_pinned: string[] | null
          daily_lead_quota: number | null
          id: string
          last_run_at: string | null
          leads_contacted: number | null
          leads_total: number | null
          name: string
          parsed_payload: Json | null
          review_mode: string | null
          role_description: string
          sequence_id: string | null
          sequence_mode: string | null
          source_query: Json | null
          status: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          calibration_approved?: number | null
          calibration_locked?: boolean | null
          calibration_notes?: string[] | null
          created_at?: string | null
          criteria_pinned?: string[] | null
          daily_lead_quota?: number | null
          id?: string
          last_run_at?: string | null
          leads_contacted?: number | null
          leads_total?: number | null
          name: string
          parsed_payload?: Json | null
          review_mode?: string | null
          role_description: string
          sequence_id?: string | null
          sequence_mode?: string | null
          source_query?: Json | null
          status?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          calibration_approved?: number | null
          calibration_locked?: boolean | null
          calibration_notes?: string[] | null
          created_at?: string | null
          criteria_pinned?: string[] | null
          daily_lead_quota?: number | null
          id?: string
          last_run_at?: string | null
          leads_contacted?: number | null
          leads_total?: number | null
          name?: string
          parsed_payload?: Json | null
          review_mode?: string | null
          role_description?: string
          sequence_id?: string | null
          sequence_mode?: string | null
          source_query?: Json | null
          status?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sourcing_agents_sequence_id_fkey"
            columns: ["sequence_id"]
            isOneToOne: false
            referencedRelation: "agent_sequences"
            referencedColumns: ["id"]
          },
        ]
      }
      stripe_webhook_config: {
        Row: {
          account: string
          created_at: string
          endpoint_id: string
          signing_secret: string
        }
        Insert: {
          account: string
          created_at?: string
          endpoint_id: string
          signing_secret: string
        }
        Update: {
          account?: string
          created_at?: string
          endpoint_id?: string
          signing_secret?: string
        }
        Relationships: []
      }
      user_mailboxes: {
        Row: {
          company_id: string
          connected_at: string
          display_name: string | null
          email: string
          id: string
          last_error: string | null
          nylas_grant_id: string
          provider: string
          scopes: string[] | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          company_id: string
          connected_at?: string
          display_name?: string | null
          email: string
          id?: string
          last_error?: string | null
          nylas_grant_id: string
          provider: string
          scopes?: string[] | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          company_id?: string
          connected_at?: string
          display_name?: string | null
          email?: string
          id?: string
          last_error?: string | null
          nylas_grant_id?: string
          provider?: string
          scopes?: string[] | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          company_id: string
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      user_sending_domains: {
        Row: {
          created_at: string | null
          dns_records: Json | null
          domain: string
          from_email: string
          from_name: string
          id: string
          is_verified: boolean | null
          resend_domain_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          dns_records?: Json | null
          domain: string
          from_email: string
          from_name: string
          id?: string
          is_verified?: boolean | null
          resend_domain_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          dns_records?: Json | null
          domain?: string
          from_email?: string
          from_name?: string
          id?: string
          is_verified?: boolean | null
          resend_domain_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      beta_status: {
        Args: never
        Returns: {
          active: boolean
          enrich_limit: number
          enriches_used: number
          expires_at: string
          search_limit: number
          searches_used: number
        }[]
      }
      create_metered_clin_agent: {
        Args: {
          _brief: string
          _company_id: string
          _finish_date: string
          _goal: number
          _name: string
          _owner_id: string
          _per_day: number
          _project_id: string
          _request_id: string
          _timezone: string
        }
        Returns: Json
      }
      get_invite_by_token: {
        Args: { _token: string }
        Returns: {
          accepted: boolean
          company_name: string
          email: string
        }[]
      }
      get_user_company_id: { Args: { _user_id: string }; Returns: string }
      grant_paid_credits: {
        Args: {
          _amount: number
          _company_id: string
          _note: string
          _ref: string
        }
        Returns: boolean
      }
      has_company_role: {
        Args: {
          _company_id: string
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_company_member: {
        Args: { _company_id: string; _user_id: string }
        Returns: boolean
      }
      redeem_beta_code: { Args: { _code: string }; Returns: boolean }
      reset_monthly_credits: {
        Args: {
          _amount: number
          _company_id: string
          _note: string
          _ref: string
        }
        Returns: boolean
      }
      spend_credits: {
        Args: { _amount: number; _company_id: string }
        Returns: number
      }
    }
    Enums: {
      app_role: "admin" | "recruiter" | "viewer"
      candidate_fit_status: "unreviewed" | "good" | "maybe" | "not"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "recruiter", "viewer"],
      candidate_fit_status: ["unreviewed", "good", "maybe", "not"],
    },
  },
} as const
