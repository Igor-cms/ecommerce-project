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
      favorites: {
        Row: {
          created_at: string | null
          id: string
          product_slug: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          product_slug: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          product_slug?: string
          user_id?: string
        }
        Relationships: []
      }
      inventory_deductions: {
        Row: {
          created_at: string
          id: string
          quantity_deducted: number
          raw_material_id: string | null
          reverted_at: string | null
          shopify_order_id: string
          shopify_order_name: string | null
          shopify_product_name: string | null
          shopify_variant_id: string | null
          shopify_variant_title: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          quantity_deducted?: number
          raw_material_id?: string | null
          reverted_at?: string | null
          shopify_order_id: string
          shopify_order_name?: string | null
          shopify_product_name?: string | null
          shopify_variant_id?: string | null
          shopify_variant_title?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          quantity_deducted?: number
          raw_material_id?: string | null
          reverted_at?: string | null
          shopify_order_id?: string
          shopify_order_name?: string | null
          shopify_product_name?: string | null
          shopify_variant_id?: string | null
          shopify_variant_title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_deductions_raw_material_id_fkey"
            columns: ["raw_material_id"]
            isOneToOne: false
            referencedRelation: "raw_materials"
            referencedColumns: ["id"]
          },
        ]
      }
      order_separations: {
        Row: {
          id: string
          separated_at: string
          separated_by: string | null
          shopify_order_id: string
        }
        Insert: {
          id?: string
          separated_at?: string
          separated_by?: string | null
          shopify_order_id: string
        }
        Update: {
          id?: string
          separated_at?: string
          separated_by?: string | null
          shopify_order_id?: string
        }
        Relationships: []
      }
      page_settings: {
        Row: {
          id: string
          is_visible: boolean
          label: string
          slug: string
          updated_at: string | null
        }
        Insert: {
          id?: string
          is_visible?: boolean
          label: string
          slug: string
          updated_at?: string | null
        }
        Update: {
          id?: string
          is_visible?: boolean
          label?: string
          slug?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string | null
          email: string | null
          first_name: string | null
          id: string
          last_name: string | null
          phone: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          first_name?: string | null
          id: string
          last_name?: string | null
          phone?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          phone?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      raw_material_variants: {
        Row: {
          created_at: string
          id: string
          quantity_per_unit: number
          raw_material_id: string
          shopify_product_name: string
          shopify_variant_id: string
          shopify_variant_title: string
        }
        Insert: {
          created_at?: string
          id?: string
          quantity_per_unit?: number
          raw_material_id: string
          shopify_product_name?: string
          shopify_variant_id: string
          shopify_variant_title?: string
        }
        Update: {
          created_at?: string
          id?: string
          quantity_per_unit?: number
          raw_material_id?: string
          shopify_product_name?: string
          shopify_variant_id?: string
          shopify_variant_title?: string
        }
        Relationships: [
          {
            foreignKeyName: "raw_material_variants_raw_material_id_fkey"
            columns: ["raw_material_id"]
            isOneToOne: false
            referencedRelation: "raw_materials"
            referencedColumns: ["id"]
          },
        ]
      }
      raw_materials: {
        Row: {
          created_at: string
          id: string
          name: string
          quantity_available: number
          shopify_product_id: string | null
          unit: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          quantity_available?: number
          shopify_product_id?: string | null
          unit?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          quantity_available?: number
          shopify_product_id?: string | null
          unit?: string
          updated_at?: string
        }
        Relationships: []
      }
      shipping_labels: {
        Row: {
          carrier: string
          created_at: string
          created_by: string | null
          id: string
          label_path: string
          master_tracking_number: string | null
          service_type: string | null
          shopify_order_id: string
          tracking_number: string
          weight_kg: number | null
        }
        Insert: {
          carrier?: string
          created_at?: string
          created_by?: string | null
          id?: string
          label_path: string
          master_tracking_number?: string | null
          service_type?: string | null
          shopify_order_id: string
          tracking_number: string
          weight_kg?: number | null
        }
        Update: {
          carrier?: string
          created_at?: string
          created_by?: string | null
          id?: string
          label_path?: string
          master_tracking_number?: string | null
          service_type?: string | null
          shopify_order_id?: string
          tracking_number?: string
          weight_kg?: number | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      wholesale_applications: {
        Row: {
          additional_info: string | null
          business_name: string
          business_type: string
          contact_name: string
          created_at: string | null
          email: string
          expected_volume: string | null
          id: string
          phone: string | null
          status: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          additional_info?: string | null
          business_name: string
          business_type: string
          contact_name: string
          created_at?: string | null
          email: string
          expected_volume?: string | null
          id?: string
          phone?: string | null
          status?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          additional_info?: string | null
          business_name?: string
          business_type?: string
          contact_name?: string
          created_at?: string | null
          email?: string
          expected_volume?: string | null
          id?: string
          phone?: string | null
          status?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      wholesale_vat_info: {
        Row: {
          created_at: string
          id: string
          updated_at: string
          user_id: string
          vat_exempt: boolean
          vat_number: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
          vat_exempt?: boolean
          vat_number?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
          vat_exempt?: boolean
          vat_number?: string | null
        }
        Relationships: []
      }
      xero_emails_sent: {
        Row: {
          id: string
          invoice_id: string
          sent_at: string
        }
        Insert: {
          id?: string
          invoice_id: string
          sent_at?: string
        }
        Update: {
          id?: string
          invoice_id?: string
          sent_at?: string
        }
        Relationships: []
      }
      xero_tokens: {
        Row: {
          access_token: string
          created_at: string
          expires_at: string
          id: string
          refresh_token: string
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          access_token: string
          created_at?: string
          expires_at: string
          id?: string
          refresh_token: string
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          access_token?: string
          created_at?: string
          expires_at?: string
          id?: string
          refresh_token?: string
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      product_favorites_counts: {
        Row: {
          favorite_count: number | null
          product_slug: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user" | "owner"
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
      app_role: ["admin", "moderator", "user", "owner"],
    },
  },
} as const
