// Mensagem-resumo para o grupo de WhatsApp.
// PRIVACIDADE: usa somente display_name — nunca telefone ou nome completo.
import { dayLabelPT, hhmm } from './dates'
import type { Person, ScheduleEntry, Shift } from './types'

export const DEFAULT_TEMPLATE =
  '📋 Escala {dia} — {turno} ({horario}):\n{lista}\nConvocados: confirmem com 👍 aqui no grupo.'

export function buildMessage(opts: {
  template?: string
  dates: string[]
  shifts: Shift[]
  entries: ScheduleEntry[]
  people: Person[]
}): string {
  const template = opts.template?.trim() || DEFAULT_TEMPLATE
  const nameOf = new Map(opts.people.map((p) => [p.id, p.display_name]))
  const orderedShifts = [...opts.shifts].sort((a, b) => a.start_time.localeCompare(b.start_time))
  const blocks: string[] = []

  for (const date of [...opts.dates].sort()) {
    for (const shift of orderedShifts) {
      const convoked = opts.entries.filter(
        (e) => e.date === date && e.shift_id === shift.id &&
          (e.status === 'convoked' || e.status === 'confirmed'),
      )
      if (convoked.length === 0) continue
      const lista = convoked.map((e) => `• ${nameOf.get(e.person_id) ?? '?'}`).join('\n')
      blocks.push(
        template
          .replaceAll('{dia}', dayLabelPT(date))
          .replaceAll('{turno}', shift.name)
          .replaceAll('{horario}', `${hhmm(shift.start_time)}–${hhmm(shift.end_time)}`)
          .replaceAll('{lista}', lista),
      )
    }
  }
  return blocks.join('\n\n')
}
