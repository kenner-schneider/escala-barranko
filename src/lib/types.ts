export interface RestaurantSettings {
  availability_lead_hours: number
  default_monthly_limit: number
  message_template?: string
}

export interface Restaurant {
  id: string
  name: string
  slug: string
  status: 'active' | 'suspended'
  settings: RestaurantSettings
  created_at: string
}

export interface Profile {
  id: string
  restaurant_id: string | null
  role: 'root' | 'admin'
  name: string
}

export interface Shift {
  id: string
  restaurant_id: string
  name: string
  start_time: string
  end_time: string
  color: string
  label: string | null   // rótulo curto (ícone), até 3 chars alfanuméricos; null = usa inicial do nome
  active: boolean
}

export interface Person {
  id: string
  restaurant_id: string
  type: 'clt' | 'free'
  full_name: string
  display_name: string
  icon: string | null
  phone: string | null
  monthly_limit: number | null
  fixed_days: Record<string, string[]> | null
  area_ids: string[] | null   // escalas em que concorre; null/[] = todas
  active: boolean
}

export type EntryStatus = 'draft' | 'convoked' | 'confirmed' | 'declined'

// "Escala" (setor): bar, cozinha, atendimento... Um eixo separado do turno.
export interface Area {
  id: string
  restaurant_id: string
  name: string
  color: string
  sort_order: number
  active: boolean
}

export interface ScheduleEntry {
  id: string
  restaurant_id: string
  person_id: string
  date: string
  shift_id: string
  area_id: string
  status: EntryStatus
  convoked_at: string | null
  updated_by: string | null
  updated_at: string
}

export interface Availability {
  id: string
  restaurant_id: string
  person_id: string
  date: string
  shift_id: string
}

export interface MonthlyCount {
  restaurant_id: string
  person_id: string
  month: string
  days_worked: number
  per_shift: Record<string, number> | null
}
