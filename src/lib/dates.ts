// Datas em America/Sao_Paulo (UTC-3 fixo — Brasil sem horário de verão desde 2019).
// Datas de escala trafegam sempre como string ISO 'YYYY-MM-DD'.

export const WEEKDAYS_PT = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
// Chaves usadas em people.fixed_days; índice = getUTCDay()
export const FIXED_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']

export function todaySP(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
}

export function addDays(iso: string, n: number): string {
  const d = new Date(iso + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

/** Segunda-feira da semana que contém a data. */
export function mondayOf(iso: string): string {
  const dow = weekdayIdx(iso)
  return addDays(iso, -((dow + 6) % 7))
}

export function weekdayIdx(iso: string): number {
  return new Date(iso + 'T12:00:00Z').getUTCDay()
}

export const fmtShort = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`
export const monthOf = (iso: string) => iso.slice(0, 7)
export const hhmm = (t: string) => t.slice(0, 5)

export function monthLabelPT(month: string): string {
  const d = new Date(month + '-15T12:00:00Z')
  return d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' })
}

export function dayLabelPT(iso: string): string {
  return `${WEEKDAYS_PT[weekdayIdx(iso)]} ${fmtShort(iso)}`
}

export function addMonths(month: string, n: number): string {
  const [y, m] = month.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1 + n, 15)).toISOString().slice(0, 7)
}

export function monthRange(month: string): { start: string; end: string } {
  const [y, m] = month.split('-').map(Number)
  return {
    start: `${month}-01`,
    end: new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10),
  }
}

/** Espelho da janela do servidor (UI apenas — quem decide é o RLS). */
export function isOpenForAvailability(dateIso: string, leadHours: number): boolean {
  const midnightSP = new Date(`${dateIso}T00:00:00-03:00`).getTime()
  return Date.now() < midnightSP - leadHours * 3600_000
}
