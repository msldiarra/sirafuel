export type Database = {
  public: {
    Tables: {
      station: {
        Row: {
          id: string
          name: string
          brand: string | null
          municipality: string
          neighborhood: string
          latitude: number
          longitude: number
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['station']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['station']['Insert']>
      }
      station_status: {
        Row: {
          id: string
          station_id: string
          fuel_type: 'ESSENCE' | 'GASOIL'
          availability: 'AVAILABLE' | 'LIMITED' | 'OUT'
          pumps_active: number | null
          waiting_time_min: number | null
          waiting_time_max: number | null
          reliability_score: number
          last_update_source: 'OFFICIAL' | 'TRUSTED' | 'PUBLIC'
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['station_status']['Row'], 'id' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['station_status']['Insert']>
      }
      user_profile: {
        Row: {
          id: string
          auth_user_id: string
          email_or_phone: string
          role: 'PUBLIC' | 'STATION_MANAGER' | 'TRUSTED_REPORTER' | 'ADMIN'
          station_id: string | null
          is_verified: boolean
          must_change_password: boolean
          notifications_enabled: boolean
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['user_profile']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['user_profile']['Insert']>
      }
      station_update_notification: {
        Row: {
          id: string
          user_id: string
          station_id: string
          station_status_id: string
          is_read: boolean
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['station_update_notification']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['station_update_notification']['Insert']>
      }
      contribution: {
        Row: {
          id: string
          station_id: string
          user_id: string | null
          source_type: 'PUBLIC' | 'TRUSTED' | 'OFFICIAL'
          queue_category: 'Q_0_10' | 'Q_10_30' | 'Q_30_60' | 'Q_60_PLUS' | null
          fuel_status: 'AVAILABLE' | 'LIMITED' | 'OUT' | null
          photo_url: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['contribution']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['contribution']['Insert']>
      }
      alert: {
        Row: {
          id: string
          station_id: string
          type: 'NO_UPDATE' | 'HIGH_WAIT' | 'CONTRADICTION'
          status: 'OPEN' | 'RESOLVED'
          created_at: string
          resolved_at: string | null
        }
        Insert: Omit<Database['public']['Tables']['alert']['Row'], 'id' | 'created_at' | 'resolved_at'>
        Update: Partial<Database['public']['Tables']['alert']['Insert']>
      }
    }
  }
}

export type Station = {
  id: string
  name: string
  brand: string | null
  municipality: string
  neighborhood: string
  latitude: number
  longitude: number
  is_active: boolean
  created_at: string
  updated_at: string
}
export type StationStatus = Database['public']['Tables']['station_status']['Row']
export type UserProfile = Database['public']['Tables']['user_profile']['Row']
export type Contribution = Database['public']['Tables']['contribution']['Row']
export type Alert = Database['public']['Tables']['alert']['Row']
export type StationUpdateNotification = Database['public']['Tables']['station_update_notification']['Row']

export type FuelType = 'ESSENCE' | 'GASOIL'
export type Availability = 'AVAILABLE' | 'LIMITED' | 'OUT'
export type QueueCategory = 'Q_0_10' | 'Q_10_30' | 'Q_30_60' | 'Q_60_PLUS'
export type UserRole = 'PUBLIC' | 'STATION_MANAGER' | 'TRUSTED_REPORTER' | 'ADMIN'

