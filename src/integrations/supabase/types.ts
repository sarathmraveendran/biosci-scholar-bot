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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      chunks: {
        Row: {
          chunk_order: number
          content: string
          created_at: string
          document_id: string
          embedding: string | null
          fts: unknown
          heading: string | null
          id: string
          subheading: string | null
          token_count: number
        }
        Insert: {
          chunk_order: number
          content: string
          created_at?: string
          document_id: string
          embedding?: string | null
          fts?: unknown
          heading?: string | null
          id?: string
          subheading?: string | null
          token_count?: number
        }
        Update: {
          chunk_order?: number
          content?: string
          created_at?: string
          document_id?: string
          embedding?: string | null
          fts?: unknown
          heading?: string | null
          id?: string
          subheading?: string | null
          token_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "chunks_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          chapter_number: string | null
          content: string
          created_at: string
          filename: string
          id: string
          part: string | null
          path: string
          source_url: string
          title: string
          updated_at: string
        }
        Insert: {
          chapter_number?: string | null
          content: string
          created_at?: string
          filename: string
          id?: string
          part?: string | null
          path: string
          source_url: string
          title: string
          updated_at?: string
        }
        Update: {
          chapter_number?: string | null
          content?: string
          created_at?: string
          filename?: string
          id?: string
          part?: string | null
          path?: string
          source_url?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      evaluation_questions: {
        Row: {
          created_at: string
          expected_answer: string | null
          expected_sources: string[]
          id: string
          question: string
        }
        Insert: {
          created_at?: string
          expected_answer?: string | null
          expected_sources?: string[]
          id?: string
          question: string
        }
        Update: {
          created_at?: string
          expected_answer?: string | null
          expected_sources?: string[]
          id?: string
          question?: string
        }
        Relationships: []
      }
      evaluation_results: {
        Row: {
          citation_score: number | null
          created_at: string
          generated_answer: string
          groundedness_score: number | null
          id: string
          passed: boolean
          question_id: string
          retrieved_sources: Json
        }
        Insert: {
          citation_score?: number | null
          created_at?: string
          generated_answer: string
          groundedness_score?: number | null
          id?: string
          passed?: boolean
          question_id: string
          retrieved_sources?: Json
        }
        Update: {
          citation_score?: number | null
          created_at?: string
          generated_answer?: string
          groundedness_score?: number | null
          id?: string
          passed?: boolean
          question_id?: string
          retrieved_sources?: Json
        }
        Relationships: [
          {
            foreignKeyName: "evaluation_results_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "evaluation_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      ingestion_runs: {
        Row: {
          chunks_indexed: number
          error: string | null
          files_indexed: number
          finished_at: string | null
          id: string
          started_at: string
          status: string
        }
        Insert: {
          chunks_indexed?: number
          error?: string | null
          files_indexed?: number
          finished_at?: string | null
          id?: string
          started_at?: string
          status?: string
        }
        Update: {
          chunks_indexed?: number
          error?: string | null
          files_indexed?: number
          finished_at?: string | null
          id?: string
          started_at?: string
          status?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      match_chunks: {
        Args: {
          match_count?: number
          query_embedding: string
          query_text?: string
        }
        Returns: {
          chapter_number: string
          chunk_order: number
          content: string
          document_id: string
          filename: string
          heading: string
          id: string
          keyword_rank: number
          score: number
          similarity: number
          source_url: string
          subheading: string
          title: string
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
    },
  },
} as const
