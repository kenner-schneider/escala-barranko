// Mensagem-resumo para o grupo de WhatsApp.
// PRIVACIDADE: usa somente display_name — nunca telefone ou nome completo.
import { dayLabelPT, hhmm } from './dates'
import type { Area, Person, ScheduleEntry, Shift } from './types'

export const DEFAULT_TEMPLATE =
  '📋 Escala {dia} — {turno} ({horario}):\n{lista}'

export function buildMessage(opts: {
  template?: string
  dates: string[]
  shifts: Shift[]
  entries: ScheduleEntry[]
  people: Person[]
  areas?: Area[]
}): string {
  const template = opts.template?.trim() || DEFAULT_TEMPLATE
  const nameOf = new Map(opts.people.map((p) => [p.id, p.display_name]))
  const areaOf = new Map((opts.areas ?? []).map((a) => [a.id, a]))
  // Só rotula por escala quando há mais de uma ativa (restaurante com escala única fica limpo).
  const multiArea = (opts.areas ?? []).filter((a) => a.active).length > 1
  const orderedShifts = [...opts.shifts].sort((a, b) => a.start_time.localeCompare(b.start_time))
  const blocks: string[] = []

  for (const date of [...opts.dates].sort()) {
    for (const shift of orderedShifts) {
      const convoked = opts.entries.filter(
        (e) => e.date === date && e.shift_id === shift.id &&
          (e.status === 'convoked' || e.status === 'confirmed'),
      )
      if (convoked.length === 0) continue

      let lista: string
      if (multiArea) {
        // Agrupa por escala (setor), na ordem de sort_order.
        const byArea = new Map<string, string[]>()
        for (const e of convoked) {
          const arr = byArea.get(e.area_id) ?? []
          arr.push(nameOf.get(e.person_id) ?? '?')
          byArea.set(e.area_id, arr)
        }
        lista = [...byArea.keys()]
          .sort((a, b) => (areaOf.get(a)?.sort_order ?? 0) - (areaOf.get(b)?.sort_order ?? 0))
          .map((aid) => `${areaOf.get(aid)?.name ?? 'Escala'}: ${byArea.get(aid)!.join(', ')}`)
          .join('\n')
      } else {
        lista = convoked.map((e) => `• ${nameOf.get(e.person_id) ?? '?'}`).join('\n')
      }

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
