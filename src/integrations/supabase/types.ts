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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      admin_access_log: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          id: string
          ip: string | null
          organization_id: string | null
          success: boolean
          user_agent: string | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          id?: string
          ip?: string | null
          organization_id?: string | null
          success?: boolean
          user_agent?: string | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          id?: string
          ip?: string | null
          organization_id?: string | null
          success?: boolean
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      admin_sessions: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          organization_id: string
          user_id: string
          verified_at: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          organization_id: string
          user_id: string
          verified_at?: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          organization_id?: string
          user_id?: string
          verified_at?: string
        }
        Relationships: []
      }
      ai_goal_recommendations: {
        Row: {
          created_at: string
          goal_id: string | null
          id: string
          milestones: Json | null
          raw_response: Json | null
          strategy: string
          tips: Json | null
          user_id: string
          weekly_savings: number | null
        }
        Insert: {
          created_at?: string
          goal_id?: string | null
          id?: string
          milestones?: Json | null
          raw_response?: Json | null
          strategy: string
          tips?: Json | null
          user_id: string
          weekly_savings?: number | null
        }
        Update: {
          created_at?: string
          goal_id?: string | null
          id?: string
          milestones?: Json | null
          raw_response?: Json | null
          strategy?: string
          tips?: Json | null
          user_id?: string
          weekly_savings?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_goal_recommendations_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "savings_goals"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_insights_history: {
        Row: {
          attachments: Json | null
          content: string
          created_at: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          attachments?: Json | null
          content: string
          created_at?: string
          id?: string
          role: string
          user_id: string
        }
        Update: {
          attachments?: Json | null
          content?: string
          created_at?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_message_usage: {
        Row: {
          count: number
          updated_at: string
          user_id: string
          window_start: string
        }
        Insert: {
          count?: number
          updated_at?: string
          user_id: string
          window_start?: string
        }
        Update: {
          count?: number
          updated_at?: string
          user_id?: string
          window_start?: string
        }
        Relationships: []
      }
      audio_briefing_recipients: {
        Row: {
          briefing_id: string
          completed_at: string | null
          created_at: string
          first_played_at: string | null
          id: string
          last_played_at: string | null
          listened_at: string | null
          progress_seconds: number
          user_id: string
        }
        Insert: {
          briefing_id: string
          completed_at?: string | null
          created_at?: string
          first_played_at?: string | null
          id?: string
          last_played_at?: string | null
          listened_at?: string | null
          progress_seconds?: number
          user_id: string
        }
        Update: {
          briefing_id?: string
          completed_at?: string | null
          created_at?: string
          first_played_at?: string | null
          id?: string
          last_played_at?: string | null
          listened_at?: string | null
          progress_seconds?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audio_briefing_recipients_briefing_id_fkey"
            columns: ["briefing_id"]
            isOneToOne: false
            referencedRelation: "audio_briefings"
            referencedColumns: ["id"]
          },
        ]
      }
      audio_briefings: {
        Row: {
          audio_path: string
          created_at: string
          description: string | null
          duration_seconds: number | null
          id: string
          organization_id: string
          owner_id: string
          title: string
        }
        Insert: {
          audio_path: string
          created_at?: string
          description?: string | null
          duration_seconds?: number | null
          id?: string
          organization_id: string
          owner_id: string
          title: string
        }
        Update: {
          audio_path?: string
          created_at?: string
          description?: string | null
          duration_seconds?: number | null
          id?: string
          organization_id?: string
          owner_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "audio_briefings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      briefing_events: {
        Row: {
          briefing_id: string
          created_at: string
          event_type: string
          id: string
          position_seconds: number | null
          user_id: string
        }
        Insert: {
          briefing_id: string
          created_at?: string
          event_type: string
          id?: string
          position_seconds?: number | null
          user_id: string
        }
        Update: {
          briefing_id?: string
          created_at?: string
          event_type?: string
          id?: string
          position_seconds?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "briefing_events_briefing_id_fkey"
            columns: ["briefing_id"]
            isOneToOne: false
            referencedRelation: "audio_briefings"
            referencedColumns: ["id"]
          },
        ]
      }
      budgets: {
        Row: {
          category: string
          created_at: string
          id: string
          limit_amount: number
          spent: number
          updated_at: string
          user_id: string
        }
        Insert: {
          category: string
          created_at?: string
          id?: string
          limit_amount?: number
          spent?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          limit_amount?: number
          spent?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      collab_case_assignees: {
        Row: {
          assigned_at: string
          case_id: string
          user_id: string
        }
        Insert: {
          assigned_at?: string
          case_id: string
          user_id: string
        }
        Update: {
          assigned_at?: string
          case_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "collab_case_assignees_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "collab_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      collab_case_messages: {
        Row: {
          body: string
          case_id: string
          created_at: string
          id: string
          mentions: string[] | null
          user_id: string
        }
        Insert: {
          body: string
          case_id: string
          created_at?: string
          id?: string
          mentions?: string[] | null
          user_id: string
        }
        Update: {
          body?: string
          case_id?: string
          created_at?: string
          id?: string
          mentions?: string[] | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "collab_case_messages_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "collab_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      collab_cases: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          id: string
          organization_id: string
          priority: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          organization_id: string
          priority?: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          organization_id?: string
          priority?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount: number
          category: string
          created_at: string
          date: string
          id: string
          name: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number
          category?: string
          created_at?: string
          date?: string
          id?: string
          name: string
          type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          date?: string
          id?: string
          name?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      goal_progress_history: {
        Row: {
          created_at: string
          goal_id: string
          id: string
          note: string | null
          saved: number
          target: number
          user_id: string
        }
        Insert: {
          created_at?: string
          goal_id: string
          id?: string
          note?: string | null
          saved: number
          target: number
          user_id: string
        }
        Update: {
          created_at?: string
          goal_id?: string
          id?: string
          note?: string | null
          saved?: number
          target?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "goal_progress_history_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "savings_goals"
            referencedColumns: ["id"]
          },
        ]
      }
      holdings: {
        Row: {
          asset_type: string
          avg_price: number
          created_at: string
          id: string
          name: string
          notes: string | null
          organization_id: string | null
          shares: number
          symbol: string
          updated_at: string
          user_id: string
        }
        Insert: {
          asset_type?: string
          avg_price?: number
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          organization_id?: string | null
          shares?: number
          symbol: string
          updated_at?: string
          user_id: string
        }
        Update: {
          asset_type?: string
          avg_price?: number
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          organization_id?: string | null
          shares?: number
          symbol?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "holdings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      integrity_reports: {
        Row: {
          checks: Json
          created_at: string
          id: string
          issues_count: number
          organization_id: string
          passed: boolean
          run_by: string | null
        }
        Insert: {
          checks: Json
          created_at?: string
          id?: string
          issues_count?: number
          organization_id: string
          passed: boolean
          run_by?: string | null
        }
        Update: {
          checks?: Json
          created_at?: string
          id?: string
          issues_count?: number
          organization_id?: string
          passed?: boolean
          run_by?: string | null
        }
        Relationships: []
      }
      login_otps: {
        Row: {
          code_hash: string
          created_at: string
          expires_at: string
          id: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          code_hash: string
          created_at?: string
          expires_at: string
          id?: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          code_hash?: string
          created_at?: string
          expires_at?: string
          id?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      membership_requests: {
        Row: {
          created_at: string
          id: string
          message: string | null
          organization_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message?: string | null
          organization_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string | null
          organization_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "membership_requests_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      mfa_recovery_codes: {
        Row: {
          code_hash: string
          created_at: string
          id: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          code_hash: string
          created_at?: string
          id?: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          code_hash?: string
          created_at?: string
          id?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          link: string | null
          message: string
          read: boolean
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          link?: string | null
          message?: string
          read?: boolean
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          link?: string | null
          message?: string
          read?: boolean
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      org_messages: {
        Row: {
          body: string
          created_at: string
          id: string
          organization_id: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          organization_id: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          organization_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_messages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          id: string
          join_code: string | null
          name: string
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          join_code?: string | null
          name: string
          type?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          join_code?: string | null
          name?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      price_alerts: {
        Row: {
          active: boolean
          condition: string
          created_at: string
          id: string
          last_triggered_at: string | null
          name: string
          organization_id: string | null
          symbol: string
          target_price: number
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          condition?: string
          created_at?: string
          id?: string
          last_triggered_at?: string | null
          name?: string
          organization_id?: string | null
          symbol: string
          target_price: number
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          condition?: string
          created_at?: string
          id?: string
          last_triggered_at?: string | null
          name?: string
          organization_id?: string | null
          symbol?: string
          target_price?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "price_alerts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          currency: string | null
          email: string | null
          full_name: string | null
          id: string
          phone: string | null
          phone2: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          currency?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          phone2?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          currency?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          phone2?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      recurring_expenses: {
        Row: {
          amount: number
          cadence: string
          category: string
          created_at: string
          id: string
          last_seen: string
          merchant: string
          occurrences: number
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          cadence?: string
          category: string
          created_at?: string
          id?: string
          last_seen?: string
          merchant: string
          occurrences?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          cadence?: string
          category?: string
          created_at?: string
          id?: string
          last_seen?: string
          merchant?: string
          occurrences?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      savings_goals: {
        Row: {
          created_at: string
          icon: string
          id: string
          name: string
          saved: number
          target: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          icon?: string
          id?: string
          name: string
          saved?: number
          target?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          icon?: string
          id?: string
          name?: string
          saved?: number
          target?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      settings_audit_log: {
        Row: {
          changes: Json
          created_at: string
          id: string
          section: string
          user_id: string
        }
        Insert: {
          changes?: Json
          created_at?: string
          id?: string
          section: string
          user_id: string
        }
        Update: {
          changes?: Json
          created_at?: string
          id?: string
          section?: string
          user_id?: string
        }
        Relationships: []
      }
      support_messages: {
        Row: {
          created_at: string
          email: string
          error: string | null
          id: string
          message: string
          name: string
          phone: string | null
          status: string
        }
        Insert: {
          created_at?: string
          email: string
          error?: string | null
          id?: string
          message: string
          name: string
          phone?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          email?: string
          error?: string | null
          id?: string
          message?: string
          name?: string
          phone?: string | null
          status?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          amount: number | null
          approved_at: string | null
          approved_by: string | null
          assigned_to: string
          category: string
          completed_at: string | null
          created_at: string
          created_by: string
          currency: string | null
          description: string | null
          due_date: string | null
          id: string
          organization_id: string
          priority: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          amount?: number | null
          approved_at?: string | null
          approved_by?: string | null
          assigned_to: string
          category?: string
          completed_at?: string | null
          created_at?: string
          created_by: string
          currency?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          organization_id: string
          priority?: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          amount?: number | null
          approved_at?: string | null
          approved_by?: string | null
          assigned_to?: string
          category?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string
          currency?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          organization_id?: string
          priority?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_settings: {
        Row: {
          active_organization_id: string | null
          created_at: string
          id: string
          notifications: Json | null
          preferences: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          active_organization_id?: string | null
          created_at?: string
          id?: string
          notifications?: Json | null
          preferences?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          active_organization_id?: string | null
          created_at?: string
          id?: string
          notifications?: Json | null
          preferences?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_settings_active_organization_id_fkey"
            columns: ["active_organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      watchlist: {
        Row: {
          asset_type: string
          created_at: string
          id: string
          name: string
          organization_id: string | null
          symbol: string
          user_id: string
        }
        Insert: {
          asset_type?: string
          created_at?: string
          id?: string
          name?: string
          organization_id?: string | null
          symbol: string
          user_id: string
        }
        Update: {
          asset_type?: string
          created_at?: string
          id?: string
          name?: string
          organization_id?: string | null
          symbol?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "watchlist_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      find_org_by_code: {
        Args: { _code: string }
        Returns: {
          id: string
          name: string
          type: string
        }[]
      }
      generate_join_code: { Args: never; Returns: string }
      get_user_org: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _org_id: string
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_org_member: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      sync_budget_spent: {
        Args: { _category: string; _user_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "owner" | "accountant" | "analyst" | "viewer" | "admin"
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
      app_role: ["owner", "accountant", "analyst", "viewer", "admin"],
    },
  },
} as const
