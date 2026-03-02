// lib/supabase/types.ts
// Tipuri generate manual - alternativ rulezi: npx supabase gen types typescript

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile
        Insert: Omit<Profile, 'created_at' | 'updated_at'>
        Update: Partial<Omit<Profile, 'id' | 'created_at'>>
      }
      invitations: {
        Row: Invitation
        Insert: Omit<Invitation, 'id' | 'token' | 'created_at'>
        Update: Partial<Pick<Invitation, 'accepted_at'>>
      }
      leads: {
        Row: Lead
        Insert: Omit<Lead, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Lead, 'id' | 'created_at'>>
      }
      lead_history: {
        Row: LeadHistory
        Insert: Omit<LeadHistory, 'id' | 'created_at'>
        Update: never
      }
      tasks: {
        Row: Task
        Insert: Omit<Task, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Task, 'id' | 'created_at'>>
      }
      events: {
        Row: CRMEvent
        Insert: Omit<CRMEvent, 'id' | 'created_at'>
        Update: Partial<Omit<CRMEvent, 'id' | 'created_at'>>
      }
      notifications: {
        Row: Notification
        Insert: Omit<Notification, 'id' | 'created_at'>
        Update: Partial<Pick<Notification, 'is_read'>>
      }
    }
    Functions: {
      is_admin: { Returns: boolean }
      is_active_user: { Returns: boolean }
    }
  }
}

export type Profile = {
  id: string
  email: string
  full_name: string
  role: 'admin' | 'user'
  is_active: boolean
  avatar_color: string
  created_at: string
  updated_at: string
  last_login_at: string | null
}

export type Invitation = {
  id: string
  email: string
  token: string
  role: 'admin' | 'user'
  invited_by: string
  accepted_at: string | null
  expires_at: string
  created_at: string
}

export type LeadStatus = 'Nou' | 'Contactat' | 'Întâlnire programată' | 'Ofertă trimisă' | 'Client activ' | 'Pierdut'
export type LeadSource = 'Meta Ads' | 'WhatsApp' | 'Organic' | 'Referință' | 'Site web' | 'Import'

export type Lead = {
  id: string
  name: string
  company: string | null
  phone: string | null
  email: string | null
  source: LeadSource
  status: LeadStatus
  assigned_to: string | null
  note: string | null
  reminder_at: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export type LeadWithProfile = Lead & {
  assignee: Pick<Profile, 'id' | 'full_name' | 'avatar_color'> | null
}

export type LeadHistory = {
  id: string
  lead_id: string
  user_id: string | null
  action: string
  created_at: string
}

export type TaskPriority = 'high' | 'medium' | 'low'

export type Task = {
  id: string
  title: string
  lead_id: string | null
  assigned_to: string | null
  priority: TaskPriority
  due_at: string | null
  reminder_at: string | null
  is_done: boolean
  done_at: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export type EventType = 'meeting' | 'call' | 'deadline'

export type CRMEvent = {
  id: string
  title: string
  type: EventType
  lead_id: string | null
  assigned_to: string | null
  starts_at: string
  location: string | null
  note: string | null
  created_by: string | null
  created_at: string
}

export type Notification = {
  id: string
  user_id: string
  text: string
  icon: string
  is_read: boolean
  created_at: string
}
