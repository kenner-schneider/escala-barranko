import { useMemo, useState } from 'react'
import {
  DndContext, DragEndEvent, PointerSensor, useDraggable, useDroppable, useSensor, useSensors,
} from '@dnd-kit/core'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAdmin } from '../../components/AdminShell'
import { CopyButton, Empty, ErrorMsg, Loading, Modal } from '../../components/ui'
import {
  FIXED_KEYS, addDays, addMonths, dayLabelPT, fmtShort, hhmm, mondayOf, monthLabelPT, monthOf,
  monthRange, todaySP, weekdayIdx, WEEKDAYS_PT,
} from '../../lib/dates'
import { buildMessage } from '../../lib/messages'
import { supabase } from '../../lib/supabase'
import type { Area, Availability, MonthlyCount, Person, ScheduleEntry, Shift } from '../../lib/types'

type View = 'day' | 'week' | 'month'
// 'fair' = quem menos trabalhou primeiro (reordena ao escalar) · 'alpha' = ordem fixa A–Z
type SortMode = 'fair' | 'alpha'

export function Escala() {
  const { restaurant, profile } = useAdmin()
  const qc = useQueryClient()
  const [view, setView] = useState<View>('week')
  const [anchor, setAnchor] = useState(todaySP())
  const [areaId, setAreaId] = useState<string>('')
  const [selected, setSelected] = useState<{ date: string; shiftId: string } | null>(null)
  const [showBalance, setShowBalance] = useState(true)
  const [sortMode, setSortModeState] = useState<SortMode>(
    () => (localStorage.getItem('escala.sort') === 'fair' ? 'fair' : 'alpha'),
  )
  const setSortMode = (m: SortMode) => {
    localStorage.setItem('escala.sort', m)
    setSortModeState(m)
  }
  const [publishMsg, setPublishMsg] = useState<string | null>(null)
  const [err, setErr] = useState('')
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const range = useMemo(() => {
    if (view === 'day') return { start: anchor, end: anchor }
    if (view === 'week') {
      const m = mondayOf(anchor)
      return { start: m, end: addDays(m, 6) }
    }
    return monthRange(monthOf(anchor))
  }, [view, anchor])

  const gridDates = useMemo(() => {
    const dates: string[] = []
    for (let d = range.start; d <= range.end; d = addDays(d, 1)) dates.push(d)
    return dates
  }, [range])

  const months = useMemo(
    () => [...new Set([monthOf(range.start), monthOf(range.end)])],
    [range],
  )

  // --- Dados ---
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
        .eq('restaurant_id', restaurant.id).eq('active', true).order('display_name')
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
  const availQ = useQuery({
    queryKey: ['availability', restaurant.id, range.start, range.end],
    queryFn: async () => {
      const { data, error } = await supabase.from('availability').select('*')
        .eq('restaurant_id', restaurant.id).gte('date', range.start).lte('date', range.end)
      if (error) throw error
      return data as Availability[]
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
  const countsQ = useQuery({
    queryKey: ['counts', restaurant.id, months.join()],
    queryFn: async () => {
      const { data, error } = await supabase.from('monthly_counts').select('*').in('month', months)
      if (error) throw error
      return data as MonthlyCount[]
    },
  })

  const shifts = shiftsQ.data ?? []
  const people = peopleQ.data ?? []
  const availability = availQ.data ?? []
  const entries = entriesQ.data ?? []
  const counts = countsQ.data ?? []
  const areas = areasQ.data ?? []
  // Escala (setor) selecionada — cai na 1ª ativa se nenhuma escolhida ou se a escolhida sumiu.
  const selArea = areaId && areas.some((a) => a.id === areaId) ? areaId : (areas[0]?.id ?? '')
  const personOf = useMemo(() => new Map(people.map((p) => [p.id, p])), [people])

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['entries'] })
    qc.invalidateQueries({ queryKey: ['counts'] })
  }

  // --- Mutations ---
  const addEntry = useMutation({
    mutationFn: async (v: { personId: string; date: string; shiftId: string }) => {
      if (!selArea) return
      // Exclusividade por dia+turno: cada pessoa fica numa só escala naquele turno.
      const existing = entries.find(
        (e) => e.person_id === v.personId && e.date === v.date && e.shift_id === v.shiftId,
      )
      if (existing) {
        if (existing.area_id === selArea && existing.status !== 'declined') return // já aqui
        // Move para a escala atual (mantém o status; recusa volta a rascunho).
        const status = existing.status === 'declined' ? 'draft' : existing.status
        const { error } = await supabase.from('schedule_entries')
          .update({ area_id: selArea, status, updated_by: profile.id }).eq('id', existing.id)
        if (error) throw error
        return
      }
      const { error } = await supabase.from('schedule_entries').insert({
        restaurant_id: restaurant.id, person_id: v.personId, date: v.date,
        shift_id: v.shiftId, area_id: selArea, status: 'draft', updated_by: profile.id,
      })
      if (error) throw error
    },
    onSuccess: invalidate,
    onError: () => setErr('Não foi possível adicionar à escala.'),
  })

  const removeEntry = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('schedule_entries').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidate,
    onError: () => setErr('Não foi possível remover.'),
  })

  const publish = useMutation({
    mutationFn: async (dates: string[]) => {
      const { error } = await supabase.from('schedule_entries')
        .update({ status: 'convoked', convoked_at: new Date().toISOString(), updated_by: profile.id })
        .eq('restaurant_id', restaurant.id).in('date', dates).eq('status', 'draft')
      if (error) throw error
      return dates
    },
    onSuccess: (dates) => {
      const updated = entries.map((e) =>
        dates.includes(e.date) && e.status === 'draft' ? { ...e, status: 'convoked' as const } : e)
      setPublishMsg(buildMessage({
        template: restaurant.settings.message_template,
        dates, shifts, entries: updated, people, areas,
      }))
      invalidate()
    },
    onError: () => setErr('Não foi possível publicar.'),
  })

  const applyFixed = useMutation({
    mutationFn: async () => {
      if (!selArea) return
      const rows: Record<string, unknown>[] = []
      for (const date of gridDates) {
        const key = FIXED_KEYS[weekdayIdx(date)]
        for (const p of people.filter((x) => x.type === 'clt' && x.fixed_days)) {
          for (const shiftId of p.fixed_days?.[key] ?? []) {
            if (!shifts.some((s) => s.id === shiftId)) continue
            if (entries.some((e) => e.person_id === p.id && e.date === date && e.shift_id === shiftId)) continue
            rows.push({
              restaurant_id: restaurant.id, person_id: p.id, date,
              shift_id: shiftId, area_id: selArea, status: 'draft', updated_by: profile.id,
            })
          }
        }
      }
      if (rows.length === 0) return
      const { error } = await supabase.from('schedule_entries')
        .upsert(rows, { onConflict: 'person_id,date,shift_id', ignoreDuplicates: true })
      if (error) throw error
    },
    onSuccess: invalidate,
    onError: () => setErr('Não foi possível aplicar os dias fixos.'),
  })

  // --- Derivados ---
  const countOf = (personId: string, month: string) =>
    counts.find((c) => c.person_id === personId && c.month === month)?.days_worked ?? 0
  const limitOf = (p: Person) => p.monthly_limit ?? restaurant.settings.default_monthly_limit

  // Escalas no período visível — cada TURNO conta 1 (M+N no mesmo dia = 2).
  // Rascunho conta: é planejamento. Recusa não conta.
  const weekSched = useMemo(() => {
    const m = new Map<string, number>()
    for (const e of entries) {
      if (e.status === 'declined') continue
      m.set(e.person_id, (m.get(e.person_id) ?? 0) + 1)
    }
    return m
  }, [entries])
  const weekCountOf = (pid: string) => weekSched.get(pid) ?? 0

  // FREEs disponíveis e ainda não escalados numa célula (p/ indicador "N disp.")
  const availCount = (date: string, shiftId: string) =>
    availability.filter((a) =>
      a.date === date && a.shift_id === shiftId &&
      !entries.some((e) =>
        e.person_id === a.person_id && e.date === date && e.shift_id === shiftId && e.status !== 'declined',
      ),
    ).length

  const panel = useMemo(() => {
    if (!selected) return null
    const availSet = new Set(availability
      .filter((a) => a.date === selected.date && a.shift_id === selected.shiftId)
      .map((a) => a.person_id))
    const slotEntries = entries.filter(
      (e) => e.date === selected.date && e.shift_id === selected.shiftId && e.status !== 'declined')
    const taken = new Set(slotEntries.map((e) => e.person_id))
    // Já escalados em OUTRA escala neste dia+turno — oferecer "mover pra cá".
    const otherArea = slotEntries
      .filter((e) => e.area_id !== selArea)
      .map((e) => ({ person: personOf.get(e.person_id), area: areas.find((a) => a.id === e.area_id) }))
      .filter((x): x is { person: Person; area: Area | undefined } => !!x.person)
    const month = monthOf(selected.date)
    // Distribuição justa: menos escalado NA SEMANA primeiro; empate decide pelo mês.
    // Em ordem alfabética a lista fica estável (não reordena ao escalar).
    const wk = (pid: string) => (view === 'week' ? weekCountOf(pid) : 0)
    const frees = people
      .filter((p) => p.type === 'free' && availSet.has(p.id) && !taken.has(p.id))
      .sort((a, b) =>
        sortMode === 'alpha'
          ? a.display_name.localeCompare(b.display_name)
          : wk(a.id) - wk(b.id) ||
            countOf(a.id, month) - countOf(b.id, month) ||
            a.display_name.localeCompare(b.display_name))
    const clts = people.filter((p) => p.type === 'clt' && !taken.has(p.id))
    return { frees, clts, month, otherArea }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, availability, entries, people, counts, view, sortMode, selArea, areas])

  function onDragEnd(ev: DragEndEvent) {
    const activeId = String(ev.active.id)
    const overId = ev.over ? String(ev.over.id) : null
    if (!overId || !activeId.startsWith('p:') || !overId.startsWith('c:')) return
    const personId = activeId.slice(2)
    const [, date, shiftId] = overId.split(':')
    addEntry.mutate({ personId, date, shiftId })
  }

  function navigate(dir: 1 | -1) {
    setSelected(null)
    if (view === 'day') setAnchor(addDays(anchor, dir))
    else if (view === 'week') setAnchor(addDays(anchor, dir * 7))
    else setAnchor(addMonths(monthOf(anchor), dir) + '-15')
  }

  if (shiftsQ.isLoading || peopleQ.isLoading || entriesQ.isLoading || availQ.isLoading || areasQ.isLoading) return <Loading />

  if (shifts.length === 0) {
    return <Empty msg="Cadastre pelo menos 1 turno em Config para montar a escala." />
  }
  if (areas.length === 0) {
    return <Empty msg="Cadastre pelo menos 1 escala (Salão, Cozinha…) em Config para montar a escala." />
  }

  const rangeLabel = view === 'day' ? dayLabelPT(anchor)
    : view === 'week' ? `${fmtShort(range.start)} – ${fmtShort(range.end)}`
    : monthLabelPT(monthOf(anchor))
  const scopeDates = view === 'day' ? [anchor] : gridDates
  const hasDraft = entries.some((e) => scopeDates.includes(e.date) && e.status === 'draft')
  const today = todaySP()

  return (
    <div>
      <h1>Escala</h1>
      {err && <ErrorMsg msg={err} />}
      <div className="schedule-toolbar">
        <label className="area-select">
          <span>Escala</span>
          <select value={selArea} onChange={(e) => { setAreaId(e.target.value); setSelected(null) }}>
            {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </label>
        <div className="view-switch">
          {(['day', 'week', 'month'] as View[]).map((v) => (
            <button key={v} className={view === v ? 'active' : ''}
              onClick={() => { setView(v); setSelected(null) }}>
              {v === 'day' ? 'Diária' : v === 'week' ? 'Semanal' : 'Mensal'}
            </button>
          ))}
        </div>
        <button className="btn small" onClick={() => navigate(-1)}>←</button>
        <strong>{rangeLabel}</strong>
        <button className="btn small" onClick={() => navigate(1)}>→</button>
        <button className="btn small" onClick={() => { setAnchor(todaySP()); setSelected(null) }}>Hoje</button>
        <div className="spacer" />
        {view === 'week' && (
          <button className="btn" onClick={() => setShowBalance(!showBalance)}>
            {showBalance ? 'Ocultar equilíbrio' : '⚖️ Equilíbrio'}
          </button>
        )}
        {view !== 'month' && (
          <>
            <button className="btn" onClick={() => applyFixed.mutate()} disabled={applyFixed.isPending}>
              Aplicar dias fixos
            </button>
            <button className="btn primary" disabled={!hasDraft || publish.isPending}
              onClick={() => publish.mutate(scopeDates)}>
              Publicar {view === 'day' ? 'dia' : 'semana'}
            </button>
          </>
        )}
      </div>

      {view === 'week' && showBalance && (
        <BalanceView dates={gridDates} shifts={shifts} people={people}
          availability={availability} entries={entries}
          sortMode={sortMode} onSortChange={setSortMode}
          onAssign={(personId, date, shiftId) => addEntry.mutate({ personId, date, shiftId })}
          onRemove={(id) => removeEntry.mutate(id)} />
      )}

      {view === 'month' ? (
        <MonthView month={monthOf(anchor)} shifts={shifts} people={people}
          entries={entries} counts={counts} limitOf={limitOf} />
      ) : (
        <DndContext sensors={sensors} onDragEnd={onDragEnd}>
          <div className="grid-scroll">
              <table className="schedule">
                <thead>
                  <tr>
                    <th></th>
                    {gridDates.map((d) => (
                      <th key={d} className={d === today ? 'today' : ''}>
                        {WEEKDAYS_PT[weekdayIdx(d)]}<br />{fmtShort(d)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {shifts.map((shift) => (
                    <tr key={shift.id}>
                      <td className="shift-label" style={{ borderLeft: `4px solid ${shift.color}` }}>
                        {shift.name}
                        <span className="muted">{hhmm(shift.start_time)}–{hhmm(shift.end_time)}</span>
                      </td>
                      {gridDates.map((date) => (
                        <Cell key={date} date={date} shiftId={shift.id}
                          isSelected={selected?.date === date && selected.shiftId === shift.id}
                          onSelect={() => setSelected({ date, shiftId: shift.id })}>
                          {entries
                            .filter((e) => e.date === date && e.shift_id === shift.id && e.area_id === selArea)
                            .map((e) => (
                              <EntryChip key={e.id} entry={e} person={personOf.get(e.person_id)}
                                onRemove={() => removeEntry.mutate(e.id)} />
                            ))}
                          {availCount(date, shift.id) > 0 && (
                            <span className="cell-avail">{availCount(date, shift.id)} disp.</span>
                          )}
                        </Cell>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
          </div>
          <p className="muted" style={{ marginTop: '.4rem' }}>
            Toque numa célula para ver e escalar quem está disponível · rascunhos têm borda
            tracejada e só aparecem para os FREE depois de publicar.
          </p>

          {selected && panel && (
            <aside className="side-panel card">
              <div className="side-panel-head">
                <h3>
                  {dayLabelPT(selected.date)} — {shifts.find((s) => s.id === selected.shiftId)?.name}
                </h3>
                <button className="btn small primary"
                  disabled={publish.isPending ||
                    !entries.some((e) => e.date === selected.date && e.status === 'draft')}
                  title="Publica só este dia (rascunhos viram convocados)"
                  onClick={() => publish.mutate([selected.date])}>
                  Publicar {dayLabelPT(selected.date)}
                </button>
                <button className="btn-icon" onClick={() => setSelected(null)}
                  aria-label="Fechar painel">✕</button>
              </div>
              <p className="muted">
                Escalando em <strong>{areas.find((a) => a.id === selArea)?.name}</strong> · FREE disponíveis ·{' '}
                {sortMode === 'alpha' ? 'ordem A–Z' : 'quem menos trabalhou primeiro'}
              </p>
              {panel.frees.length === 0 && <Empty msg="Nenhum FREE disponível neste turno." />}
              <div className="person-list">
                {panel.frees.map((p) => {
                  const worked = countOf(p.id, panel.month)
                  const over = worked >= limitOf(p)
                  return (
                    <DraggablePerson key={p.id} person={p}
                      onAdd={() => addEntry.mutate({ personId: p.id, date: selected.date, shiftId: selected.shiftId })}>
                      <span className={`badge ${over ? 'over' : ''}`}
                        title="Alerta gerencial — não é parecer trabalhista">
                        {view === 'week' ? `sem ${weekCountOf(p.id)} · ` : ''}{worked}/{limitOf(p)}
                      </span>
                    </DraggablePerson>
                  )
                })}
              </div>
              {panel.otherArea.length > 0 && (
                <>
                  <h3 style={{ marginTop: '.5rem' }}>Em outra escala neste turno</h3>
                  <div className="person-list">
                    {panel.otherArea.map(({ person, area }) => (
                      <div key={person.id} className="person-row">
                        <span>{person.icon ?? '👤'}</span>
                        <span className="grow">{person.display_name}</span>
                        <span className="badge" style={area ? { borderColor: area.color } : undefined}>
                          {area?.name ?? '—'}
                        </span>
                        <button className="btn small"
                          title={`Mover ${person.display_name} para ${areas.find((a) => a.id === selArea)?.name}`}
                          onClick={() => addEntry.mutate({ personId: person.id, date: selected.date, shiftId: selected.shiftId })}>
                          mover
                        </button>
                      </div>
                    ))}
                  </div>
                </>
              )}
              <h3 style={{ marginTop: '.5rem' }}>CLT (atribuição direta)</h3>
              <div className="person-list">
                {panel.clts.map((p) => (
                  <DraggablePerson key={p.id} person={p}
                    onAdd={() => addEntry.mutate({ personId: p.id, date: selected.date, shiftId: selected.shiftId })} />
                ))}
              </div>
            </aside>
          )}
        </DndContext>
      )}

      {publishMsg !== null && (
        <Modal title="Mensagem para o grupo" onClose={() => setPublishMsg(null)}>
          {publishMsg ? (
            <>
              <pre className="message">{publishMsg}</pre>
              <CopyButton text={publishMsg} label="Copiar mensagem" />
              <p className="muted">Cole no grupo de WhatsApp dos FREE. A mensagem usa só nomes de exibição.</p>
            </>
          ) : (
            <p>Nada foi publicado — não havia convocados no período.</p>
          )}
        </Modal>
      )}
    </div>
  )
}

// --- Subcomponentes ---

function Cell({ date, shiftId, isSelected, onSelect, children }: {
  date: string
  shiftId: string
  isSelected: boolean
  onSelect: () => void
  children: React.ReactNode
}) {
  const { isOver, setNodeRef } = useDroppable({ id: `c:${date}:${shiftId}` })
  return (
    <td ref={setNodeRef} onClick={onSelect}
      className={`cell ${isSelected ? 'selected' : ''} ${isOver ? 'drop-over' : ''}`}>
      {children}
    </td>
  )
}

function DraggablePerson({ person, onAdd, children }: {
  person: Person
  onAdd: () => void
  children?: React.ReactNode
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: `p:${person.id}` })
  const style = transform
    ? { transform: `translate(${transform.x}px, ${transform.y}px)`, zIndex: 30, position: 'relative' as const, opacity: isDragging ? 0.85 : 1 }
    : undefined
  return (
    <div ref={setNodeRef} {...listeners} {...attributes} className="person-row" style={style}>
      <span>{person.icon ?? '👤'}</span>
      <span className="grow">{person.display_name}</span>
      {children}
      <button className="btn small" onPointerDown={(e) => e.stopPropagation()} onClick={onAdd}
        aria-label={`Escalar ${person.display_name}`}>+</button>
    </div>
  )
}

const STATUS_TITLE: Record<string, string> = {
  draft: 'Rascunho (não publicado)',
  convoked: 'Convocado — aguardando resposta',
  confirmed: 'Confirmado',
  declined: 'Recusou — vaga reaberta',
}

function EntryChip({ entry, person, onRemove }: {
  entry: ScheduleEntry
  person: Person | undefined
  onRemove: () => void
}) {
  if (!person) return null
  return (
    <span className={`chip ${person.type} ${entry.status}`} title={STATUS_TITLE[entry.status]}
      onClick={(e) => e.stopPropagation()}>
      {person.icon ?? '👤'} {person.display_name}
      <span className="chip-actions">
        <button
          title="Remover da escala"
          onClick={() => {
            if (entry.status === 'draft' ||
              confirm(`Remover ${person.display_name} da escala publicada?`)) onRemove()
          }}>✕</button>
      </span>
    </span>
  )
}

// Ícones cartoon do turno. Estados: "aceso" (on = escalado) e "apagado" (disponível).
// Lua: amarela iluminada × cinza apagada. Sol: vibrante com contorno × suave sem contorno.
function MoonIcon({ on, size }: { on: boolean; size: number }) {
  const body = on ? '#FBE27A' : '#E9E7E2'
  const crater = on ? '#F7CE46' : '#B9B6B0'
  const line = '#26201A'
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="10.4" fill={body} stroke={line} strokeWidth="1.6" />
      <circle cx="14.8" cy="8.4" r="2.7" fill={crater} stroke={line} strokeWidth="1.3" />
      <circle cx="8" cy="13.2" r="2" fill={crater} stroke={line} strokeWidth="1.3" />
      <circle cx="15.2" cy="15.8" r="1.5" fill={crater} stroke={line} strokeWidth="1.2" />
      <circle cx="9.4" cy="6.8" r="1" fill={crater} stroke={line} strokeWidth="1.1" />
    </svg>
  )
}

function SunIcon({ on, size }: { on: boolean; size: number }) {
  const ray = on ? '#F28C1E' : '#F3B25A'
  const core = on ? '#F9D14C' : '#F6CE55'
  const line = '#26201A'
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <g stroke={ray} strokeWidth="2.6" strokeLinecap="round">
        {Array.from({ length: 12 }).map((_, i) => {
          const a = (i * Math.PI) / 6
          const cos = Math.cos(a)
          const sin = Math.sin(a)
          return (
            <line key={i}
              x1={12 + 8.6 * cos} y1={12 + 8.6 * sin}
              x2={12 + 11 * cos} y2={12 + 11 * sin} />
          )
        })}
      </g>
      <circle cx="12" cy="12" r="6.3" fill={core}
        stroke={on ? line : 'none'} strokeWidth="1.6" />
      <path d="M9 9.8a4.3 4.3 0 0 1 3.2-1.9" stroke="#FDF3C0" strokeWidth="1.5"
        fill="none" strokeLinecap="round" />
    </svg>
  )
}

// Horário de início decide: 5h–11h59 = sol, 17h+ (ou madrugada) = lua.
// Outros horários (ex.: turno de tarde criado depois) usam a inicial do nome.
function ShiftIcon({ shift, on, size = 26 }: { shift: Shift; on: boolean; size?: number }) {
  const h = parseInt(shift.start_time.slice(0, 2), 10)
  if (h >= 17 || h < 5) return <MoonIcon on={on} size={size} />
  if (h >= 5 && h < 12) return <SunIcon on={on} size={size} />
  return (
    <span className="letter-icon" style={{ fontSize: size * 0.58 }} aria-hidden="true">
      {shift.name.charAt(0).toUpperCase()}
    </span>
  )
}

// Matriz FREE × dias: todas as possibilidades da semana para escalar com igualdade.
// Contorno = disponível (clique escala) · preenchido = escalado · quem menos trabalhou vem primeiro.
function BalanceView({ dates, shifts, people, availability, entries, sortMode, onSortChange, onAssign, onRemove }: {
  dates: string[]
  shifts: Shift[]
  people: Person[]
  availability: Availability[]
  entries: ScheduleEntry[]
  sortMode: SortMode
  onSortChange: (m: SortMode) => void
  onAssign: (personId: string, date: string, shiftId: string) => void
  onRemove: (entryId: string) => void
}) {
  const frees = people.filter((p) => p.type === 'free')
  const availOf = (pid: string, d: string, s: string) =>
    availability.some((a) => a.person_id === pid && a.date === d && a.shift_id === s)
  const entryOf = (pid: string, d: string, s: string) =>
    entries.find((e) => e.person_id === pid && e.date === d && e.shift_id === s)

  const rows = frees
    .map((p) => {
      // Cada TURNO conta 1 escala/possibilidade (M+N no mesmo dia = 2)
      const sched = entries.filter((e) => e.person_id === p.id && e.status !== 'declined')
      // "possível" = marcou disponibilidade OU já está escalado (escalado implica possível)
      const possible = new Set([
        ...availability.filter((a) => a.person_id === p.id).map((a) => `${a.date}|${a.shift_id}`),
        ...sched.map((e) => `${e.date}|${e.shift_id}`),
      ])
      return { p, possible: possible.size, scheduled: sched.length }
    })
    .sort((a, b) =>
      sortMode === 'alpha'
        ? a.p.display_name.localeCompare(b.p.display_name)
        : a.scheduled - b.scheduled || b.possible - a.possible ||
          a.p.display_name.localeCompare(b.p.display_name))

  // Estatísticas da semana (só entre FREEs com alguma possibilidade)
  const participants = rows.filter((r) => r.possible > 0)
  const minSched = participants.length ? Math.min(...participants.map((r) => r.scheduled)) : 0
  const maxSched = participants.length ? Math.max(...participants.map((r) => r.scheduled)) : 0
  const minNames = participants.filter((r) => r.scheduled === minSched).map((r) => r.p.display_name)
  const maxNames = participants.filter((r) => r.scheduled === maxSched).map((r) => r.p.display_name)
  const avg = participants.length
    ? participants.reduce((s, r) => s + r.scheduled, 0) / participants.length
    : 0
  // Mediana: robusta a extremos (um FREE muito escalado não distorce o "típico")
  const sortedSched = participants.map((r) => r.scheduled).sort((a, b) => a - b)
  const median = sortedSched.length === 0 ? 0
    : sortedSched.length % 2
      ? sortedSched[(sortedSched.length - 1) / 2]
      : (sortedSched[sortedSched.length / 2 - 1] + sortedSched[sortedSched.length / 2]) / 2
  const num = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 1 })
  const fmtNames = (ns: string[]) =>
    ns.length <= 2 ? ns.join(' e ') : `${ns[0]}, ${ns[1]} e mais ${ns.length - 2}`
  const plural = (n: number) => (n === 1 ? 'escala' : 'escalas')

  return (
    <div className="card balance-card">
      <div className="balance-head">
        <h2>⚖️ Equilíbrio da semana</h2>
        <span className="muted">Ordenar:</span>
        <div className="view-switch">
          <button className={sortMode === 'fair' ? 'active' : ''}
            title="Quem menos trabalhou aparece primeiro; a lista reordena conforme você escala"
            onClick={() => onSortChange('fair')}>
            ⚖️ Menos escalados
          </button>
          <button className={sortMode === 'alpha' ? 'active' : ''}
            title="Ordem fixa por nome — a lista não muda enquanto você escala"
            onClick={() => onSortChange('alpha')}>
            A–Z
          </button>
        </div>
      </div>
      <p className="muted">
        Todas as possibilidades dos FREE — sol = turno de dia, lua = noite.{' '}
        {shifts[0] && (
          <>
            <span className="pill demo-pill icon-pill"
              style={{ borderColor: 'var(--border-strong)' }}>
              <ShiftIcon shift={shifts[0]} on={false} />
            </span>{' '}
            apagado = disponível (clique para escalar) ·{' '}
            <span className="pill demo-pill icon-pill"
              style={{ background: `${shifts[0].color}26`, borderColor: shifts[0].color }}>
              <ShiftIcon shift={shifts[0]} on />
            </span>{' '}
            aceso = escalado ·{' '}
          </>
        )}
        placar = escalas / possibilidades — 2 turnos no mesmo dia contam 2.
        {sortMode === 'alpha' && ' Ordem fixa A–Z (o painel segue a mesma ordem).'}
      </p>
      {participants.length > 0 && (
        minSched === maxSched ? (
          <div className="balance-stats">
            <div className="stat">
              <span className="stat-label">✅ Semana equilibrada</span>
              <strong>todos com {minSched} {plural(minSched)}</strong>
            </div>
            <div className="stat">
              <span className="stat-label">📊 Mediana por FREE</span>
              <strong>{num(median)}</strong>
              <span className="muted">média {num(avg)} · {plural(median)} na semana</span>
            </div>
          </div>
        ) : (
          <div className="balance-stats">
            <div className="stat">
              <span className="stat-label">🔻 Menos escalado</span>
              <strong>{fmtNames(minNames)}</strong>
              <span className="muted">{minSched} {plural(minSched)}</span>
            </div>
            <div className="stat">
              <span className="stat-label">🔺 Mais escalado</span>
              <strong>{fmtNames(maxNames)}</strong>
              <span className="muted">{maxSched} {plural(maxSched)}</span>
            </div>
            <div className="stat">
              <span className="stat-label">📊 Mediana por FREE</span>
              <strong>{num(median)}</strong>
              <span className="muted">média {num(avg)} · {plural(median)} na semana</span>
            </div>
          </div>
        )
      )}
      <div className="grid-scroll">
        <table className="simple balance">
          <thead>
            <tr>
              <th>FREE</th>
              {dates.map((d) => (
                <th key={d}>{WEEKDAYS_PT[weekdayIdx(d)]}<br />{fmtShort(d)}</th>
              ))}
              <th>Semana</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ p, possible, scheduled }) => (
              <tr key={p.id}>
                <td className="nowrap name-cell">
                  {p.icon} {p.display_name}
                  <span className="sched-count" title="Vezes escalado nesta semana">{scheduled}</span>
                </td>
                {dates.map((d) => (
                  <td key={d}>
                    {shifts.map((s) => {
                      const e = entryOf(p.id, d, s.id)
                      const av = availOf(p.id, d, s.id)
                      if (!e && !av) return null
                      const status = e?.status
                      const scheduled = status && status !== 'declined'
                      return (
                        <button key={s.id}
                          className={`pill icon-pill ${status ?? 'avail'}`}
                          style={scheduled
                            ? { background: `${s.color}26`, borderColor: s.color }
                            : status === 'declined' ? undefined : { borderColor: 'var(--border-strong)' }}
                          title={`${s.name} ${hhmm(s.start_time)}–${hhmm(s.end_time)} — ${status ? STATUS_TITLE[status] : 'disponível: clique para escalar'}`}
                          onClick={() => {
                            if (!e || e.status === 'declined') onAssign(p.id, d, s.id)
                            else if (e.status === 'draft') onRemove(e.id)
                          }}>
                          <ShiftIcon shift={s} on={!!scheduled} />
                        </button>
                      )
                    })}
                  </td>
                ))}
                <td className="nowrap">
                  <span className="muted">de {possible}</span>
                  <span className="bar">
                    <i style={{ width: `${possible ? Math.min(100, (scheduled / possible) * 100) : 0}%` }} />
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.every((r) => r.possible === 0) && (
        <Empty msg="Nenhum FREE marcou disponibilidade nesta semana." />
      )}
    </div>
  )
}

function MonthView({ month, shifts, people, entries, counts, limitOf }: {
  month: string
  shifts: Shift[]
  people: Person[]
  entries: ScheduleEntry[]
  counts: MonthlyCount[]
  limitOf: (p: Person) => number
}) {
  const monthCounts = counts.filter((c) => c.month === month)
  const active = entries.filter((e) => e.status === 'convoked' || e.status === 'confirmed')
  const dates = [...new Set(active.map((e) => e.date))].sort()
  const personOf = new Map(people.map((p) => [p.id, p]))

  return (
    <div>
      <div className="card">
        <h2>Panorama do mês</h2>
        {dates.length === 0 && <Empty msg="Nenhuma convocação publicada neste mês ainda." />}
        {dates.length > 0 && (
          <div className="grid-scroll">
            <table className="simple">
              <thead>
                <tr><th>Dia</th>{shifts.map((s) => <th key={s.id}>{s.name}</th>)}</tr>
              </thead>
              <tbody>
                {dates.map((d) => (
                  <tr key={d}>
                    <td>{dayLabelPT(d)}</td>
                    {shifts.map((s) => {
                      const names = active
                        .filter((e) => e.date === d && e.shift_id === s.id)
                        .map((e) => personOf.get(e.person_id)?.display_name ?? '?')
                      return <td key={s.id}>{names.join(', ') || '—'}</td>
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card">
        <h2>Totais por pessoa</h2>
        {monthCounts.length === 0 && <Empty msg="Sem dados neste mês." />}
        {monthCounts.length > 0 && (
          <table className="simple">
            <thead>
              <tr><th>Pessoa</th><th>Dias</th>{shifts.map((s) => <th key={s.id}>{s.name}</th>)}</tr>
            </thead>
            <tbody>
              {monthCounts.map((c) => {
                const p = personOf.get(c.person_id)
                if (!p) return null
                const over = p.type === 'free' && c.days_worked >= limitOf(p)
                return (
                  <tr key={c.person_id}>
                    <td>{p.icon} {p.display_name} {p.type === 'clt' && <span className="badge">CLT</span>}</td>
                    <td>
                      <span className={`badge ${over ? 'over' : ''}`}
                        title="Alerta gerencial — não é parecer trabalhista">
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
