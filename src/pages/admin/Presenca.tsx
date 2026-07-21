import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAdmin } from '../../components/AdminShell'
import { Empty, ErrorMsg, Loading, StarRating } from '../../components/ui'
import { addDays, dayLabelPT, fmtShort, hhmm, mondayOf, todaySP } from '../../lib/dates'
import { fmtBRL, parseValorBRL } from '../../lib/format'
import { supabase } from '../../lib/supabase'
import type { Area, EntryNote, Person, ScheduleEntry, Shift, TeamReview } from '../../lib/types'
import {
  CalendarCheckIcon, CheckIcon, ChevronLeftIcon, ChevronRightIcon, PencilIcon, XIcon,
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

  // Anotações (consumo) das entradas da semana — tabela própria, invisível ao FREE.
  const entryIds = entries.map((e) => e.id)
  const notesQ = useQuery({
    queryKey: ['entry_notes', restaurant.id, range.start, range.end],
    enabled: entriesQ.isSuccess,
    queryFn: async () => {
      if (entryIds.length === 0) return [] as EntryNote[]
      const { data, error } = await supabase.from('entry_notes').select('*').in('entry_id', entryIds)
      if (error) throw error
      return data as EntryNote[]
    },
  })
  const notes = notesQ.data ?? []
  const noteOf = useMemo(() => new Map(notes.map((n) => [n.entry_id, n])), [notes])
  const [noteFor, setNoteFor] = useState<string | null>(null)

  // Nota da equipe (1–5) por serviço (dia+turno) — alimenta o componente "equipe" do score.
  const teamQ = useQuery({
    queryKey: ['team_reviews', restaurant.id, range.start, range.end],
    queryFn: async () => {
      const { data, error } = await supabase.from('team_reviews').select('*')
        .eq('restaurant_id', restaurant.id).gte('date', range.start).lte('date', range.end)
      if (error) throw error
      return data as TeamReview[]
    },
  })
  const teamOf = useMemo(
    () => new Map((teamQ.data ?? []).map((t) => [`${t.date}|${t.shift_id}`, t])),
    [teamQ.data],
  )

  // Marcação otimista: o toque tem que responder na hora. Sem isto, cada clique
  // espera o servidor e refaz o fetch — além de lento, é o que embaralhava a lista.
  const entriesKey = ['entries', restaurant.id, range.start, range.end]
  const setStatus = useMutation({
    mutationFn: async (v: { id: string; status: 'convoked' | 'confirmed' | 'declined' }) => {
      const { error } = await supabase.from('schedule_entries')
        .update({ status: v.status, updated_by: profile.id }).eq('id', v.id)
      if (error) throw error
    },
    onMutate: async (v) => {
      await qc.cancelQueries({ queryKey: entriesKey })
      const prev = qc.getQueryData<ScheduleEntry[]>(entriesKey)
      qc.setQueryData<ScheduleEntry[]>(entriesKey, (old) =>
        old?.map((e) => (e.id === v.id ? { ...e, status: v.status } : e)))
      return { prev }
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(entriesKey, ctx.prev)
      setErr('Não foi possível salvar a presença.')
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['entries'] })
      qc.invalidateQueries({ queryKey: ['counts'] })
    },
  })

  const saveNote = useMutation({
    mutationFn: async (v: { entry_id: string; note: string; value: number | null }) => {
      if (!v.note && v.value == null) {
        const { error } = await supabase.from('entry_notes').delete().eq('entry_id', v.entry_id)
        if (error) throw error
        return
      }
      const { error } = await supabase.from('entry_notes').upsert({
        entry_id: v.entry_id, restaurant_id: restaurant.id,
        note: v.note, value: v.value, updated_by: profile.id,
      }, { onConflict: 'entry_id' })
      if (error) throw error
    },
    onSuccess: () => {
      setNoteFor(null)
      qc.invalidateQueries({ queryKey: ['entry_notes'] })
    },
    onError: () => setErr('Não foi possível salvar a anotação.'),
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
      qc.invalidateQueries({ queryKey: ['team_reviews'] })
      qc.invalidateQueries({ queryKey: ['scores'] })
      qc.invalidateQueries({ queryKey: ['week_report'] })
    },
    onError: () => setErr('Não foi possível salvar a nota da equipe.'),
  })

  if (shiftsQ.isLoading || peopleQ.isLoading || areasQ.isLoading || entriesQ.isLoading) return <Loading />
  if (shiftsQ.isError || peopleQ.isError || areasQ.isError || entriesQ.isError) {
    return (
      <div>
        <h1>Presença</h1>
        <ErrorMsg msg="Não foi possível carregar a semana. Recarregue a página." />
      </div>
    )
  }

  // Só dias já passados (incluindo hoje) e apenas escalas publicadas (não rascunho).
  const pastDates: string[] = []
  for (let d = range.start; d <= range.end; d = addDays(d, 1)) {
    if (d <= today) pastDates.push(d)
  }
  const nameOf = (e: ScheduleEntry) => personOf.get(e.person_id)?.display_name ?? ''
  const published = entries.filter((e) => e.status !== 'draft' && e.date <= today)
  const present = published.filter((e) => e.status === 'confirmed').length
  const absent = published.filter((e) => e.status === 'declined').length
  const pending = published.filter((e) => e.status === 'convoked').length
  const weekConsumo = notes.reduce((sum, n) => sum + (n.value ?? 0), 0)

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
        {weekConsumo > 0 && (
          <span className="badge" title="Soma dos valores anotados na semana">
            <PencilIcon size={12} /> {fmtBRL(weekConsumo)}
          </span>
        )}
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
              // Ordem fixa por nome: o banco devolve na ordem física das linhas, que muda
              // a cada UPDATE — sem este sort a lista se reordena a cada Foi/Faltou.
              const rows = dayEntries.filter((e) => e.shift_id === shift.id).sort((a, b) =>
                nameOf(a).localeCompare(nameOf(b)) || a.id.localeCompare(b.id))
              if (rows.length === 0) return null
              return (
                <div className="presenca-shift" key={shift.id}>
                  <div className="presenca-shift-head" style={{ borderLeft: `4px solid ${shift.color}` }}>
                    {shift.name} <span className="muted">{hhmm(shift.start_time)}–{hhmm(shift.end_time)}</span>
                    <span className="spacer" />
                    <span className="team-rate-label muted">Equipe</span>
                    <StarRating size={15}
                      value={teamOf.get(`${date}|${shift.id}`)?.score ?? null}
                      disabled={saveTeam.isPending}
                      label={`Nota da equipe — ${shift.name}, ${dayLabelPT(date)}`}
                      onChange={(v) => saveTeam.mutate({ date, shift_id: shift.id, score: v })} />
                  </div>
                  {rows.map((e) => {
                    const p = personOf.get(e.person_id)
                    const area = areaOf.get(e.area_id)
                    if (!p) return null
                    const note = noteOf.get(e.id)
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
                          {note && note.value != null && (
                            <span className="badge" title={note.note}>{fmtBRL(note.value)}</span>
                          )}
                        </span>
                        <div className="presenca-toggle">
                          <button
                            className={`pres-btn foi ${e.status === 'confirmed' ? 'active' : ''}`}
                            onClick={() => setTo('confirmed')}>
                            <CheckIcon size={14} /> Foi
                          </button>
                          <button
                            className={`pres-btn faltou ${e.status === 'declined' ? 'active' : ''}`}
                            onClick={() => setTo('declined')}>
                            <XIcon size={14} /> Faltou
                          </button>
                          <button
                            className={`pres-btn nota ${note ? 'active' : ''}`}
                            title="Anotações (consumo)"
                            aria-label={`Anotações de ${p.display_name}`}
                            onClick={() => setNoteFor(noteFor === e.id ? null : e.id)}>
                            <PencilIcon size={14} />
                          </button>
                        </div>
                        {noteFor === e.id && (
                          <NoteEditor
                            key={e.id}
                            note={note}
                            saving={saveNote.isPending}
                            onCancel={() => setNoteFor(null)}
                            onSave={(v) => saveNote.mutate({ entry_id: e.id, ...v })}
                          />
                        )}
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
        Use o lápis para anotar consumo (o valor em R$ é opcional e soma no relatório do mês).
        As estrelas dão a nota da equipe daquele serviço — ela entra no score de quem esteve presente.
      </p>
    </div>
  )
}

// Editor da anotação — monta já com o conteúdo salvo; salvar com tudo vazio apaga a nota.
function NoteEditor({ note, saving, onSave, onCancel }: {
  note: EntryNote | undefined
  saving: boolean
  onSave: (v: { note: string; value: number | null }) => void
  onCancel: () => void
}) {
  const [text, setText] = useState(note?.note ?? '')
  const [valor, setValor] = useState(note?.value != null ? String(note.value).replace('.', ',') : '')
  return (
    <div className="presenca-note">
      <textarea
        autoFocus
        placeholder="Consumo / observações — ex.: 1 coca, 1 água c/ gás"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div className="presenca-note-foot">
        <input
          inputMode="decimal"
          placeholder="Valor R$ (opcional)"
          value={valor}
          onChange={(e) => setValor(e.target.value)}
        />
        <div className="spacer" />
        <button className="btn small" onClick={onCancel}>Cancelar</button>
        <button
          className="btn small primary"
          disabled={saving}
          onClick={() => onSave({ note: text.trim(), value: parseValorBRL(valor) })}>
          {saving ? 'Salvando…' : 'Salvar'}
        </button>
      </div>
    </div>
  )
}
