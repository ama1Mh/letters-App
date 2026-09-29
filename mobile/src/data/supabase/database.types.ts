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
      api_rate_limits: {
        Row: {
          action: string
          count: number
          user_id: string
          window_start: string
        }
        Insert: {
          action: string
          count?: number
          user_id: string
          window_start: string
        }
        Update: {
          action?: string
          count?: number
          user_id?: string
          window_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_rate_limits_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      blocks: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "blocks_blocked_id_fkey"
            columns: ["blocked_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blocks_blocker_id_fkey"
            columns: ["blocker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      connections: {
        Row: {
          addressee_id: string
          created_at: string
          id: string
          invite_id: string | null
          requester_id: string
          responded_at: string | null
          status: Database["public"]["Enums"]["connection_status"]
          via: Database["public"]["Enums"]["connection_via"]
        }
        Insert: {
          addressee_id: string
          created_at?: string
          id?: string
          invite_id?: string | null
          requester_id: string
          responded_at?: string | null
          status?: Database["public"]["Enums"]["connection_status"]
          via: Database["public"]["Enums"]["connection_via"]
        }
        Update: {
          addressee_id?: string
          created_at?: string
          id?: string
          invite_id?: string | null
          requester_id?: string
          responded_at?: string | null
          status?: Database["public"]["Enums"]["connection_status"]
          via?: Database["public"]["Enums"]["connection_via"]
        }
        Relationships: [
          {
            foreignKeyName: "connections_addressee_id_fkey"
            columns: ["addressee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "connections_invite_id_fkey"
            columns: ["invite_id"]
            isOneToOne: false
            referencedRelation: "invites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "connections_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      invites: {
        Row: {
          code: string
          created_at: string
          expires_at: string | null
          id: string
          max_uses: number | null
          owner_id: string
          revoked_at: string | null
        }
        Insert: {
          code: string
          created_at?: string
          expires_at?: string | null
          id?: string
          max_uses?: number | null
          owner_id: string
          revoked_at?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          max_uses?: number | null
          owner_id?: string
          revoked_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invites_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      letters: {
        Row: {
          body: string
          body_dir: Database["public"]["Enums"]["text_dir"]
          created_at: string
          delivered_at: string | null
          design: Json
          id: string
          parent_letter_id: string | null
          read_at: string | null
          recipient_deleted_at: string | null
          recipient_id: string | null
          scheduled_at: string | null
          sender_deleted_at: string | null
          sender_id: string
          status: Database["public"]["Enums"]["letter_status"]
          subject: string | null
          thread_id: string
          updated_at: string
        }
        Insert: {
          body?: string
          body_dir?: Database["public"]["Enums"]["text_dir"]
          created_at?: string
          delivered_at?: string | null
          design?: Json
          id?: string
          parent_letter_id?: string | null
          read_at?: string | null
          recipient_deleted_at?: string | null
          recipient_id?: string | null
          scheduled_at?: string | null
          sender_deleted_at?: string | null
          sender_id: string
          status?: Database["public"]["Enums"]["letter_status"]
          subject?: string | null
          thread_id: string
          updated_at?: string
        }
        Update: {
          body?: string
          body_dir?: Database["public"]["Enums"]["text_dir"]
          created_at?: string
          delivered_at?: string | null
          design?: Json
          id?: string
          parent_letter_id?: string | null
          read_at?: string | null
          recipient_deleted_at?: string | null
          recipient_id?: string | null
          scheduled_at?: string | null
          sender_deleted_at?: string | null
          sender_id?: string
          status?: Database["public"]["Enums"]["letter_status"]
          subject?: string | null
          thread_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "letters_parent_letter_id_fkey"
            columns: ["parent_letter_id"]
            isOneToOne: false
            referencedRelation: "letters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "letters_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "letters_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_outbox: {
        Row: {
          attempts: number
          created_at: string
          error: string | null
          expo_ticket_id: string | null
          id: string
          letter_id: string
          locked_until: string | null
          next_attempt_at: string
          sent_at: string | null
          status: Database["public"]["Enums"]["notification_status"]
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          error?: string | null
          expo_ticket_id?: string | null
          id?: string
          letter_id: string
          locked_until?: string | null
          next_attempt_at?: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["notification_status"]
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Update: {
          attempts?: number
          created_at?: string
          error?: string | null
          expo_ticket_id?: string | null
          id?: string
          letter_id?: string
          locked_until?: string | null
          next_attempt_at?: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["notification_status"]
          type?: Database["public"]["Enums"]["notification_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_outbox_letter_id_fkey"
            columns: ["letter_id"]
            isOneToOne: false
            referencedRelation: "letters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_outbox_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_key: string | null
          created_at: string
          deleted_at: string | null
          discoverable_by_email: boolean
          discoverable_by_username: boolean
          display_name: string | null
          id: string
          locale: Database["public"]["Enums"]["app_locale"]
          onboarded_at: string | null
          read_receipts_enabled: boolean
          receive_mode: Database["public"]["Enums"]["receive_mode"]
          username: string | null
          username_skeleton: string | null
        }
        Insert: {
          avatar_key?: string | null
          created_at?: string
          deleted_at?: string | null
          discoverable_by_email?: boolean
          discoverable_by_username?: boolean
          display_name?: string | null
          id: string
          locale?: Database["public"]["Enums"]["app_locale"]
          onboarded_at?: string | null
          read_receipts_enabled?: boolean
          receive_mode?: Database["public"]["Enums"]["receive_mode"]
          username?: string | null
          username_skeleton?: string | null
        }
        Update: {
          avatar_key?: string | null
          created_at?: string
          deleted_at?: string | null
          discoverable_by_email?: boolean
          discoverable_by_username?: boolean
          display_name?: string | null
          id?: string
          locale?: Database["public"]["Enums"]["app_locale"]
          onboarded_at?: string | null
          read_receipts_enabled?: boolean
          receive_mode?: Database["public"]["Enums"]["receive_mode"]
          username?: string | null
          username_skeleton?: string | null
        }
        Relationships: []
      }
      reports: {
        Row: {
          created_at: string
          details: string | null
          id: string
          letter_id: string | null
          reason: Database["public"]["Enums"]["report_reason"]
          reported_id: string
          reporter_id: string
        }
        Insert: {
          created_at?: string
          details?: string | null
          id?: string
          letter_id?: string | null
          reason: Database["public"]["Enums"]["report_reason"]
          reported_id: string
          reporter_id: string
        }
        Update: {
          created_at?: string
          details?: string | null
          id?: string
          letter_id?: string | null
          reason?: Database["public"]["Enums"]["report_reason"]
          reported_id?: string
          reporter_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_letter_id_fkey"
            columns: ["letter_id"]
            isOneToOne: false
            referencedRelation: "letters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_reported_id_fkey"
            columns: ["reported_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reserved_words: {
        Row: {
          word: string
        }
        Insert: {
          word: string
        }
        Update: {
          word?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_connection: {
        Args: { p_connection_id: string }
        Returns: undefined
      }
      block_user: { Args: { p_blocked_id: string }; Returns: undefined }
      can_send: {
        Args: {
          p_parent_letter_id?: string
          p_recipient: string
          p_sender: string
        }
        Returns: boolean
      }
      cancel_connection_request: {
        Args: { p_connection_id: string }
        Returns: undefined
      }
      check_rate_limit: {
        Args: { p_action: string; p_limit: number; p_window: string }
        Returns: boolean
      }
      check_username_available: {
        Args: { p_username: string }
        Returns: boolean
      }
      complete_onboarding: {
        Args: {
          p_discoverable_by_email: boolean
          p_display_name: string
          p_locale: Database["public"]["Enums"]["app_locale"]
          p_username: string
        }
        Returns: undefined
      }
      decline_connection: {
        Args: { p_connection_id: string }
        Returns: undefined
      }
      delete_letter_for_me: {
        Args: { p_letter_id: string }
        Returns: undefined
      }
      delete_my_account: { Args: never; Returns: undefined }
      deliver_due_letters: { Args: { p_batch?: number }; Returns: number }
      deliver_letter_internal: {
        Args: { p_letter_id: string }
        Returns: Database["public"]["Enums"]["letter_status"]
      }
      find_user_by_email: {
        Args: { p_email: string }
        Returns: {
          avatar_key: string
          connection_state: string
          display_name: string
          id: string
          receive_mode: Database["public"]["Enums"]["receive_mode"]
          username: string
        }[]
      }
      generate_invite_code: { Args: never; Returns: string }
      get_letter: {
        Args: { p_letter_id: string }
        Returns: {
          body: string
          body_dir: Database["public"]["Enums"]["text_dir"]
          delivered_at: string
          design: Json
          id: string
          parent_letter_id: string
          read_at: string
          recipient_avatar_key: string
          recipient_display_name: string
          recipient_id: string
          recipient_username: string
          scheduled_at: string
          sender_avatar_key: string
          sender_display_name: string
          sender_id: string
          sender_username: string
          status: Database["public"]["Enums"]["letter_status"]
          subject: string
          thread_id: string
          viewer_role: string
        }[]
      }
      get_letter_read_at: { Args: { p_letter_id: string }; Returns: string }
      get_or_create_invite: {
        Args: never
        Returns: {
          code: string
          created_at: string
          expires_at: string | null
          id: string
          max_uses: number | null
          owner_id: string
          revoked_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "invites"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      is_blocked: { Args: { p_a: string; p_b: string }; Returns: boolean }
      is_reserved_word: { Args: { p_value: string }; Returns: boolean }
      is_valid_design: { Args: { p_design: Json }; Returns: boolean }
      is_valid_display_name: { Args: { p_name: string }; Returns: boolean }
      is_valid_username: { Args: { p_username: string }; Returns: boolean }
      list_inbox: {
        Args: { p_cursor_at?: string; p_cursor_id?: string; p_limit?: number }
        Returns: {
          body_dir: Database["public"]["Enums"]["text_dir"]
          delivered_at: string
          id: string
          preview: string
          read_at: string
          sender_avatar_key: string
          sender_display_name: string
          sender_id: string
          sender_username: string
          sort_at: string
          subject: string
          thread_id: string
        }[]
      }
      list_sent: {
        Args: {
          p_cursor_at?: string
          p_cursor_id?: string
          p_kind: string
          p_limit?: number
        }
        Returns: {
          body_dir: Database["public"]["Enums"]["text_dir"]
          delivered_at: string
          id: string
          preview: string
          read_at: string
          recipient_avatar_key: string
          recipient_display_name: string
          recipient_id: string
          recipient_username: string
          scheduled_at: string
          sort_at: string
          status: Database["public"]["Enums"]["letter_status"]
          subject: string
          thread_id: string
        }[]
      }
      list_thread: {
        Args: { p_thread_id: string }
        Returns: {
          body_dir: Database["public"]["Enums"]["text_dir"]
          delivered_at: string
          id: string
          is_mine: boolean
          other_avatar_key: string
          other_display_name: string
          other_id: string
          other_username: string
          parent_letter_id: string
          preview: string
          read_at: string
          scheduled_at: string
          sort_at: string
          status: Database["public"]["Enums"]["letter_status"]
          subject: string
          thread_id: string
        }[]
      }
      mark_read: { Args: { p_letter_id: string }; Returns: string }
      masked_read_at: {
        Args: {
          p_read_at: string
          p_recipient: string
          p_sender: string
          p_status: Database["public"]["Enums"]["letter_status"]
          p_viewer: string
        }
        Returns: string
      }
      redeem_invite: { Args: { p_code: string }; Returns: string }
      regenerate_invite: {
        Args: never
        Returns: {
          code: string
          created_at: string
          expires_at: string | null
          id: string
          max_uses: number | null
          owner_id: string
          revoked_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "invites"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      remove_connection: {
        Args: { p_connection_id: string }
        Returns: undefined
      }
      report_user: {
        Args: {
          p_details?: string
          p_letter_id?: string
          p_reason: Database["public"]["Enums"]["report_reason"]
          p_reported_id: string
        }
        Returns: undefined
      }
      request_connection: { Args: { p_addressee_id: string }; Returns: string }
      search_users: {
        Args: { p_query: string }
        Returns: {
          avatar_key: string
          connection_state: string
          display_name: string
          id: string
          receive_mode: Database["public"]["Enums"]["receive_mode"]
          username: string
        }[]
      }
      send_letter: {
        Args: { p_letter_id: string; p_scheduled_at?: string }
        Returns: Database["public"]["CompositeTypes"]["letter_send_state"]
        SetofOptions: {
          from: "*"
          to: "letter_send_state"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      unblock_user: { Args: { p_blocked_id: string }; Returns: undefined }
      unschedule_letter: {
        Args: { p_letter_id: string }
        Returns: Database["public"]["CompositeTypes"]["letter_send_state"]
        SetofOptions: {
          from: "*"
          to: "letter_send_state"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      username_skeleton: { Args: { p_username: string }; Returns: string }
    }
    Enums: {
      app_locale: "en" | "ar"
      connection_status: "pending" | "accepted" | "declined"
      connection_via: "invite" | "request"
      letter_status: "draft" | "scheduled" | "delivered" | "undeliverable"
      notification_status: "pending" | "sent" | "failed"
      notification_type: "letter_delivered"
      receive_mode: "everyone" | "invite_only"
      report_reason:
        | "spam"
        | "harassment"
        | "inappropriate"
        | "impersonation"
        | "other"
      text_dir: "ltr" | "rtl"
    }
    CompositeTypes: {
      letter_send_state: {
        status: Database["public"]["Enums"]["letter_status"] | null
        scheduled_at: string | null
        delivered_at: string | null
      }
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
      app_locale: ["en", "ar"],
      connection_status: ["pending", "accepted", "declined"],
      connection_via: ["invite", "request"],
      letter_status: ["draft", "scheduled", "delivered", "undeliverable"],
      notification_status: ["pending", "sent", "failed"],
      notification_type: ["letter_delivered"],
      receive_mode: ["everyone", "invite_only"],
      report_reason: [
        "spam",
        "harassment",
        "inappropriate",
        "impersonation",
        "other",
      ],
      text_dir: ["ltr", "rtl"],
    },
  },
} as const
