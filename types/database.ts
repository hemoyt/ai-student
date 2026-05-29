import type { GradeId } from "@/types";

type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      classes: {
        Row: {
          id: GradeId;
          name_ar: string;
          sort_order: number;
        };
        Insert: {
          id: GradeId;
          name_ar: string;
          sort_order: number;
        };
        Update: Partial<Database["public"]["Tables"]["classes"]["Insert"]>;
        Relationships: [];
      };
      subjects: {
        Row: {
          id: string;
          slug: string;
          name_ar: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          name_ar: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["subjects"]["Insert"]>;
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          full_name: string | null;
          grade: GradeId | null;
          role: "student" | "admin";
          created_at: string;
        };
        Insert: {
          id: string;
          full_name?: string | null;
          grade?: GradeId | null;
          role?: "student" | "admin";
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
        Relationships: [];
      };
      books: {
        Row: {
          id: string;
          title: string;
          subject: string;
          grade: GradeId;
          cover_image: string | null;
          pdf_url: string | null;
          source_file: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          subject: string;
          grade: GradeId;
          cover_image?: string | null;
          pdf_url?: string | null;
          source_file?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["books"]["Insert"]>;
        Relationships: [];
      };
      chapters: {
        Row: {
          id: string;
          book_id: string;
          title: string;
          chapter_number: number | null;
        };
        Insert: {
          id?: string;
          book_id: string;
          title: string;
          chapter_number?: number | null;
        };
        Update: Partial<Database["public"]["Tables"]["chapters"]["Insert"]>;
        Relationships: [];
      };
      documents: {
        Row: {
          id: string;
          book_id: string;
          chunk_text: string;
          embedding: number[];
          page_number: number | null;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          book_id: string;
          chunk_text: string;
          embedding: number[];
          page_number?: number | null;
          metadata?: Json;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["documents"]["Insert"]>;
        Relationships: [];
      };
      flashcards: {
        Row: {
          id: string;
          user_id: string;
          question: string;
          answer: string;
          book_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          question: string;
          answer: string;
          book_id?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["flashcards"]["Insert"]>;
        Relationships: [];
      };
      quizzes: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          score: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          score?: number | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["quizzes"]["Insert"]>;
        Relationships: [];
      };
      quiz_questions: {
        Row: {
          id: string;
          quiz_id: string;
          question: string;
          choices: Json;
          correct_answer: string | null;
          explanation: string | null;
          difficulty: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          quiz_id: string;
          question: string;
          choices?: Json;
          correct_answer?: string | null;
          explanation?: string | null;
          difficulty?: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["quiz_questions"]["Insert"]>;
        Relationships: [];
      };
      study_progress: {
        Row: {
          id: string;
          user_id: string;
          book_id: string;
          completed_lessons: number;
          total_lessons: number;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          book_id: string;
          completed_lessons?: number;
          total_lessons?: number;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["study_progress"]["Insert"]>;
        Relationships: [];
      };
      bookmarks: {
        Row: {
          id: string;
          user_id: string;
          book_id: string;
          page_number: number | null;
          note: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          book_id: string;
          page_number?: number | null;
          note?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["bookmarks"]["Insert"]>;
        Relationships: [];
      };
      chat_sessions: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          selected_book_ids: string[];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title?: string;
          selected_book_ids?: string[];
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["chat_sessions"]["Insert"]>;
        Relationships: [];
      };
      chat_messages: {
        Row: {
          id: string;
          session_id: string;
          user_id: string;
          role: "user" | "assistant";
          content: string;
          citations: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          user_id: string;
          role: "user" | "assistant";
          content: string;
          citations?: Json;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["chat_messages"]["Insert"]>;
        Relationships: [];
      };
      ingestion_jobs: {
        Row: {
          id: string;
          book_id: string | null;
          source_file: string | null;
          status: "queued" | "running" | "completed" | "failed";
          processed_chunks: number;
          error: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          book_id?: string | null;
          source_file?: string | null;
          status?: "queued" | "running" | "completed" | "failed";
          processed_chunks?: number;
          error?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["ingestion_jobs"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      match_documents: {
        Args: {
          query_embedding: number[];
          query_text: string;
          selected_book_ids: string[];
          match_count?: number;
        };
        Returns: Array<{
          id: string;
          book_id: string;
          chunk_text: string;
          page_number: number | null;
          metadata: Json;
          score: number;
        }>;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
