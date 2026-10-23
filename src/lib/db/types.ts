/**
 * Database types for the schemas exposed through the Supabase Data API.
 *
 * Shape follows `supabase gen types typescript`. After changing migrations,
 * regenerate with:
 *   npx supabase gen types typescript --project-id <ref> --schema public > src/lib/db/types.ts
 * tests/db/schema.test.ts fails if src/lib/db/columns.ts drifts from the
 * migrated schema, which is the reminder to regenerate.
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Locale = 'en' | 'es';
export type MailProvider = 'microsoft' | 'google';
export type MailAccountStatus = 'pending' | 'active' | 'reauth_required' | 'disabled' | 'error';
export type FollowUpStatus = 'open' | 'done' | 'dismissed';
export type TaskStatus = 'open' | 'done';
export type Importance = 'low' | 'normal' | 'high';

export interface Database {
  __InternalSupabase: {
    PostgrestVersion: '12';
  };
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string | null;
          locale: Locale;
          time_zone: string;
          created_at: string;
          updated_at: string;
        };
        Insert: { [_ in never]: never }; // created server-side only
        Update: {
          display_name?: string | null;
          locale?: Locale;
          time_zone?: string;
        };
        Relationships: [];
      };
      mail_accounts: {
        Row: {
          id: string;
          user_id: string;
          provider: MailProvider;
          provider_account_id: string;
          email_address: string;
          display_name: string | null;
          status: MailAccountStatus;
          connected_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: { [_ in never]: never }; // created server-side only
        Update: {
          display_name?: string | null;
        };
        Relationships: [];
      };
      message_metadata: {
        Row: {
          id: string;
          user_id: string;
          account_id: string;
          provider_message_id: string;
          provider_thread_id: string | null;
          internet_message_id: string | null;
          provider_folder_ids: string[];
          subject: string | null;
          sender_name: string | null;
          sender_address: string | null;
          received_at: string | null;
          sent_at: string | null;
          is_read: boolean;
          is_flagged: boolean;
          is_draft: boolean;
          importance: Importance;
          has_attachments: boolean;
          search_vector: unknown;
          created_at: string;
          updated_at: string;
        };
        Insert: { [_ in never]: never }; // created server-side only
        Update: { [_ in never]: never }; // read-only for users
        Relationships: [
          {
            foreignKeyName: 'message_metadata_account_fk';
            columns: ['account_id', 'user_id'];
            isOneToOne: false;
            referencedRelation: 'mail_accounts';
            referencedColumns: ['id', 'user_id'];
          },
        ];
      };
      follow_ups: {
        Row: {
          id: string;
          user_id: string;
          message_id: string | null;
          title: string;
          note: string | null;
          due_at: string;
          status: FollowUpStatus;
          completed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          message_id?: string | null;
          title: string;
          note?: string | null;
          due_at: string;
          status?: FollowUpStatus;
          completed_at?: string | null;
        };
        Update: {
          message_id?: string | null;
          title?: string;
          note?: string | null;
          due_at?: string;
          status?: FollowUpStatus;
          completed_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'follow_ups_message_fk';
            columns: ['message_id', 'user_id'];
            isOneToOne: false;
            referencedRelation: 'message_metadata';
            referencedColumns: ['id', 'user_id'];
          },
        ];
      };
      tasks: {
        Row: {
          id: string;
          user_id: string;
          source_message_id: string | null;
          title: string;
          notes: string | null;
          status: TaskStatus;
          priority: number;
          due_at: string | null;
          completed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          source_message_id?: string | null;
          title: string;
          notes?: string | null;
          status?: TaskStatus;
          priority?: number;
          due_at?: string | null;
          completed_at?: string | null;
        };
        Update: {
          source_message_id?: string | null;
          title?: string;
          notes?: string | null;
          status?: TaskStatus;
          priority?: number;
          due_at?: string | null;
          completed_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'tasks_source_message_fk';
            columns: ['source_message_id', 'user_id'];
            isOneToOne: false;
            referencedRelation: 'message_metadata';
            referencedColumns: ['id', 'user_id'];
          },
        ];
      };
      saved_views: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          definition: Json;
          position: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          definition?: Json;
          position?: number;
        };
        Update: {
          name?: string;
          definition?: Json;
          position?: number;
        };
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
}

export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row'];
