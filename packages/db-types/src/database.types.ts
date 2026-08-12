export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      alert_state: {
        Row: {
          alert_key: string;
          is_firing: boolean;
          last_fired_at: string | null;
          last_resolved_at: string | null;
          last_value: number | null;
          updated_at: string;
        };
        Insert: {
          alert_key: string;
          is_firing?: boolean;
          last_fired_at?: string | null;
          last_resolved_at?: string | null;
          last_value?: number | null;
          updated_at?: string;
        };
        Update: {
          alert_key?: string;
          is_firing?: boolean;
          last_fired_at?: string | null;
          last_resolved_at?: string | null;
          last_value?: number | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      app_settings: {
        Row: {
          description: string;
          is_public: boolean;
          key: string;
          updated_at: string;
          updated_by: string | null;
          value: Json;
        };
        Insert: {
          description?: string;
          is_public?: boolean;
          key: string;
          updated_at?: string;
          updated_by?: string | null;
          value?: Json;
        };
        Update: {
          description?: string;
          is_public?: boolean;
          key?: string;
          updated_at?: string;
          updated_by?: string | null;
          value?: Json;
        };
        Relationships: [];
      };
      audit_events: {
        Row: {
          action: string;
          actor_id: string | null;
          created_at: string;
          device_id: string | null;
          id: string;
          ip_address: unknown;
          metadata: Json | null;
          platform: string | null;
          resource_id: string | null;
          resource_type: string;
          user_agent: string | null;
          workspace_id: string | null;
        };
        Insert: {
          action: string;
          actor_id?: string | null;
          created_at?: string;
          device_id?: string | null;
          id?: string;
          ip_address?: unknown;
          metadata?: Json | null;
          platform?: string | null;
          resource_id?: string | null;
          resource_type: string;
          user_agent?: string | null;
          workspace_id?: string | null;
        };
        Update: {
          action?: string;
          actor_id?: string | null;
          created_at?: string;
          device_id?: string | null;
          id?: string;
          ip_address?: unknown;
          metadata?: Json | null;
          platform?: string | null;
          resource_id?: string | null;
          resource_type?: string;
          user_agent?: string | null;
          workspace_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'audit_events_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      broadcast_receipts: {
        Row: {
          broadcast_id: string;
          dismissed_at: string | null;
          seen_at: string;
          user_id: string;
        };
        Insert: {
          broadcast_id: string;
          dismissed_at?: string | null;
          seen_at?: string;
          user_id: string;
        };
        Update: {
          broadcast_id?: string;
          dismissed_at?: string | null;
          seen_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'broadcast_receipts_broadcast_id_fkey';
            columns: ['broadcast_id'];
            isOneToOne: false;
            referencedRelation: 'broadcasts';
            referencedColumns: ['id'];
          },
        ];
      };
      broadcasts: {
        Row: {
          audience: string;
          body_bn: string;
          body_en: string;
          created_at: string;
          created_by: string | null;
          dismissible: boolean;
          expires_at: string | null;
          id: string;
          link_url: string | null;
          publish_at: string | null;
          severity: string;
          status: string;
          title_bn: string;
          title_en: string;
          updated_at: string;
        };
        Insert: {
          audience?: string;
          body_bn?: string;
          body_en?: string;
          created_at?: string;
          created_by?: string | null;
          dismissible?: boolean;
          expires_at?: string | null;
          id?: string;
          link_url?: string | null;
          publish_at?: string | null;
          severity?: string;
          status?: string;
          title_bn: string;
          title_en: string;
          updated_at?: string;
        };
        Update: {
          audience?: string;
          body_bn?: string;
          body_en?: string;
          created_at?: string;
          created_by?: string | null;
          dismissible?: boolean;
          expires_at?: string | null;
          id?: string;
          link_url?: string | null;
          publish_at?: string | null;
          severity?: string;
          status?: string;
          title_bn?: string;
          title_en?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      budget_lines: {
        Row: {
          alert_threshold_pct: number;
          budget_id: string;
          category_id: string;
          created_at: string;
          id: string;
          planned_minor: number;
          updated_at: string;
          workspace_id: string;
        };
        Insert: {
          alert_threshold_pct?: number;
          budget_id: string;
          category_id: string;
          created_at?: string;
          id?: string;
          planned_minor: number;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          alert_threshold_pct?: number;
          budget_id?: string;
          category_id?: string;
          created_at?: string;
          id?: string;
          planned_minor?: number;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'budget_lines_budget_id_fkey';
            columns: ['budget_id'];
            isOneToOne: false;
            referencedRelation: 'budgets';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'budget_lines_category_id_fkey';
            columns: ['category_id'];
            isOneToOne: false;
            referencedRelation: 'categories';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'budget_lines_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      budgets: {
        Row: {
          cadence: string;
          created_at: string;
          created_by: string;
          id: string;
          name: string;
          period_end: string | null;
          period_start: string;
          rollover: boolean;
          status: string;
          updated_at: string;
          workspace_id: string;
        };
        Insert: {
          cadence?: string;
          created_at?: string;
          created_by: string;
          id?: string;
          name?: string;
          period_end?: string | null;
          period_start: string;
          rollover?: boolean;
          status?: string;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          cadence?: string;
          created_at?: string;
          created_by?: string;
          id?: string;
          name?: string;
          period_end?: string | null;
          period_start?: string;
          rollover?: boolean;
          status?: string;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'budgets_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      calendar_events: {
        Row: {
          amount_minor: number | null;
          created_at: string;
          created_by: string;
          currency_code: string | null;
          due_at: string;
          id: string;
          journal_entry_id: string | null;
          local_date: string;
          recurring_rule_id: string | null;
          reminder_offsets: number[];
          savings_goal_id: string | null;
          status: string;
          timezone: string;
          title: string;
          type: string;
          updated_at: string;
          workspace_id: string;
        };
        Insert: {
          amount_minor?: number | null;
          created_at?: string;
          created_by: string;
          currency_code?: string | null;
          due_at: string;
          id?: string;
          journal_entry_id?: string | null;
          local_date: string;
          recurring_rule_id?: string | null;
          reminder_offsets?: number[];
          savings_goal_id?: string | null;
          status?: string;
          timezone?: string;
          title: string;
          type: string;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          amount_minor?: number | null;
          created_at?: string;
          created_by?: string;
          currency_code?: string | null;
          due_at?: string;
          id?: string;
          journal_entry_id?: string | null;
          local_date?: string;
          recurring_rule_id?: string | null;
          reminder_offsets?: number[];
          savings_goal_id?: string | null;
          status?: string;
          timezone?: string;
          title?: string;
          type?: string;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'calendar_events_journal_entry_id_fkey';
            columns: ['journal_entry_id'];
            isOneToOne: false;
            referencedRelation: 'journal_entries';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'calendar_events_recurring_rule_id_fkey';
            columns: ['recurring_rule_id'];
            isOneToOne: false;
            referencedRelation: 'recurring_rules';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'calendar_events_savings_goal_id_fkey';
            columns: ['savings_goal_id'];
            isOneToOne: false;
            referencedRelation: 'savings_goals';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'calendar_events_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      categories: {
        Row: {
          archived_at: string | null;
          color: string;
          created_at: string;
          custom_name: string | null;
          deleted_at: string | null;
          icon: string;
          id: string;
          kind: string;
          ledger_account_id: string;
          parent_id: string | null;
          sort_order: number;
          translation_key: string | null;
          updated_at: string;
          workspace_id: string | null;
        };
        Insert: {
          archived_at?: string | null;
          color?: string;
          created_at?: string;
          custom_name?: string | null;
          deleted_at?: string | null;
          icon?: string;
          id?: string;
          kind: string;
          ledger_account_id: string;
          parent_id?: string | null;
          sort_order?: number;
          translation_key?: string | null;
          updated_at?: string;
          workspace_id?: string | null;
        };
        Update: {
          archived_at?: string | null;
          color?: string;
          created_at?: string;
          custom_name?: string | null;
          deleted_at?: string | null;
          icon?: string;
          id?: string;
          kind?: string;
          ledger_account_id?: string;
          parent_id?: string | null;
          sort_order?: number;
          translation_key?: string | null;
          updated_at?: string;
          workspace_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'categories_ledger_account_id_fkey';
            columns: ['ledger_account_id'];
            isOneToOne: false;
            referencedRelation: 'ledger_accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'categories_parent_id_fkey';
            columns: ['parent_id'];
            isOneToOne: false;
            referencedRelation: 'categories';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'categories_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      debt_details: {
        Row: {
          annual_rate_bps: number | null;
          created_at: string;
          due_day: number | null;
          ledger_account_id: string;
          minimum_payment_minor: number | null;
          principal_minor: number;
          updated_at: string;
          workspace_id: string;
        };
        Insert: {
          annual_rate_bps?: number | null;
          created_at?: string;
          due_day?: number | null;
          ledger_account_id: string;
          minimum_payment_minor?: number | null;
          principal_minor: number;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          annual_rate_bps?: number | null;
          created_at?: string;
          due_day?: number | null;
          ledger_account_id?: string;
          minimum_payment_minor?: number | null;
          principal_minor?: number;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'debt_details_ledger_account_id_fkey';
            columns: ['ledger_account_id'];
            isOneToOne: true;
            referencedRelation: 'ledger_accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'debt_details_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      donation_options: {
        Row: {
          color_from: string;
          color_to: string;
          created_at: string;
          description: string;
          display_order: number;
          icon: string;
          id: string;
          is_active: boolean;
          payment_methods: Json;
          subtitle: string;
          title: string;
          type: string;
          updated_at: string;
        };
        Insert: {
          color_from?: string;
          color_to?: string;
          created_at?: string;
          description?: string;
          display_order?: number;
          icon?: string;
          id?: string;
          is_active?: boolean;
          payment_methods?: Json;
          subtitle?: string;
          title: string;
          type: string;
          updated_at?: string;
        };
        Update: {
          color_from?: string;
          color_to?: string;
          created_at?: string;
          description?: string;
          display_order?: number;
          icon?: string;
          id?: string;
          is_active?: boolean;
          payment_methods?: Json;
          subtitle?: string;
          title?: string;
          type?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      idempotency_records: {
        Row: {
          actor_user_id: string;
          created_at: string;
          expires_at: string;
          id: string;
          key_hash: string;
          request_fingerprint: string | null;
          response_body: Json | null;
          response_status: number | null;
          route: string;
        };
        Insert: {
          actor_user_id: string;
          created_at?: string;
          expires_at?: string;
          id?: string;
          key_hash: string;
          request_fingerprint?: string | null;
          response_body?: Json | null;
          response_status?: number | null;
          route: string;
        };
        Update: {
          actor_user_id?: string;
          created_at?: string;
          expires_at?: string;
          id?: string;
          key_hash?: string;
          request_fingerprint?: string | null;
          response_body?: Json | null;
          response_status?: number | null;
          route?: string;
        };
        Relationships: [];
      };
      journal_entries: {
        Row: {
          client_entry_id: string;
          created_at: string;
          created_by: string;
          entry_type: string;
          id: string;
          idempotency_key_hash: string | null;
          local_date: string;
          note: string | null;
          occurred_at: string;
          payee: string | null;
          posted_at: string | null;
          reverses_entry_id: string | null;
          source: string;
          status: string;
          updated_at: string;
          version: number;
          workspace_id: string;
        };
        Insert: {
          client_entry_id: string;
          created_at?: string;
          created_by: string;
          entry_type: string;
          id?: string;
          idempotency_key_hash?: string | null;
          local_date?: string;
          note?: string | null;
          occurred_at?: string;
          payee?: string | null;
          posted_at?: string | null;
          reverses_entry_id?: string | null;
          source?: string;
          status?: string;
          updated_at?: string;
          version?: number;
          workspace_id: string;
        };
        Update: {
          client_entry_id?: string;
          created_at?: string;
          created_by?: string;
          entry_type?: string;
          id?: string;
          idempotency_key_hash?: string | null;
          local_date?: string;
          note?: string | null;
          occurred_at?: string;
          payee?: string | null;
          posted_at?: string | null;
          reverses_entry_id?: string | null;
          source?: string;
          status?: string;
          updated_at?: string;
          version?: number;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'journal_entries_reverses_entry_id_fkey';
            columns: ['reverses_entry_id'];
            isOneToOne: false;
            referencedRelation: 'journal_entries';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'journal_entries_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      journal_entry_tags: {
        Row: {
          created_at: string;
          journal_entry_id: string;
          tag_id: string;
          updated_at: string;
          workspace_id: string;
        };
        Insert: {
          created_at?: string;
          journal_entry_id: string;
          tag_id: string;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          created_at?: string;
          journal_entry_id?: string;
          tag_id?: string;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'journal_entry_tags_journal_entry_id_fkey';
            columns: ['journal_entry_id'];
            isOneToOne: false;
            referencedRelation: 'journal_entries';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'journal_entry_tags_tag_id_fkey';
            columns: ['tag_id'];
            isOneToOne: false;
            referencedRelation: 'tags';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'journal_entry_tags_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      journal_postings: {
        Row: {
          base_amount_minor: number;
          created_at: string;
          credit_minor: number;
          currency_code: string;
          debit_minor: number;
          fx_rate: number | null;
          id: string;
          journal_entry_id: string;
          ledger_account_id: string;
          memo: string | null;
          updated_at: string;
          workspace_id: string;
        };
        Insert: {
          base_amount_minor?: number;
          created_at?: string;
          credit_minor?: number;
          currency_code: string;
          debit_minor?: number;
          fx_rate?: number | null;
          id?: string;
          journal_entry_id: string;
          ledger_account_id: string;
          memo?: string | null;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          base_amount_minor?: number;
          created_at?: string;
          credit_minor?: number;
          currency_code?: string;
          debit_minor?: number;
          fx_rate?: number | null;
          id?: string;
          journal_entry_id?: string;
          ledger_account_id?: string;
          memo?: string | null;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'journal_postings_journal_entry_id_fkey';
            columns: ['journal_entry_id'];
            isOneToOne: false;
            referencedRelation: 'journal_entries';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'journal_postings_ledger_account_id_fkey';
            columns: ['ledger_account_id'];
            isOneToOne: false;
            referencedRelation: 'ledger_accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'journal_postings_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      ledger_accounts: {
        Row: {
          archived_at: string | null;
          class: string;
          created_at: string;
          created_by: string;
          currency_code: string;
          deleted_at: string | null;
          id: string;
          include_in_budget: boolean;
          include_in_net_worth: boolean;
          name: string;
          normal_balance: string;
          opening_date: string | null;
          subtype: string;
          updated_at: string;
          version: number;
          workspace_id: string;
        };
        Insert: {
          archived_at?: string | null;
          class: string;
          created_at?: string;
          created_by: string;
          currency_code: string;
          deleted_at?: string | null;
          id?: string;
          include_in_budget?: boolean;
          include_in_net_worth?: boolean;
          name: string;
          normal_balance: string;
          opening_date?: string | null;
          subtype: string;
          updated_at?: string;
          version?: number;
          workspace_id: string;
        };
        Update: {
          archived_at?: string | null;
          class?: string;
          created_at?: string;
          created_by?: string;
          currency_code?: string;
          deleted_at?: string | null;
          id?: string;
          include_in_budget?: boolean;
          include_in_net_worth?: boolean;
          name?: string;
          normal_balance?: string;
          opening_date?: string | null;
          subtype?: string;
          updated_at?: string;
          version?: number;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'ledger_accounts_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      notification_campaigns: {
        Row: {
          action_url: string | null;
          audience: string;
          body_bn: string | null;
          body_en: string;
          category: string;
          created_at: string;
          created_by: string | null;
          error: string | null;
          expires_at: string | null;
          id: string;
          recipient_count: number;
          scheduled_for: string;
          severity: string;
          status: string;
          title_bn: string | null;
          title_en: string;
          updated_at: string;
        };
        Insert: {
          action_url?: string | null;
          audience: string;
          body_bn?: string | null;
          body_en: string;
          category: string;
          created_at?: string;
          created_by?: string | null;
          error?: string | null;
          expires_at?: string | null;
          id?: string;
          recipient_count?: number;
          scheduled_for?: string;
          severity?: string;
          status?: string;
          title_bn?: string | null;
          title_en: string;
          updated_at?: string;
        };
        Update: {
          action_url?: string | null;
          audience?: string;
          body_bn?: string | null;
          body_en?: string;
          category?: string;
          created_at?: string;
          created_by?: string | null;
          error?: string | null;
          expires_at?: string | null;
          id?: string;
          recipient_count?: number;
          scheduled_for?: string;
          severity?: string;
          status?: string;
          title_bn?: string | null;
          title_en?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      notification_deliveries: {
        Row: {
          attempts: number;
          channel: string;
          created_at: string;
          device_id: string | null;
          error: string | null;
          id: string;
          notification_id: string;
          provider_id: string | null;
          sent_at: string | null;
          status: string;
        };
        Insert: {
          attempts?: number;
          channel: string;
          created_at?: string;
          device_id?: string | null;
          error?: string | null;
          id?: string;
          notification_id: string;
          provider_id?: string | null;
          sent_at?: string | null;
          status: string;
        };
        Update: {
          attempts?: number;
          channel?: string;
          created_at?: string;
          device_id?: string | null;
          error?: string | null;
          id?: string;
          notification_id?: string;
          provider_id?: string | null;
          sent_at?: string | null;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'notification_deliveries_device_id_fkey';
            columns: ['device_id'];
            isOneToOne: false;
            referencedRelation: 'user_devices';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'notification_deliveries_notification_id_fkey';
            columns: ['notification_id'];
            isOneToOne: false;
            referencedRelation: 'notifications';
            referencedColumns: ['id'];
          },
        ];
      };
      notification_hints: {
        Row: {
          created_at: string;
          id: number;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: never;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: never;
          user_id?: string;
        };
        Relationships: [];
      };
      notification_preferences: {
        Row: {
          category: string;
          digest: string;
          email: boolean;
          in_app: boolean;
          push: boolean;
          user_id: string;
        };
        Insert: {
          category: string;
          digest?: string;
          email?: boolean;
          in_app?: boolean;
          push?: boolean;
          user_id: string;
        };
        Update: {
          category?: string;
          digest?: string;
          email?: boolean;
          in_app?: boolean;
          push?: boolean;
          user_id?: string;
        };
        Relationships: [];
      };
      notification_templates: {
        Row: {
          action_url: string | null;
          body_bn: string | null;
          body_en: string;
          category: string;
          created_at: string;
          created_by: string | null;
          id: string;
          key: string;
          title_bn: string | null;
          title_en: string;
          updated_at: string;
        };
        Insert: {
          action_url?: string | null;
          body_bn?: string | null;
          body_en: string;
          category: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          key: string;
          title_bn?: string | null;
          title_en: string;
          updated_at?: string;
        };
        Update: {
          action_url?: string | null;
          body_bn?: string | null;
          body_en?: string;
          category?: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          key?: string;
          title_bn?: string | null;
          title_en?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      notifications: {
        Row: {
          action_url: string | null;
          archived_at: string | null;
          body_bn: string | null;
          body_en: string;
          category: string;
          created_at: string;
          dedupe_key: string | null;
          deleted_at: string | null;
          expires_at: string | null;
          id: string;
          metadata: Json;
          read_at: string | null;
          resource_id: string | null;
          resource_type: string | null;
          severity: string;
          title_bn: string | null;
          title_en: string;
          updated_at: string;
          user_id: string;
          workspace_id: string | null;
        };
        Insert: {
          action_url?: string | null;
          archived_at?: string | null;
          body_bn?: string | null;
          body_en: string;
          category: string;
          created_at?: string;
          dedupe_key?: string | null;
          deleted_at?: string | null;
          expires_at?: string | null;
          id?: string;
          metadata?: Json;
          read_at?: string | null;
          resource_id?: string | null;
          resource_type?: string | null;
          severity?: string;
          title_bn?: string | null;
          title_en: string;
          updated_at?: string;
          user_id: string;
          workspace_id?: string | null;
        };
        Update: {
          action_url?: string | null;
          archived_at?: string | null;
          body_bn?: string | null;
          body_en?: string;
          category?: string;
          created_at?: string;
          dedupe_key?: string | null;
          deleted_at?: string | null;
          expires_at?: string | null;
          id?: string;
          metadata?: Json;
          read_at?: string | null;
          resource_id?: string | null;
          resource_type?: string | null;
          severity?: string;
          title_bn?: string | null;
          title_en?: string;
          updated_at?: string;
          user_id?: string;
          workspace_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'notifications_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      profiles: {
        Row: {
          amount_privacy_default: boolean;
          avatar_path: string | null;
          base_currency: string;
          created_at: string;
          deletion_requested_at: string | null;
          deletion_scheduled_for: string | null;
          display_name: string;
          id: string;
          is_super_admin: boolean;
          locale: string;
          onboarding_status: string;
          persona: string | null;
          quiet_hours_end: string | null;
          quiet_hours_start: string | null;
          quiet_hours_tz: string | null;
          status: string;
          suspended_at: string | null;
          suspended_reason: string | null;
          timezone: string;
          updated_at: string;
          week_starts_on: number;
        };
        Insert: {
          amount_privacy_default?: boolean;
          avatar_path?: string | null;
          base_currency?: string;
          created_at?: string;
          deletion_requested_at?: string | null;
          deletion_scheduled_for?: string | null;
          display_name?: string;
          id: string;
          is_super_admin?: boolean;
          locale?: string;
          onboarding_status?: string;
          persona?: string | null;
          quiet_hours_end?: string | null;
          quiet_hours_start?: string | null;
          quiet_hours_tz?: string | null;
          status?: string;
          suspended_at?: string | null;
          suspended_reason?: string | null;
          timezone?: string;
          updated_at?: string;
          week_starts_on?: number;
        };
        Update: {
          amount_privacy_default?: boolean;
          avatar_path?: string | null;
          base_currency?: string;
          created_at?: string;
          deletion_requested_at?: string | null;
          deletion_scheduled_for?: string | null;
          display_name?: string;
          id?: string;
          is_super_admin?: boolean;
          locale?: string;
          onboarding_status?: string;
          persona?: string | null;
          quiet_hours_end?: string | null;
          quiet_hours_start?: string | null;
          quiet_hours_tz?: string | null;
          status?: string;
          suspended_at?: string | null;
          suspended_reason?: string | null;
          timezone?: string;
          updated_at?: string;
          week_starts_on?: number;
        };
        Relationships: [];
      };
      recurring_rules: {
        Row: {
          account_id: string | null;
          amount_minor: number;
          behavior: string;
          category_id: string | null;
          created_at: string;
          created_by: string;
          currency_code: string;
          day_of_period: number | null;
          ends_at: string | null;
          entry_type: string;
          frequency: string;
          id: string;
          interval_count: number;
          name: string;
          next_occurrence: string;
          note: string | null;
          payee: string | null;
          status: string;
          timezone: string;
          updated_at: string;
          workspace_id: string;
        };
        Insert: {
          account_id?: string | null;
          amount_minor: number;
          behavior?: string;
          category_id?: string | null;
          created_at?: string;
          created_by: string;
          currency_code: string;
          day_of_period?: number | null;
          ends_at?: string | null;
          entry_type: string;
          frequency: string;
          id?: string;
          interval_count?: number;
          name: string;
          next_occurrence: string;
          note?: string | null;
          payee?: string | null;
          status?: string;
          timezone?: string;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          account_id?: string | null;
          amount_minor?: number;
          behavior?: string;
          category_id?: string | null;
          created_at?: string;
          created_by?: string;
          currency_code?: string;
          day_of_period?: number | null;
          ends_at?: string | null;
          entry_type?: string;
          frequency?: string;
          id?: string;
          interval_count?: number;
          name?: string;
          next_occurrence?: string;
          note?: string | null;
          payee?: string | null;
          status?: string;
          timezone?: string;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'recurring_rules_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'ledger_accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'recurring_rules_category_id_fkey';
            columns: ['category_id'];
            isOneToOne: false;
            referencedRelation: 'categories';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'recurring_rules_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      savings_goals: {
        Row: {
          created_at: string;
          created_by: string;
          currency_code: string;
          id: string;
          linked_account_id: string | null;
          name: string;
          priority: number;
          status: string;
          target_date: string | null;
          target_minor: number;
          updated_at: string;
          workspace_id: string;
        };
        Insert: {
          created_at?: string;
          created_by: string;
          currency_code: string;
          id?: string;
          linked_account_id?: string | null;
          name: string;
          priority?: number;
          status?: string;
          target_date?: string | null;
          target_minor: number;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          currency_code?: string;
          id?: string;
          linked_account_id?: string | null;
          name?: string;
          priority?: number;
          status?: string;
          target_date?: string | null;
          target_minor?: number;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'savings_goals_linked_account_id_fkey';
            columns: ['linked_account_id'];
            isOneToOne: false;
            referencedRelation: 'ledger_accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'savings_goals_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      site_settings: {
        Row: {
          description: string;
          key: string;
          label: string;
          updated_at: string;
          updated_by: string | null;
          value: string | null;
        };
        Insert: {
          description?: string;
          key: string;
          label?: string;
          updated_at?: string;
          updated_by?: string | null;
          value?: string | null;
        };
        Update: {
          description?: string;
          key?: string;
          label?: string;
          updated_at?: string;
          updated_by?: string | null;
          value?: string | null;
        };
        Relationships: [];
      };
      system_events: {
        Row: {
          actor_id: string | null;
          app_version: string | null;
          created_at: string;
          device_id: string | null;
          event_code: string;
          id: number;
          latency_ms: number | null;
          level: string;
          message: string;
          metadata: Json;
          method: string | null;
          platform: string | null;
          request_id: string | null;
          route: string | null;
          session_id: string | null;
          source: string;
          status_code: number | null;
        };
        Insert: {
          actor_id?: string | null;
          app_version?: string | null;
          created_at?: string;
          device_id?: string | null;
          event_code: string;
          id?: never;
          latency_ms?: number | null;
          level: string;
          message?: string;
          metadata?: Json;
          method?: string | null;
          platform?: string | null;
          request_id?: string | null;
          route?: string | null;
          session_id?: string | null;
          source?: string;
          status_code?: number | null;
        };
        Update: {
          actor_id?: string | null;
          app_version?: string | null;
          created_at?: string;
          device_id?: string | null;
          event_code?: string;
          id?: never;
          latency_ms?: number | null;
          level?: string;
          message?: string;
          metadata?: Json;
          method?: string | null;
          platform?: string | null;
          request_id?: string | null;
          route?: string | null;
          session_id?: string | null;
          source?: string;
          status_code?: number | null;
        };
        Relationships: [];
      };
      tags: {
        Row: {
          created_at: string;
          deleted_at: string | null;
          id: string;
          name: string;
          updated_at: string;
          workspace_id: string;
        };
        Insert: {
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          name: string;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          name?: string;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'tags_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      user_devices: {
        Row: {
          app_version: string | null;
          device_id: string;
          device_name: string | null;
          first_seen_at: string;
          id: string;
          last_ip: unknown;
          last_seen_at: string;
          os_version: string | null;
          platform: string;
          push_provider: string | null;
          push_token: string | null;
          revoked_at: string | null;
          user_id: string;
        };
        Insert: {
          app_version?: string | null;
          device_id: string;
          device_name?: string | null;
          first_seen_at?: string;
          id?: string;
          last_ip?: unknown;
          last_seen_at?: string;
          os_version?: string | null;
          platform: string;
          push_provider?: string | null;
          push_token?: string | null;
          revoked_at?: string | null;
          user_id: string;
        };
        Update: {
          app_version?: string | null;
          device_id?: string;
          device_name?: string | null;
          first_seen_at?: string;
          id?: string;
          last_ip?: unknown;
          last_seen_at?: string;
          os_version?: string | null;
          platform?: string;
          push_provider?: string | null;
          push_token?: string | null;
          revoked_at?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      workspace_members: {
        Row: {
          joined_at: string;
          role: string;
          status: string;
          updated_at: string;
          user_id: string;
          workspace_id: string;
        };
        Insert: {
          joined_at?: string;
          role?: string;
          status?: string;
          updated_at?: string;
          user_id: string;
          workspace_id: string;
        };
        Update: {
          joined_at?: string;
          role?: string;
          status?: string;
          updated_at?: string;
          user_id?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'workspace_members_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      workspaces: {
        Row: {
          base_currency: string;
          created_at: string;
          created_by: string;
          id: string;
          name: string;
          status: string;
          timezone: string;
          type: string;
          updated_at: string;
        };
        Insert: {
          base_currency?: string;
          created_at?: string;
          created_by: string;
          id?: string;
          name?: string;
          status?: string;
          timezone?: string;
          type: string;
          updated_at?: string;
        };
        Update: {
          base_currency?: string;
          created_at?: string;
          created_by?: string;
          id?: string;
          name?: string;
          status?: string;
          timezone?: string;
          type?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      admin_platform_stats: { Args: never; Returns: Json };
      admin_scheduled_jobs: { Args: never; Returns: Json };
      admin_user_overview: {
        Args: {
          p_limit?: number;
          p_offset?: number;
          p_search?: string;
          p_status?: string;
        };
        Returns: {
          account_count: number;
          banned_until: string;
          base_currency: string;
          created_at: string;
          deletion_scheduled_for: string;
          display_name: string;
          email: string;
          email_confirmed_at: string;
          entry_count: number;
          is_super_admin: boolean;
          last_entry_at: string;
          last_sign_in_at: string;
          locale: string;
          onboarding_status: string;
          provider_count: number;
          status: string;
          suspended_at: string;
          suspended_reason: string;
          timezone: string;
          total_count: number;
          user_id: string;
          workspace_count: number;
        }[];
      };
      budget_status: { Args: { p_workspace_id: string }; Returns: Json };
      calendar_overview: {
        Args: { p_days?: number; p_workspace_id: string };
        Returns: Json;
      };
      category_report: {
        Args: { p_from?: string; p_to?: string; p_workspace_id: string };
        Returns: Json;
      };
      check_error_rate_alert: { Args: never; Returns: Json };
      enqueue_notification_digests: { Args: never; Returns: undefined };
      goals_overview: { Args: { p_workspace_id: string }; Returns: Json };
      is_super_admin: { Args: never; Returns: boolean };
      prune_idempotency_records: { Args: never; Returns: number };
      prune_system_events: { Args: { p_retain_days?: number }; Returns: number };
      purge_expired_deletions: {
        Args: { p_limit?: number };
        Returns: {
          user_id: string;
        }[];
      };
      reverse_journal_entry: {
        Args: { p_entry_id: string; p_workspace_id: string };
        Returns: string;
      };
      workspace_summary: { Args: { p_workspace_id: string }; Returns: Json };
      workspace_tz: { Args: { p_workspace_id: string }; Returns: string };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema['CompositeTypes'] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
