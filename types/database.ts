// Hand-maintained to match supabase/migrations. Regenerate with `supabase gen types typescript --local`
// once the Supabase CLI is set up (see README).

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          display_name: string | null
          avatar_url: string | null
          created_at: string
        }
        Insert: {
          id: string
          display_name?: string | null
          avatar_url?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          display_name?: string | null
          avatar_url?: string | null
          created_at?: string
        }
        Relationships: []
      }
      merchants: {
        Row: {
          id: string
          owner_id: string
          name: string
          description: string | null
          country_code: string
          created_at: string
        }
        Insert: {
          id?: string
          owner_id: string
          name: string
          description?: string | null
          country_code?: string
          created_at?: string
        }
        Update: {
          id?: string
          owner_id?: string
          name?: string
          description?: string | null
          country_code?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "merchants_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      pickup_points: {
        Row: {
          id: string
          merchant_id: string
          name: string
          address: string | null
          lat: number
          lng: number
          timezone: string
          active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          merchant_id: string
          name: string
          address?: string | null
          lat: number
          lng: number
          timezone?: string
          active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          merchant_id?: string
          name?: string
          address?: string | null
          lat?: number
          lng?: number
          timezone?: string
          active?: boolean
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pickup_points_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          }
        ]
      }
      food_items: {
        Row: {
          id: string
          merchant_id: string
          name: string
          description: string | null
          image_url: string | null
          price_cents: number | null
          active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          merchant_id: string
          name: string
          description?: string | null
          image_url?: string | null
          price_cents?: number | null
          active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          merchant_id?: string
          name?: string
          description?: string | null
          image_url?: string | null
          price_cents?: number | null
          active?: boolean
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "food_items_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          }
        ]
      }
      offerings: {
        Row: {
          id: string
          merchant_id: string
          pickup_point_id: string
          pickup_date: string
          pickup_start: string
          pickup_end: string
          cutoff_at: string
          status: string
          created_at: string
        }
        Insert: {
          id?: string
          merchant_id: string
          pickup_point_id: string
          pickup_date: string
          pickup_start: string
          pickup_end: string
          cutoff_at: string
          status?: string
          created_at?: string
        }
        Update: {
          id?: string
          merchant_id?: string
          pickup_point_id?: string
          pickup_date?: string
          pickup_start?: string
          pickup_end?: string
          cutoff_at?: string
          status?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "offerings_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offerings_pickup_point_id_fkey"
            columns: ["pickup_point_id"]
            isOneToOne: false
            referencedRelation: "pickup_points"
            referencedColumns: ["id"]
          }
        ]
      }
      offering_items: {
        Row: {
          id: string
          offering_id: string
          food_item_id: string
          quantity_limit: number | null
        }
        Insert: {
          id?: string
          offering_id: string
          food_item_id: string
          quantity_limit?: number | null
        }
        Update: {
          id?: string
          offering_id?: string
          food_item_id?: string
          quantity_limit?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "offering_items_offering_id_fkey"
            columns: ["offering_id"]
            isOneToOne: false
            referencedRelation: "offerings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offering_items_food_item_id_fkey"
            columns: ["food_item_id"]
            isOneToOne: false
            referencedRelation: "food_items"
            referencedColumns: ["id"]
          }
        ]
      }
      orders: {
        Row: {
          id: string
          customer_id: string
          offering_id: string
          status: string
          qr_token: string
          picked_up_at: string | null
          payment_status: string
          payment_ref: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          customer_id: string
          offering_id: string
          status?: string
          qr_token?: string
          picked_up_at?: string | null
          payment_status?: string
          payment_ref?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          customer_id?: string
          offering_id?: string
          status?: string
          qr_token?: string
          picked_up_at?: string | null
          payment_status?: string
          payment_ref?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_offering_id_fkey"
            columns: ["offering_id"]
            isOneToOne: false
            referencedRelation: "offerings"
            referencedColumns: ["id"]
          }
        ]
      }
      order_items: {
        Row: {
          order_id: string
          offering_item_id: string
          qty: number
        }
        Insert: {
          order_id: string
          offering_item_id: string
          qty: number
        }
        Update: {
          order_id?: string
          offering_item_id?: string
          qty?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_offering_item_id_fkey"
            columns: ["offering_item_id"]
            isOneToOne: false
            referencedRelation: "offering_items"
            referencedColumns: ["id"]
          }
        ]
      }
      location_shares: {
        Row: {
          offering_id: string
          lat: number | null
          lng: number | null
          active: boolean
          updated_at: string
        }
        Insert: {
          offering_id: string
          lat?: number | null
          lng?: number | null
          active?: boolean
          updated_at?: string
        }
        Update: {
          offering_id?: string
          lat?: number | null
          lng?: number | null
          active?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "location_shares_offering_id_fkey"
            columns: ["offering_id"]
            isOneToOne: true
            referencedRelation: "offerings"
            referencedColumns: ["id"]
          }
        ]
      }
      offering_context: {
        Row: {
          offering_id: string
          weather_bucket: string | null
          weather_summary: string | null
          temp_max_c: number | null
          precip_mm: number | null
          is_holiday: boolean
          holiday_name: string | null
          fetched_at: string
        }
        Insert: {
          offering_id: string
          weather_bucket?: string | null
          weather_summary?: string | null
          temp_max_c?: number | null
          precip_mm?: number | null
          is_holiday?: boolean
          holiday_name?: string | null
          fetched_at?: string
        }
        Update: {
          offering_id?: string
          weather_bucket?: string | null
          weather_summary?: string | null
          temp_max_c?: number | null
          precip_mm?: number | null
          is_holiday?: boolean
          holiday_name?: string | null
          fetched_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "offering_context_offering_id_fkey"
            columns: ["offering_id"]
            isOneToOne: true
            referencedRelation: "offerings"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {
      order_lines: {
        Row: {
          merchant_id: string
          offering_id: string
          pickup_date: string
          pickup_point_id: string
          pickup_point_name: string
          food_item_id: string
          food_name: string
          qty: number
          customer_id: string
          is_holiday: boolean
          holiday_name: string | null
          weather_bucket: string | null
          temp_max_c: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      place_order: { Args: { p_offering: string; p_items: Json }; Returns: string }
      update_order: { Args: { p_order: string; p_items: Json }; Returns: undefined }
      cancel_order: { Args: { p_order: string }; Returns: undefined }
      confirm_pickup: {
        Args: { p_token: string }
        Returns: { order_id: string; customer_name: string | null; already_picked_up: boolean }[]
      }
      offering_stock: {
        Args: { p_offering: string }
        Returns: { offering_item_id: string; remaining: number }[]
      }
    }
    Enums: { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
  }
}
