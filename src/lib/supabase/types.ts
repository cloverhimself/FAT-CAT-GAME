export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          wallet_address: string;
          username: string;
          total_xp: number;
          current_streak: number;
          best_score: number;
          total_checkins: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          wallet_address: string;
          username: string;
          total_xp?: number;
          current_streak?: number;
          best_score?: number;
          total_checkins?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          wallet_address?: string;
          username?: string;
          total_xp?: number;
          current_streak?: number;
          best_score?: number;
          total_checkins?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      checkins: {
        Row: {
          id: string;
          wallet_address: string;
          username: string;
          tx_signature: string;
          checkin_date: string;
          xp_awarded: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          wallet_address: string;
          username: string;
          tx_signature: string;
          checkin_date: string;
          xp_awarded: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          wallet_address?: string;
          username?: string;
          tx_signature?: string;
          checkin_date?: string;
          xp_awarded?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "checkins_user_fk";
            columns: ["wallet_address"];
            referencedRelation: "users";
            referencedColumns: ["wallet_address"];
          },
        ];
      };
      scores: {
        Row: {
          id: string;
          wallet_address: string;
          username: string;
          score: number;
          level: number;
          moves_used: number;
          game_session_id: string;
          tx_signature: string;
          suspicious_score: boolean;
          suspicious_reason: string | null;
          reviewed: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          wallet_address: string;
          username: string;
          score: number;
          level: number;
          moves_used: number;
          game_session_id: string;
          tx_signature: string;
          suspicious_score?: boolean;
          suspicious_reason?: string | null;
          reviewed?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          wallet_address?: string;
          username?: string;
          score?: number;
          level?: number;
          moves_used?: number;
          game_session_id?: string;
          tx_signature?: string;
          suspicious_score?: boolean;
          suspicious_reason?: string | null;
          reviewed?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "scores_user_fk";
            columns: ["wallet_address"];
            referencedRelation: "users";
            referencedColumns: ["wallet_address"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
