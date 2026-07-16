// Sobreposição de horários entre turnos (mesma regra do trigger entries_no_overlap).
// end <= start = turno cruza a meia-noite (ex.: 18:00–02:00).
// Fronteiras coincidentes (11–15 e 15–23) NÃO contam como sobreposição.
import type { Shift } from './types'

const mins = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5))

export function shiftsOverlap(
  a: Pick<Shift, 'start_time' | 'end_time'>,
  b: Pick<Shift, 'start_time' | 'end_time'>,
): boolean {
  const s1 = mins(a.start_time)
  let e1 = mins(a.end_time)
  if (e1 <= s1) e1 += 1440
  const s2 = mins(b.start_time)
  let e2 = mins(b.end_time)
  if (e2 <= s2) e2 += 1440
  return s1 < e2 && s2 < e1
}
