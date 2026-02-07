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
      audit_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          entity_id: string
          entity_type: string
          id: string
          ip_address: unknown
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          entity_id: string
          entity_type: string
          id?: string
          ip_address?: unknown
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          entity_id?: string
          entity_type?: string
          id?: string
          ip_address?: unknown
          user_id?: string
        }
        Relationships: []
      }
      departments: {
        Row: {
          code: string
          created_at: string
          id: string
          name: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      exam_papers: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          deadline: string
          exam_type: Database["public"]["Enums"]["exam_type"]
          feedback: string | null
          file_path: string | null
          id: string
          is_selected: boolean | null
          set_name: string
          status: Database["public"]["Enums"]["paper_status"]
          subject_id: string
          updated_at: string
          uploaded_at: string
          uploaded_by: string
          version: number
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          deadline: string
          exam_type: Database["public"]["Enums"]["exam_type"]
          feedback?: string | null
          file_path?: string | null
          id?: string
          is_selected?: boolean | null
          set_name: string
          status?: Database["public"]["Enums"]["paper_status"]
          subject_id: string
          updated_at?: string
          uploaded_at?: string
          uploaded_by: string
          version?: number
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          deadline?: string
          exam_type?: Database["public"]["Enums"]["exam_type"]
          feedback?: string | null
          file_path?: string | null
          id?: string
          is_selected?: boolean | null
          set_name?: string
          status?: Database["public"]["Enums"]["paper_status"]
          subject_id?: string
          updated_at?: string
          uploaded_at?: string
          uploaded_by?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "exam_papers_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_sessions: {
        Row: {
          academic_year: string
          access_end: string
          access_start: string
          created_at: string | null
          created_by: string
          exam_type: Database["public"]["Enums"]["exam_type"]
          id: string
          is_active: boolean | null
          is_locked: boolean | null
          name: string
          review_end: string
          review_start: string
          submission_end: string
          submission_start: string
          updated_at: string | null
        }
        Insert: {
          academic_year: string
          access_end: string
          access_start: string
          created_at?: string | null
          created_by: string
          exam_type: Database["public"]["Enums"]["exam_type"]
          id?: string
          is_active?: boolean | null
          is_locked?: boolean | null
          name: string
          review_end: string
          review_start: string
          submission_end: string
          submission_start: string
          updated_at?: string | null
        }
        Update: {
          academic_year?: string
          access_end?: string
          access_start?: string
          created_at?: string | null
          created_by?: string
          exam_type?: Database["public"]["Enums"]["exam_type"]
          id?: string
          is_active?: boolean | null
          is_locked?: boolean | null
          name?: string
          review_end?: string
          review_start?: string
          submission_end?: string
          submission_start?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      exams: {
        Row: {
          created_at: string
          created_by: string
          exam_type: Database["public"]["Enums"]["exam_type"]
          id: string
          scheduled_date: string
          selected_paper_id: string | null
          status: Database["public"]["Enums"]["exam_status"]
          subject_id: string
          unlock_time: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          exam_type: Database["public"]["Enums"]["exam_type"]
          id?: string
          scheduled_date: string
          selected_paper_id?: string | null
          status?: Database["public"]["Enums"]["exam_status"]
          subject_id: string
          unlock_time: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          exam_type?: Database["public"]["Enums"]["exam_type"]
          id?: string
          scheduled_date?: string
          selected_paper_id?: string | null
          status?: Database["public"]["Enums"]["exam_status"]
          subject_id?: string
          unlock_time?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "exams_selected_paper_id_fkey"
            columns: ["selected_paper_id"]
            isOneToOne: false
            referencedRelation: "exam_papers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exams_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string | null
          created_by: string
          expires_at: string | null
          id: string
          is_read: boolean | null
          message: string
          target_departments: string[] | null
          target_roles: Database["public"]["Enums"]["app_role"][]
          title: string
          type: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          created_by: string
          expires_at?: string | null
          id?: string
          is_read?: boolean | null
          message: string
          target_departments?: string[] | null
          target_roles: Database["public"]["Enums"]["app_role"][]
          title: string
          type?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string
          expires_at?: string | null
          id?: string
          is_read?: boolean | null
          message?: string
          target_departments?: string[] | null
          target_roles?: Database["public"]["Enums"]["app_role"][]
          title?: string
          type?: string
          user_id?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          department_id: string | null
          email: string
          full_name: string
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          department_id?: string | null
          email: string
          full_name: string
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          department_id?: string | null
          email?: string
          full_name?: string
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      subjects: {
        Row: {
          code: string
          created_at: string
          department_id: string
          id: string
          name: string
          semester: number
        }
        Insert: {
          code: string
          created_at?: string
          department_id: string
          id?: string
          name: string
          semester: number
        }
        Update: {
          code?: string
          created_at?: string
          department_id?: string
          id?: string
          name?: string
          semester?: number
        }
        Relationships: [
          {
            foreignKeyName: "subjects_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      system_settings: {
        Row: {
          description: string | null
          id: string
          key: string
          updated_at: string | null
          updated_by: string | null
          value: Json
        }
        Insert: {
          description?: string | null
          id?: string
          key: string
          updated_at?: string | null
          updated_by?: string | null
          value: Json
        }
        Update: {
          description?: string | null
          id?: string
          key?: string
          updated_at?: string | null
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      teacher_subjects: {
        Row: {
          created_at: string
          id: string
          subject_id: string
          teacher_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          subject_id: string
          teacher_id: string
        }
        Update: {
          created_at?: string
          id?: string
          subject_id?: string
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_subjects_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
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
      get_user_department: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "teacher" | "hod" | "exam_cell" | "admin"
      exam_status: "scheduled" | "in_progress" | "completed" | "archived"
      exam_type: "mid_term" | "end_term" | "practical" | "internal"
      paper_status:
        | "draft"
        | "submitted"
        | "pending_review"
        | "approved"
        | "rejected"
        | "locked"
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
      app_role: ["teacher", "hod", "exam_cell", "admin"],
      exam_status: ["scheduled", "in_progress", "completed", "archived"],
      exam_type: ["mid_term", "end_term", "practical", "internal"],
      paper_status: [
        "draft",
        "submitted",
        "pending_review",
        "approved",
        "rejected",
        "locked",
      ],
    },
  },
} as const
