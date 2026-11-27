export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {

  "public": {
          Tables: {
            "analytics_acquisition": {
                  Row: {
                    "campaign": string,"medium": string,"source": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "campaign": string,"medium": string,"source": string,"user_id": string
                  }
                  Update: {
                    "campaign"?: string,"medium"?: string,"source"?: string,"user_id"?: string
                  }
                  Relationships: [

                  ]
                },"analytics_event_keys": {
                  Row: {
                    "event_id": number,"event_key": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "event_id": number,"event_key": string,"user_id": string
                  }
                  Update: {
                    "event_id"?: number,"event_key"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "analytics_event_keys_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "events"
      referencedColumns: ["id"]
    }
                  ]
                },"analytics_team": {
                  Row: {
                    "user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "user_id": string
                  }
                  Update: {
                    "user_id"?: string
                  }
                  Relationships: [

                  ]
                },"cafe_members": {
                  Row: {
                    "garden_name": string,"seat_id": string | null,"updated_at": string,"user_id": string,"x": number,"y": number
                  }
                  ComputedFields: never
                  Insert: {
                    "garden_name": string,"seat_id"?: string | null,"updated_at"?: string,"user_id": string,"x": number,"y": number
                  }
                  Update: {
                    "garden_name"?: string,"seat_id"?: string | null,"updated_at"?: string,"user_id"?: string,"x"?: number,"y"?: number
                  }
                  Relationships: [

                  ]
                },"cafe_sessions": {
                  Row: {
                    "session_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "session_id": string,"user_id": string
                  }
                  Update: {
                    "session_id"?: string,"user_id"?: string
                  }
                  Relationships: [

                  ]
                },"events": {
                  Row: {
                    "id": number,"local_date": string,"name": string,"occurred_at": string,"props": NonNullable<Json>,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: never,"local_date": string,"name": string,"occurred_at"?: string,"props"?: NonNullable<Json>,"user_id": string
                  }
                  Update: {
                    "id"?: never,"local_date"?: string,"name"?: string,"occurred_at"?: string,"props"?: NonNullable<Json>,"user_id"?: string
                  }
                  Relationships: [

                  ]
                },"garden_saves": {
                  Row: {
                    "request_id": string,"revision": number,"state": NonNullable<Json>,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "request_id": string,"revision"?: number,"state": NonNullable<Json>,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "request_id"?: string,"revision"?: number,"state"?: NonNullable<Json>,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [

                  ]
                },"garden_sharing": {
                  Row: {
                    "enabled": boolean,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "enabled"?: boolean,"user_id": string
                  }
                  Update: {
                    "enabled"?: boolean,"user_id"?: string
                  }
                  Relationships: [

                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "cafe_leave":
{ Args: { "p_session": string }; Returns: undefined
                           },
"cafe_step":
{ Args: { "p_join"?: boolean,"p_seat": string,"p_session": string,"p_x": number,"p_y": number }; Returns: Json
                           },
"garden_plant_stage":
{ Args: { "p_date": string,"p_tree": boolean }; Returns: string
                           },
"get_shared_garden":
{ Args: { "p_user_id": string }; Returns: Json
                           },
"has_google_session":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"record_app_event":
{ Args: { "p_campaign"?: string,"p_event_key": string,"p_medium"?: string,"p_name": string,"p_props": Json,"p_source"?: string }; Returns: boolean
                           },
"save_garden_progress":
{ Args: { "p_expected_revision": number,"p_request_id": string,"p_state": Json,"p_user_id": string }; Returns: {
              "request_id": string,
"revision": number,
"state": NonNullable<Json>,
"updated_at": string,
"user_id": string
            }[]
                          SetofOptions: {
        from: "*"
        to: "garden_saves"
        isOneToOne: false
        isSetofReturn: true
      } },
"team_analytics":
{ Args: { "p_days"?: number }; Returns: Json
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
  "public": {
          Enums: {

          }
        }
} as const
