import { ReactNode, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAdmin } from '../../components/AdminShell'
import { Empty, ErrorMsg, Loading, StarRating } from '../../components/ui'
import {
  addDays, addMonths, dayLabelPT, fmtShort, hhmm, mondayOf, monthLabelPT, monthOf, monthRange, todaySP,
} from '../../lib/dates'
import { fmtBRL, shiftAbbr } from '../../lib/format'
import { fmtScore, reviewScore } from '../../lib/score'
import { adminToken, callFn, supabase } from '../../lib/supabase'
import type {
  Criterion, EntryNote, MonthlyCount, Person, PersonReview, ScheduleEntry, Shift, TeamReview,
} from '../../lib/types'
import { ChevronLeftIcon, ChevronRightIcon, StarIcon } from '../../components/icons'

type ReportMode = 'month' | 'week'

export function Relatorios() {
  const { restaurant } = useAdmin()
  const [mode, setMode] = useState<ReportMode>('month')
  const [month, setMonth] = useState(monthOf(todaySP()))
  const [err, setErr] = useState('')
  const [exporting, setExporting] = useState(false)

  const modeSwitch = (
    <div className="view-switch">
      {(['month', 'week'] as ReportMode[]).map((m) => (
        <button key={m} className={mode === m ? 'active' : ''} onClick={() => setMode(m)}>
          {m === 'month' ? 'Mensal' : 'Semanal'}
        </button>
      ))}
    </div>
  )

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
      // Anotações de consumo do mês (aba Presença) — depois das entradas, p/ filtrar por id
      const entryIds = (entries.data as ScheduleEntry[]).map((e) => e.id)
      let notes: EntryNote[] = []
      if (entryIds.length > 0) {
        const nr = await supabase.from('entry_notes').select('*').in('entry_id', entryIds)
        if (nr.error) throw nr.error
        notes = nr.data as EntryNote[]
      }
      return {
        counts: counts.data as MonthlyCount[],
        people: people.data as Person[],
        shifts: shifts.data as Shift[],
        entries: entries.data as ScheduleEntry[],
        notes,
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

  if (mode === 'week') {
    return (
      <div>
        <h1>Relatórios</h1>
        <SemanaView modeSwitch={modeSwitch} />
      </div>
    )
  }

  if (q.isLoading) return <Loading />

  const { counts = [], people = [], shifts = [], entries = [], notes = [] } = q.data ?? {}
  const personOf = new Map(people.map((p) => [p.id, p]))
  const limitOf = (p: Person) => p.monthly_limit ?? restaurant.settings.default_monthly_limit

  const scheduled = entries.filter((e) => e.status !== 'draft')
  const presentCount = entries.filter((e) => e.status === 'confirmed').length
  const absentCount = entries.filter((e) => e.status === 'declined').length

  // Consumo anotado (R$) por pessoa no mês, via aba Presença
  const entryPerson = new Map(entries.map((e) => [e.id, e.person_id]))
  const consumoOf = new Map<string, number>()
  for (const n of notes) {
    const pid = entryPerson.get(n.entry_id)
    if (pid && n.value != null) consumoOf.set(pid, (consumoOf.get(pid) ?? 0) + n.value)
  }
  const consumoTotal = [...consumoOf.values()].reduce((a, b) => a + b, 0)

  return (
    <div>
      <h1>Relatórios</h1>
      {err && <ErrorMsg msg={err} />}
      <div className="schedule-toolbar">
        {modeSwitch}
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
          Escalas publicadas: <strong>{scheduled.length}</strong> ·
          Presenças confirmadas: <strong>{presentCount}</strong> ·
          Faltas: <strong>{absentCount}</strong>
          {consumoTotal > 0 && <> · Consumo anotado: <strong>{fmtBRL(consumoTotal)}</strong></>}
        </p>
        <p className="muted">Presenças, faltas e consumo vêm da aba Presença (dias já passados).</p>
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
                {shifts.map((s) => (
                  <th key={s.id} className="shift-col">
                    <span className="shift-th">
                      <span className="lbl" style={{ '--shift-color': s.color } as React.CSSProperties}
                        title={s.name}>
                        {shiftAbbr(s)}
                      </span>
                      <span className="hr">{hhmm(s.start_time)}–{hhmm(s.end_time)}</span>
                    </span>
                  </th>
                ))}
                <th>Consumo</th>
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
                    {shifts.map((s) => <td key={s.id} className="shift-col">{c.per_shift?.[s.id] ?? 0}</td>)}
                    <td>{consumoOf.has(c.person_id) ? fmtBRL(consumoOf.get(c.person_id)!) : <span className="muted">—</span>}</td>
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

// Relatório semanal: avaliação da equipe por serviço (dia+turno) + avaliação
// individual por critério (notas 1–5). É o "ritual semanal" do gestor.
function SemanaView({ modeSwitch }: { modeSwitch: ReactNode }) {
  const { restaurant, profile } = useAdmin()
  const qc = useQueryClient()
  const [err, setErr] = useState('')
  const [anchor, setAnchor] = useState(todaySP())
  const monday = mondayOf(anchor)
  const end = addDays(monday, 6)
  const prevMonday = addDays(monday, -7)
  const today = todaySP()

  const q = useQuery({
    queryKey: ['week_report', restaurant.id, monday],
    queryFn: async () => {
      const [people, shifts, criteria, entries, reviews, team] = await Promise.all([
        supabase.from('people').select('*').eq('restaurant_id', restaurant.id).eq('active', true).order('display_name'),
        supabase.from('shifts').select('*').eq('restaurant_id', restaurant.id).eq('active', true).order('start_time'),
        supabase.from('criteria').select('*').eq('restaurant_id', restaurant.id).eq('active', true).order('sort_order'),
        supabase.from('schedule_entries').select('*').eq('restaurant_id', restaurant.id).gte('date', monday).lte('date', end),
        supabase.from('person_reviews').select('*').eq('restaurant_id', restaurant.id).eq('week', monday),
        supabase.from('team_reviews').select('*').eq('restaurant_id', restaurant.id).gte('date', prevMonday).lte('date', end),
      ])
      const failed = [people, shifts, criteria, entries, reviews, team].find((r) => r.error)
      if (failed?.error) throw failed.error
      return {
        people: people.data as Person[],
        shifts: shifts.data as Shift[],
        criteria: criteria.data as Criterion[],
        entries: entries.data as ScheduleEntry[],
        reviews: reviews.data as PersonReview[],
        team: team.data as TeamReview[],
      }
    },
  })

  const saveTeam = useMutation({
    mutationFn: async (v: { date: string; shift_id: string; score: number | null }) => {
      if (v.score == null) {
        const { error } = await supabase.from('team_reviews').delete()
          .eq('restaurant_id', restaurant.id).eq('date', v.date).eq('shift_id', v.shift_id)
        if (error) throw error
        return
      }
      const { error } = await supabase.from('team_reviews').upsert({
        restaurant_id: restaurant.id, date: v.date, shift_id: v.shift_id,
        score: v.score, updated_by: profile.id,
      }, { onConflict: 'restaurant_id,date,shift_id' })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['week_report'] })
      qc.invalidateQueries({ queryKey: ['team_reviews'] })
      qc.invalidateQueries({ queryKey: ['scores'] })
    },
    onError: () => setErr('Não foi possível salvar a nota da equipe.'),
  })

  const saveReview = useMutation({
    mutationFn: async (v: { person_id: string; scores: Record<string, number> }) => {
      if (Object.keys(v.scores).length === 0) {
        const { error } = await supabase.from('person_reviews').delete()
          .eq('person_id', v.person_id).eq('week', monday)
        if (error) throw error
        return
      }
      const { error } = await supabase.from('person_reviews').upsert({
        restaurant_id: restaurant.id, person_id: v.person_id, week: monday,
        scores: v.scores, updated_by: profile.id,
      }, { onConflict: 'person_id,week' })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['week_report'] })
      qc.invalidateQueries({ queryKey: ['scores'] })
    },
    onError: () => setErr('Não foi possível salvar a avaliação.'),
  })

  if (q.isLoading) return <Loading />

  const { people = [], shifts = [], criteria = [], entries = [], reviews = [], team = [] } = q.data ?? {}
  const reviewOf = new Map(reviews.map((r) => [r.person_id, r]))
  const teamOf = new Map(team.map((t) => [`${t.date}|${t.shift_id}`, t]))

  const dates: string[] = []
  for (let i = 0; i < 7; i++) dates.push(addDays(monday, i))
  const published = entries.filter((e) => e.status !== 'draft')

  // Serviços da semana: dia+turno com escala publicada, já ocorridos (<= hoje)
  const services: { date: string; shift: Shift }[] = []
  for (const date of dates) {
    if (date > today) continue
    for (const shift of shifts) {
      if (published.some((e) => e.date === date && e.shift_id === shift.id)) services.push({ date, shift })
    }
  }
  const rated = services
    .map((sv) => ({ ...sv, score: teamOf.get(`${sv.date}|${sv.shift.id}`)?.score ?? null }))
  const ratedOnly = rated.filter((r) => r.score != null) as { date: string; shift: Shift; score: number }[]
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)
  const weekAvg = avg(ratedOnly.map((r) => r.score))
  const prevAvg = avg(team.filter((t) => t.date < monday).map((t) => t.score))
  const best = ratedOnly.length ? ratedOnly.reduce((a, b) => (b.score > a.score ? b : a)) : null
  const worst = ratedOnly.length ? ratedOnly.reduce((a, b) => (b.score < a.score ? b : a)) : null

  // Quem trabalhou na semana (publicado, não recusado) — são os avaliáveis
  const workers = people.filter((p) =>
    published.some((e) => e.person_id === p.id && e.status !== 'declined'))

  const serviceLabel = (r: { date: string; shift: Shift }) => `${dayLabelPT(r.date)} · ${r.shift.name}`

  return (
    <>
      {err && <ErrorMsg msg={err} />}
      <div className="schedule-toolbar">
        {modeSwitch}
        <button className="glass icon" onClick={() => setAnchor(addDays(anchor, -7))} aria-label="Semana anterior"><ChevronLeftIcon size={19} /></button>
        <strong>{fmtShort(monday)} – {fmtShort(end)}</strong>
        <button className="glass icon" onClick={() => setAnchor(addDays(anchor, 7))} aria-label="Próxima semana"><ChevronRightIcon size={19} /></button>
        <button className="btn small" onClick={() => setAnchor(todaySP())}>Esta semana</button>
      </div>

      <div className="card">
        <h2>Equipe da semana</h2>
        {services.length === 0 && <Empty msg="Nenhum serviço publicado e já ocorrido nesta semana." />}
        {services.length > 0 && (
          <>
            <div className="balance-stats">
              <div className="stat">
                <span className="stat-label"><StarIcon size={14} /> Média da equipe</span>
                <strong>{weekAvg != null ? fmtScore(weekAvg) : '—'}</strong>
                <span className="muted">semana anterior: {prevAvg != null ? fmtScore(prevAvg) : '—'}</span>
              </div>
              {best && worst && (
                <>
                  <div className="stat">
                    <span className="stat-label"><StarIcon size={14} /> Melhor serviço</span>
                    <strong>{serviceLabel(best)}</strong>
                    <span className="muted">{fmtScore(best.score)}</span>
                  </div>
                  <div className="stat">
                    <span className="stat-label"><StarIcon size={14} /> Pior serviço</span>
                    <strong>{serviceLabel(worst)}</strong>
                    <span className="muted">{fmtScore(worst.score)}</span>
                  </div>
                </>
              )}
            </div>
            <table className="simple">
              <tbody>
                {rated.map((r) => (
                  <tr key={`${r.date}|${r.shift.id}`}>
                    <td className="nowrap">{dayLabelPT(r.date)}</td>
                    <td>
                      <span className="shift-th">
                        <span className="lbl" style={{ '--shift-color': r.shift.color } as React.CSSProperties}
                          title={r.shift.name}>
                          {shiftAbbr(r.shift)}
                        </span>
                      </span>
                    </td>
                    <td>
                      <StarRating size={15} value={r.score}
                        disabled={saveTeam.isPending}
                        label={`Nota da equipe — ${serviceLabel(r)}`}
                        onChange={(v) => saveTeam.mutate({ date: r.date, shift_id: r.shift.id, score: v })} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="muted">A mesma nota pode ser dada na aba Presença, serviço a serviço.</p>
          </>
        )}
      </div>

      <div className="card">
        <h2>Avaliação individual da semana</h2>
        {criteria.length === 0 && (
          <Empty msg="Cadastre critérios de avaliação em Config → Avaliação e ranking." />
        )}
        {criteria.length > 0 && workers.length === 0 && (
          <Empty msg="Ninguém trabalhou (escala publicada) nesta semana." />
        )}
        {criteria.length > 0 && workers.length > 0 && (
          <div className="grid-scroll">
            <table className="simple eval-grid">
              <thead>
                <tr>
                  <th>Pessoa</th>
                  {criteria.map((c) => (
                    <th key={c.id}>{c.name}<br /><span className="muted">peso {c.weight}</span></th>
                  ))}
                  <th>Média</th>
                </tr>
              </thead>
              <tbody>
                {workers.map((p) => {
                  const review = reviewOf.get(p.id)
                  const scores = review?.scores ?? {}
                  const media = review ? reviewScore(review, criteria) : null
                  return (
                    <tr key={p.id}>
                      <td className="nowrap">
                        {p.icon} {p.display_name}
                        {p.type === 'clt' && <span className="badge" style={{ marginLeft: '.35rem' }}>CLT</span>}
                      </td>
                      {criteria.map((c) => (
                        <td key={c.id}>
                          <StarRating size={13} value={scores[c.id] ?? null}
                            disabled={saveReview.isPending}
                            label={`${c.name} — ${p.display_name}`}
                            onChange={(v) => {
                              const next = { ...scores }
                              if (v == null) delete next[c.id]
                              else next[c.id] = v
                              saveReview.mutate({ person_id: p.id, scores: next })
                            }} />
                        </td>
                      ))}
                      <td>
                        {media != null
                          ? <span className="badge score"><StarIcon size={11} filled /> {fmtScore(media)}</span>
                          : <span className="muted">—</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="muted">
          Média ponderada pelos pesos dos critérios. A nota vale para a semana toda; o
          ranking combina essas médias com a nota da equipe (pesos no Config).
        </p>
      </div>
    </>
  )
}
