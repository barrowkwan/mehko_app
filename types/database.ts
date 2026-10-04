
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "food_items": {
                  Row: {
                    "active": boolean,"created_at": string,"description": string | null,"id": string,"image_path": string | null,"merchant_id": string,"name": string,"price_cents": number | null,"translations": NonNullable<Json>
                  }
                  Insert: {
                    "active"?: boolean,"created_at"?: string,"description"?: string | null,"id"?: string,"image_path"?: string | null,"merchant_id": string,"name": string,"price_cents"?: number | null,"translations"?: NonNullable<Json>
                  }
                  Update: {
                    "active"?: boolean,"created_at"?: string,"description"?: string | null,"id"?: string,"image_path"?: string | null,"merchant_id"?: string,"name"?: string,"price_cents"?: number | null,"translations"?: NonNullable<Json>
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
                },"location_shares": {
                  Row: {
                    "active": boolean,"lat": number | null,"lng": number | null,"offering_id": string,"updated_at": string
                  }
                  Insert: {
                    "active"?: boolean,"lat"?: number | null,"lng"?: number | null,"offering_id": string,"updated_at"?: string
                  }
                  Update: {
                    "active"?: boolean,"lat"?: number | null,"lng"?: number | null,"offering_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "location_shares_offering_id_fkey"
      columns: ["offering_id"]
isOneToOne: true
      referencedRelation: "offerings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "location_shares_offering_id_fkey"
      columns: ["offering_id"]
isOneToOne: true
      referencedRelation: "order_lines"
      referencedColumns: ["offering_id"]
    }
                  ]
                },"merchants": {
                  Row: {
                    "country_code": string,"created_at": string,"description": string | null,"id": string,"name": string,"owner_id": string,"translations": NonNullable<Json>
                  }
                  Insert: {
                    "country_code"?: string,"created_at"?: string,"description"?: string | null,"id"?: string,"name": string,"owner_id": string,"translations"?: NonNullable<Json>
                  }
                  Update: {
                    "country_code"?: string,"created_at"?: string,"description"?: string | null,"id"?: string,"name"?: string,"owner_id"?: string,"translations"?: NonNullable<Json>
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
                },"offering_context": {
                  Row: {
                    "fetched_at": string,"holiday_name": string | null,"is_holiday": boolean,"offering_id": string,"precip_mm": number | null,"temp_max_c": number | null,"weather_bucket": string | null,"weather_summary": string | null
                  }
                  Insert: {
                    "fetched_at"?: string,"holiday_name"?: string | null,"is_holiday"?: boolean,"offering_id": string,"precip_mm"?: number | null,"temp_max_c"?: number | null,"weather_bucket"?: string | null,"weather_summary"?: string | null
                  }
                  Update: {
                    "fetched_at"?: string,"holiday_name"?: string | null,"is_holiday"?: boolean,"offering_id"?: string,"precip_mm"?: number | null,"temp_max_c"?: number | null,"weather_bucket"?: string | null,"weather_summary"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "offering_context_offering_id_fkey"
      columns: ["offering_id"]
isOneToOne: true
      referencedRelation: "offerings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "offering_context_offering_id_fkey"
      columns: ["offering_id"]
isOneToOne: true
      referencedRelation: "order_lines"
      referencedColumns: ["offering_id"]
    }
                  ]
                },"offering_items": {
                  Row: {
                    "food_item_id": string,"id": string,"offering_id": string,"quantity_limit": number | null
                  }
                  Insert: {
                    "food_item_id": string,"id"?: string,"offering_id": string,"quantity_limit"?: number | null
                  }
                  Update: {
                    "food_item_id"?: string,"id"?: string,"offering_id"?: string,"quantity_limit"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "offering_items_food_item_id_fkey"
      columns: ["food_item_id"]
isOneToOne: false
      referencedRelation: "food_items"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "offering_items_food_item_id_fkey"
      columns: ["food_item_id"]
isOneToOne: false
      referencedRelation: "order_lines"
      referencedColumns: ["food_item_id"]
    },{
      foreignKeyName: "offering_items_offering_id_fkey"
      columns: ["offering_id"]
isOneToOne: false
      referencedRelation: "offerings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "offering_items_offering_id_fkey"
      columns: ["offering_id"]
isOneToOne: false
      referencedRelation: "order_lines"
      referencedColumns: ["offering_id"]
    }
                  ]
                },"offerings": {
                  Row: {
                    "created_at": string,"cutoff_at": string,"id": string,"instructions": string | null,"merchant_id": string,"pickup_date": string,"pickup_end": string,"pickup_point_id": string,"pickup_start": string,"status": string,"translations": NonNullable<Json>
                  }
                  Insert: {
                    "created_at"?: string,"cutoff_at": string,"id"?: string,"instructions"?: string | null,"merchant_id": string,"pickup_date": string,"pickup_end": string,"pickup_point_id": string,"pickup_start": string,"status"?: string,"translations"?: NonNullable<Json>
                  }
                  Update: {
                    "created_at"?: string,"cutoff_at"?: string,"id"?: string,"instructions"?: string | null,"merchant_id"?: string,"pickup_date"?: string,"pickup_end"?: string,"pickup_point_id"?: string,"pickup_start"?: string,"status"?: string,"translations"?: NonNullable<Json>
                  }
                  Relationships: [
                    {
      foreignKeyName: "offerings_merchant_id_fkey"
      columns: ["merchant_id"]
isOneToOne: false
      referencedRelation: "merchants"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "offerings_pickup_point_id_fkey"
      columns: ["pickup_point_id"]
isOneToOne: false
      referencedRelation: "pickup_points"
      referencedColumns: ["id"]
    }
                  ]
                },"order_items": {
                  Row: {
                    "offering_item_id": string,"order_id": string,"qty": number
                  }
                  Insert: {
                    "offering_item_id": string,"order_id": string,"qty": number
                  }
                  Update: {
                    "offering_item_id"?: string,"order_id"?: string,"qty"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "order_items_offering_item_id_fkey"
      columns: ["offering_item_id"]
isOneToOne: false
      referencedRelation: "offering_items"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "order_items_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["id"]
    }
                  ]
                },"orders": {
                  Row: {
                    "created_at": string,"customer_id": string,"id": string,"note": string | null,"offering_id": string,"payment_ref": string | null,"payment_status": string,"picked_up_at": string | null,"qr_token": string,"status": string,"updated_at": string
                  }
                  Insert: {
                    "created_at"?: string,"customer_id": string,"id"?: string,"note"?: string | null,"offering_id": string,"payment_ref"?: string | null,"payment_status"?: string,"picked_up_at"?: string | null,"qr_token"?: string,"status"?: string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"customer_id"?: string,"id"?: string,"note"?: string | null,"offering_id"?: string,"payment_ref"?: string | null,"payment_status"?: string,"picked_up_at"?: string | null,"qr_token"?: string,"status"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "orders_customer_id_fkey"
      columns: ["customer_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "orders_offering_id_fkey"
      columns: ["offering_id"]
isOneToOne: false
      referencedRelation: "offerings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "orders_offering_id_fkey"
      columns: ["offering_id"]
isOneToOne: false
      referencedRelation: "order_lines"
      referencedColumns: ["offering_id"]
    }
                  ]
                },"pickup_points": {
                  Row: {
                    "active": boolean,"address": string | null,"created_at": string,"id": string,"lat": number,"lng": number,"merchant_id": string,"name": string,"timezone": string
                  }
                  Insert: {
                    "active"?: boolean,"address"?: string | null,"created_at"?: string,"id"?: string,"lat": number,"lng": number,"merchant_id": string,"name": string,"timezone"?: string
                  }
                  Update: {
                    "active"?: boolean,"address"?: string | null,"created_at"?: string,"id"?: string,"lat"?: number,"lng"?: number,"merchant_id"?: string,"name"?: string,"timezone"?: string
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
                },"profiles": {
                  Row: {
                    "avatar_url": string | null,"created_at": string,"display_name": string | null,"id": string,"locale": string | null
                  }
                  Insert: {
                    "avatar_url"?: string | null,"created_at"?: string,"display_name"?: string | null,"id": string,"locale"?: string | null
                  }
                  Update: {
                    "avatar_url"?: string | null,"created_at"?: string,"display_name"?: string | null,"id"?: string,"locale"?: string | null
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            "order_lines": {
                  Row: {
                    "customer_id": string | null,"food_item_id": string | null,"food_name": string | null,"holiday_name": string | null,"is_holiday": boolean | null,"merchant_id": string | null,"offering_id": string | null,"pickup_date": string | null,"pickup_point_id": string | null,"pickup_point_name": string | null,"qty": number | null,"temp_max_c": number | null,"weather_bucket": string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "offerings_merchant_id_fkey"
      columns: ["merchant_id"]
isOneToOne: false
      referencedRelation: "merchants"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "offerings_pickup_point_id_fkey"
      columns: ["pickup_point_id"]
isOneToOne: false
      referencedRelation: "pickup_points"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "orders_customer_id_fkey"
      columns: ["customer_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Functions: {
            "_write_order_items":
{ Args: { "p_items": Json,"p_offering": string,"p_order": string }; Returns: undefined
                           },
"account_deletion_blocker":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"can_share_location":
{ Args: { "o": string }; Returns: boolean
                           },
"cancel_order":
{ Args: { "p_order": string }; Returns: undefined
                           },
"confirm_pickup":
{ Args: { "p_token": string }; Returns: {
              "already_picked_up": boolean,"customer_name": string,"order_id": string
            }[]
                           },
"duplicate_offering":
{ Args: { "p_new_date": string,"p_offering": string }; Returns: string
                           },
"has_order_on":
{ Args: { "o": string }; Returns: boolean
                           },
"is_food_image_owner":
{ Args: { "object_name": string }; Returns: boolean
                           },
"is_merchant_owner":
{ Args: { "m": string }; Returns: boolean
                           },
"offering_merchant":
{ Args: { "o": string }; Returns: string
                           },
"offering_stock":
{ Args: { "p_offering": string }; Returns: {
              "offering_item_id": string,"remaining": number
            }[]
                           },
"place_order":
{ Args: { "p_items": Json,"p_note"?: string,"p_offering": string }; Returns: string
                           },
"update_offering":
{ Args: { "p_cutoff": string,"p_date": string,"p_end": string,"p_instructions"?: string,"p_items": Json,"p_offering": string,"p_pickup_point": string,"p_start": string,"p_translations"?: Json }; Returns: undefined
                           },
"update_order":
{ Args: { "p_items": Json,"p_note"?: string,"p_order": string }; Returns: undefined
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            
          }
        }
} as const
