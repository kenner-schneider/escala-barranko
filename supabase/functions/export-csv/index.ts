// export-csv — (só Admin) exporta o mês em CSV: pessoa, tipo, datas, turnos, total de dias.
import { z } from 'npm:zod@3'
import { audit, corsHeaders, fail, getCallerProfile, handleOptions, serviceClient } from '../_shared/mod.ts'

const Input = z.object({ month: z.string().regex(/^\d{4}-\d{2}$/) })

const csvCell = (v: string) => /[";,\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v

Deno.serve(async (req) => {
  const opt = handleOptions(req)
  if (opt) return opt

  const sb = serviceClient()
  const caller = await getCallerProfile(req, sb)
  if (!caller || caller.role !== 'admin' || !caller.restaurant_id) return fail('Não autorizado.', 403)

  const parsed = Input.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return fail('Informe o mês no formato AAAA-MM.')
  const month = parsed.data.month
  const start = `${month}-01`
  const [y, m] = month.split('-').map(Number)
  const end = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10) // último dia do mês

  const { data: entries, error } = await sb
    .from('schedule_entries')
    .select('date, status, person_id, people(display_name, type), shifts(name)')
    .eq('restaurant_id', caller.restaurant_id)
    .gte('date', start).lte('date', end)
    .in('status', ['convoked', 'confirmed'])
    .order('date')
  if (error) return fail('Erro ao consultar escala.', 500)

  type Row = { date: string; status: string; person_id: string; people: { display_name: string; type: string } | null; shifts: { name: string } | null }
  const byPerson = new Map<string, { name: string; type: string; dates: Set<string>; shifts: Map<string, number> }>()
  for (const e of (entries ?? []) as unknown as Row[]) {
    const key = e.person_id
    const cur = byPerson.get(key) ?? {
      name: e.people?.display_name ?? '?', type: e.people?.type ?? '?',
      dates: new Set<string>(), shifts: new Map<string, number>(),
    }
    cur.dates.add(e.date)
    const sn = e.shifts?.name ?? '?'
    cur.shifts.set(sn, (cur.shifts.get(sn) ?? 0) + 1)
    byPerson.set(key, cur)
  }

  const lines = ['pessoa;tipo;total_dias;turnos;datas']
  for (const p of byPerson.values()) {
    const shifts = [...p.shifts.entries()].map(([n, c]) => `${n}: ${c}`).join(', ')
    const dates = [...p.dates].sort().join(', ')
    lines.push([csvCell(p.name), p.type.toUpperCase(), String(p.dates.size), csvCell(shifts), csvCell(dates)].join(';'))
  }

  await audit(sb, {
    restaurant_id: caller.restaurant_id, actor: `admin:${caller.id}`,
    action: 'report.export_csv', entity: 'schedule_entries',
  })
  return new Response('﻿' + lines.join('\n'), {
    headers: {
      ...corsHeaders,
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="escala-${month}.csv"`,
    },
  })
})
