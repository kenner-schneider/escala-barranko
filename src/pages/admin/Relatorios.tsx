import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAdmin } from '../../components/AdminShell'
import { Empty, ErrorMsg, Loading } from '../../components/ui'
import { addMonths, monthLabelPT, monthOf, monthRange, todaySP } from '../../lib/dates'
import { adminToken, callFn, supabase } from '../../lib/supabase'
import type { MonthlyCount, Person, ScheduleEntry, Shift } from '../../lib/types'
import { ChevronLeftIcon, ChevronRightIcon } from '../../components/icons'

export function Relatorios() {
  const { restaurant } = useAdmin()
  const [month, setMonth] = useState(monthOf(todaySP()))
  const [err, setErr] = useState('')
  const [exporting, setExporting] = useState(false)

  const q = useQuery({
    queryKey: ['report', restaurant.id, month],
    queryFn: async () => {
      const { start, end } = monthRange(month)
      const [counts, people, shifts, entries] = await Promise.all([
        supabase.from('monthly_counts').select('*').eq('month', month),
        supabase.from('people').select('*').eq('restaurant_id', restaurant.id),
        supabase.from('shifts').select('*').eq('restaurant_id', restaurant.id).eq('active', true).order('start_time'),
        supabase.from('schedule_entries').select('*')
          .eq('restaurant_id', restaurant.id).gte('date', start).lte('date', end),
      ])
      const failed = [counts, people, shifts, entries].find((r) => r.error)
      if (failed?.error) throw failed.error
      return {
        counts: counts.data as MonthlyCount[],
        people: people.data as Person[],
        shifts: shifts.data as Shift[],
        entries: entries.data as ScheduleEntry[],
      }
    },
  })

  async function exportCsv() {
    setExporting(true)
    setErr('')
    try {
      const token = await adminToken()
      const csv = await callFn<string>('export-csv', { month }, token)
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `escala-${month}.csv`
      a.click()
      URL.revokeObjectURL(a.href)
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setExporting(false)
    }
  }

  if (q.isLoading) return <Loading />

  const { counts = [], people = [], shifts = [], entries = [] } = q.data ?? {}
  const personOf = new Map(people.map((p) => [p.id, p]))
  const limitOf = (p: Person) => p.monthly_limit ?? restaurant.settings.default_monthly_limit

  const published = entries.filter((e) => e.status !== 'draft')
  const confirmed = entries.filter((e) => e.status === 'confirmed').length
  const rate = published.length ? Math.round((confirmed / published.length) * 100) : null

  return (
    <div>
      <h1>Relatórios</h1>
      {err && <ErrorMsg msg={err} />}
      <div className="schedule-toolbar">
        <button className="glass icon" onClick={() => setMonth(addMonths(month, -1))} aria-label="Mês anterior"><ChevronLeftIcon size={19} /></button>
        <strong>{monthLabelPT(month)}</strong>
        <button className="glass icon" onClick={() => setMonth(addMonths(month, 1))} aria-label="Próximo mês"><ChevronRightIcon size={19} /></button>
        <div className="spacer" />
        <button className="btn primary" onClick={exportCsv} disabled={exporting}>
          {exporting ? 'Exportando…' : 'Exportar CSV'}
        </button>
      </div>

      <div className="card">
        <h2>Resumo do mês</h2>
        <p>
          Convocações publicadas: <strong>{published.length}</strong> ·
          Confirmadas: <strong>{confirmed}</strong> ·
          Taxa de confirmação: <strong>{rate === null ? '—' : `${rate}%`}</strong>
        </p>
      </div>

      <div className="card">
        <h2>Dias por pessoa</h2>
        <p className="muted">Alerta gerencial — não é parecer trabalhista.</p>
        {counts.length === 0 && <Empty msg="Sem convocações neste mês." />}
        {counts.length > 0 && (
          <table className="simple">
            <thead>
              <tr>
                <th>Pessoa</th><th>Tipo</th><th>Dias</th>
                {shifts.map((s) => <th key={s.id}>{s.name}</th>)}
              </tr>
            </thead>
            <tbody>
              {[...counts].sort((a, b) => b.days_worked - a.days_worked).map((c) => {
                const p = personOf.get(c.person_id)
                if (!p) return null
                const over = p.type === 'free' && c.days_worked >= limitOf(p)
                return (
                  <tr key={c.person_id}>
                    <td>{p.icon} {p.display_name}</td>
                    <td>{p.type.toUpperCase()}</td>
                    <td>
                      <span className={`badge ${over ? 'over' : ''}`}>
                        {c.days_worked}{p.type === 'free' ? `/${limitOf(p)}` : ''}
                      </span>
                    </td>
                    {shifts.map((s) => <td key={s.id}>{c.per_shift?.[s.id] ?? 0}</td>)}
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
