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
          pdl_person_id: string
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
          pdl_person_id: string
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
          pdl_person_id?: string
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
          pdl_id: string | null
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
          pdl_id?: string | null
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
          pdl_id?: string | null
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
      companies: {
        Row: {
          created_at: string
          daily_email_limit: number
          from_email: string | null
          from_name: string | null
          id: string
          name: string
          reply_to_email: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          daily_email_limit?: number
          from_email?: string | null
          from_name?: string | null
          id?: string
          name: string
          reply_to_email?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          daily_email_limit?: number
          from_email?: string | null
          from_name?: string | null
          id?: string
          name?: string
          reply_to_email?: string | null
          updated_at?: string
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
      pdl_cache: {
        Row: {
          created_at: string
          expires_at: string
          filters: Json | null
          id: string
          query_hash: string
          query_text: string | null
          response: Json
          total_count: number | null
        }
        Insert: {
          created_at?: string
          expires_at?: string
          filters?: Json | null
          id?: string
          query_hash: string
          query_text?: string | null
          response: Json
          total_count?: number | null
        }
        Update: {
          created_at?: string
          expires_at?: string
          filters?: Json | null
          id?: string
          query_hash?: string
          query_text?: string | null
          response?: Json
          total_count?: number | null
        }
        Relationships: []
      }
      people_enrichments: {
        Row: {
          created_at: string
          enriched_data: Json
          id: string
          linkedin_url: string | null
          pdl_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          enriched_data: Json
          id?: string
          linkedin_url?: string | null
          pdl_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          enriched_data?: Json
          id?: string
          linkedin_url?: string | null
          pdl_id?: string | null
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
          name: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
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
      search_history: {
        Row: {
          company_id: string
          created_at: string
          id: string
          pdl_params: Json | null
          query_text: string
          result_count: number | null
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          pdl_params?: Json | null
          query_text: string
          result_count?: number | null
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          pdl_params?: Json | null
          query_text?: string
          result_count?: number | null
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
          pdl_query: Json | null
          review_mode: string | null
          role_description: string
          sequence_id: string | null
          sequence_mode: string | null
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
          pdl_query?: Json | null
          review_mode?: string | null
          role_description: string
          sequence_id?: string | null
          sequence_mode?: string | null
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
          pdl_query?: Json | null
          review_mode?: string | null
          role_description?: string
          sequence_id?: string | null
          sequence_mode?: string | null
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
      get_user_company_id: { Args: { _user_id: string }; Returns: string }
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
    }
    Enums: {
      app_role: "admin" | "recruiter" | "viewer"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
    },
  },
} as const
