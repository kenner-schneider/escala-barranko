// Mensagem-resumo para o grupo de WhatsApp.
// PRIVACIDADE: usa somente display_name — nunca telefone ou nome completo.
import { dayLabelPT, hhmm } from './dates'
import type { Area, Person, ScheduleEntry, Shift } from './types'

export const DEFAULT_TEMPLATE =
  '📋 Escala {dia} — {turno} ({horario}):\n{lista}'

export interface AreaMessage {
  areaId: string
  areaName: string
  color: string
  text: string
}

// Uma mensagem INDIVIDUAL por escala (setor) — cada uma copiável separadamente,
// para colar no grupo de WhatsApp da respectiva escala.
// PRIVACIDADE: usa somente display_name — nunca telefone ou nome completo.
export function buildMessagesByArea(opts: {
  template?: string
  dates: string[]
  shifts: Shift[]
  entries: ScheduleEntry[]
  people: Person[]
  areas: Area[]
}): AreaMessage[] {
  const template = opts.template?.trim() || DEFAULT_TEMPLATE
  const nameOf = new Map(opts.people.map((p) => [p.id, p.display_name]))
  const orderedShifts = [...opts.shifts].sort((a, b) => a.start_time.localeCompare(b.start_time))
  const activeAreas = [...opts.areas]
    .filter((a) => a.active)
    .sort((a, b) => a.sort_order - b.sort_order)
  const out: AreaMessage[] = []

  for (const area of activeAreas) {
    const blocks: string[] = []
    for (const date of [...opts.dates].sort()) {
      for (const shift of orderedShifts) {
        const convoked = opts.entries.filter(
          (e) => e.area_id === area.id && e.date === date && e.shift_id === shift.id &&
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
    if (blocks.length === 0) continue
    // Cabeçalho com o nome da escala — a mensagem copiada fica autoexplicativa.
    out.push({ areaId: area.id, areaName: area.name, color: area.color, text: `*${area.name}*\n\n${blocks.join('\n\n')}` })
  }
  return out
}
