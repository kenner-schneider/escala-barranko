import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAdmin } from '../../components/AdminShell'
import { Empty, ErrorMsg, Loading } from '../../components/ui'
import { addDays, dayLabelPT, fmtShort, hhmm, mondayOf, todaySP } from '../../lib/dates'
import { supabase } from '../../lib/supabase'
import type { Area, Person, ScheduleEntry, Shift } from '../../lib/types'
import {
  CalendarCheckIcon, CheckIcon, ChevronLeftIcon, ChevronRightIcon, XIcon,
} from '../../components/icons'

// Presença pós-trabalho: confirma se cada escalado FOI (confirmed) ou FALTOU (declined).
// Só dias que já passaram (<= hoje). Reaproveita o enum — faltou sai da contagem de dias.
export function Presenca() {
  const { restaurant, profile } = useAdmin()
  const qc = useQueryClient()
  const [anchor, setAnchor] = useState(todaySP())
  const [err, setErr] = useState('')
  const today = todaySP()

  const monday = mondayOf(anchor)
  const range = { start: monday, end: addDays(monday, 6) }

  const shiftsQ = useQuery({
    queryKey: ['shifts', restaurant.id],
    queryFn: async () => {
      const { data, error } = await supabase.from('shifts').select('*')
        .eq('restaurant_id', restaurant.id).eq('active', true).order('start_time')
      if (error) throw error
      return data as Shift[]
    },
  })
  const peopleQ = useQuery({
    queryKey: ['people', restaurant.id],
    queryFn: async () => {
      const { data, error } = await supabase.from('people').select('*')
        .eq('restaurant_id', restaurant.id).order('display_name')
      if (error) throw error
      return data as Person[]
    },
  })
  const areasQ = useQuery({
    queryKey: ['areas', restaurant.id],
    queryFn: async () => {
      const { data, error } = await supabase.from('areas').select('*')
        .eq('restaurant_id', restaurant.id).eq('active', true).order('sort_order')
      if (error) throw error
      return data as Area[]
    },
  })
  const entriesQ = useQuery({
    queryKey: ['entries', restaurant.id, range.start, range.end],
    queryFn: async () => {
      const { data, error } = await supabase.from('schedule_entries').select('*')
        .eq('restaurant_id', restaurant.id).gte('date', range.start).lte('date', range.end)
      if (error) throw error
      return data as ScheduleEntry[]
    },
  })

  const shifts = shiftsQ.data ?? []
  const people = peopleQ.data ?? []
  const areas = areasQ.data ?? []
  const entries = entriesQ.data ?? []
  const personOf = useMemo(() => new Map(people.map((p) => [p.id, p])), [people])
  const areaOf = useMemo(() => new Map(areas.map((a) => [a.id, a])), [areas])

  const setStatus = useMutation({
    mutationFn: async (v: { id: string; status: 'convoked' | 'confirmed' | 'declined' }) => {
      const { error } = await supabase.from('schedule_entries')
        .update({ status: v.status, updated_by: profile.id }).eq('id', v.id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['entries'] })
      qc.invalidateQueries({ queryKey: ['counts'] })
    },
    onError: () => setErr('Não foi possível salvar a presença.'),
  })

  if (shiftsQ.isLoading || peopleQ.isLoading || areasQ.isLoading || entriesQ.isLoading) return <Loading />

  // Só dias já passados (incluindo hoje) e apenas escalas publicadas (não rascunho).
  const pastDates: string[] = []
  for (let d = range.start; d <= range.end; d = addDays(d, 1)) {
    if (d <= today) pastDates.push(d)
  }
  const published = entries.filter((e) => e.status !== 'draft' && e.date <= today)
  const present = published.filter((e) => e.status === 'confirmed').length
  const absent = published.filter((e) => e.status === 'declined').length
  const pending = published.filter((e) => e.status === 'convoked').length

  return (
    <div>
      <h1>Presença</h1>
      {err && <ErrorMsg msg={err} />}
      <div className="schedule-toolbar">
        <button className="glass icon" onClick={() => setAnchor(addDays(anchor, -7))} aria-label="Semana anterior"><ChevronLeftIcon size={19} /></button>
        <strong>{fmtShort(range.start)} – {fmtShort(range.end)}</strong>
        <button className="glass icon" onClick={() => setAnchor(addDays(anchor, 7))} aria-label="Próxima semana"><ChevronRightIcon size={19} /></button>
        <button className="btn small" onClick={() => setAnchor(todaySP())}>Esta semana</button>
        <div className="spacer" />
        <span className="badge" style={{ color: 'var(--success)', borderColor: 'var(--success)' }}>
          <CheckIcon size={12} /> {present} presença{present === 1 ? '' : 's'}
        </span>
        <span className="badge over">{absent} falta{absent === 1 ? '' : 's'}</span>
        {pending > 0 && <span className="badge">{pending} pendente{pending === 1 ? '' : 's'}</span>}
      </div>

      {pastDates.length === 0 && (
        <Empty msg="Nenhum dia passado nesta semana ainda. Volte após o primeiro turno." />
      )}

      {pastDates.map((date) => {
        const dayEntries = published.filter((e) => e.date === date)
        if (dayEntries.length === 0) return null
        return (
          <div className="card presenca-day" key={date}>
            <h2>{dayLabelPT(date)}</h2>
            {shifts.map((shift) => {
              const rows = dayEntries.filter((e) => e.shift_id === shift.id)
              if (rows.length === 0) return null
              return (
                <div className="presenca-shift" key={shift.id}>
                  <div className="presenca-shift-head" style={{ borderLeft: `4px solid ${shift.color}` }}>
                    {shift.name} <span className="muted">{hhmm(shift.start_time)}–{hhmm(shift.end_time)}</span>
                  </div>
                  {rows.map((e) => {
                    const p = personOf.get(e.person_id)
                    const area = areaOf.get(e.area_id)
                    if (!p) return null
                    const setTo = (s: 'confirmed' | 'declined') =>
                      setStatus.mutate({ id: e.id, status: e.status === s ? 'convoked' : s })
                    return (
                      <div className={`presenca-row ${e.status}`} key={e.id}>
                        <span className="presenca-who">
                          {p.icon} <span className="grow">{p.display_name}</span>
                          {p.type === 'clt' && <span className="badge">CLT</span>}
                          {area && (
                            <span className="badge" style={{ borderColor: area.color }}>{area.name}</span>
                          )}
                        </span>
                        <div className="presenca-toggle">
                          <button
                            className={`pres-btn foi ${e.status === 'confirmed' ? 'active' : ''}`}
                            disabled={setStatus.isPending}
                            onClick={() => setTo('confirmed')}>
                            <CheckIcon size={14} /> Foi
                          </button>
                          <button
                            className={`pres-btn faltou ${e.status === 'declined' ? 'active' : ''}`}
                            disabled={setStatus.isPending}
                            onClick={() => setTo('declined')}>
                            <XIcon size={14} /> Faltou
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        )
      })}

      {pastDates.length > 0 && published.length === 0 && (
        <Empty msg="Ninguém foi escalado nos dias já passados desta semana." />
      )}

      <p className="muted" style={{ marginTop: '.6rem', display: 'flex', alignItems: 'center', gap: '.4rem' }}>
        <CalendarCheckIcon size={15} /> Falta não conta como dia trabalhado nos relatórios. Clique de novo para desmarcar.
      </p>
    </div>
  )
}
