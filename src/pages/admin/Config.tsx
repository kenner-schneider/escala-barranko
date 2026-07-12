import { FormEvent, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAdmin } from '../../components/AdminShell'
import { ErrorMsg, Loading } from '../../components/ui'
import { hhmm } from '../../lib/dates'
import { DEFAULT_TEMPLATE } from '../../lib/messages'
import { supabase } from '../../lib/supabase'
import type { Area, Shift } from '../../lib/types'

export function Config() {
  const { restaurant, reloadRestaurant } = useAdmin()
  const qc = useQueryClient()
  const [err, setErr] = useState('')

  // --- Settings ---
  const [lead, setLead] = useState(String(restaurant.settings.availability_lead_hours ?? 48))
  const [limit, setLimit] = useState(String(restaurant.settings.default_monthly_limit ?? 10))
  const [template, setTemplate] = useState(restaurant.settings.message_template ?? DEFAULT_TEMPLATE)
  const [saved, setSaved] = useState(false)

  const saveSettings = useMutation({
    mutationFn: async () => {
      const settings = {
        ...restaurant.settings,
        availability_lead_hours: Math.max(0, parseInt(lead) || 48),
        default_monthly_limit: Math.max(1, parseInt(limit) || 10),
        message_template: template,
      }
      const { error } = await supabase.from('restaurants').update({ settings }).eq('id', restaurant.id)
      if (error) throw error
    },
    onSuccess: async () => {
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
      await reloadRestaurant()
    },
    onError: () => setErr('Não foi possível salvar as configurações.'),
  })

  // --- Turnos ---
  const shiftsQ = useQuery({
    queryKey: ['shifts', restaurant.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shifts').select('*')
        .eq('restaurant_id', restaurant.id).eq('active', true)
        .order('start_time')
      if (error) throw error
      return data as Shift[]
    },
  })

  const upsertShift = useMutation({
    mutationFn: async (s: Partial<Shift>) => {
      const { error } = s.id
        ? await supabase.from('shifts').update(s).eq('id', s.id)
        : await supabase.from('shifts').insert({ ...s, restaurant_id: restaurant.id })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shifts'] }),
    onError: () => setErr('Não foi possível salvar o turno.'),
  })

  const [editing, setEditing] = useState<Partial<Shift> | null>(null)

  function submitShift(e: FormEvent) {
    e.preventDefault()
    if (!editing?.name || !editing.start_time || !editing.end_time) return
    upsertShift.mutate(editing)
    setEditing(null)
  }

  // --- Escalas (setores) ---
  const areasQ = useQuery({
    queryKey: ['areas', restaurant.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('areas').select('*')
        .eq('restaurant_id', restaurant.id).eq('active', true)
        .order('sort_order')
      if (error) throw error
      return data as Area[]
    },
  })

  const upsertArea = useMutation({
    mutationFn: async (a: Partial<Area>) => {
      const { error } = a.id
        ? await supabase.from('areas').update(a).eq('id', a.id)
        : await supabase.from('areas').insert({
            ...a, restaurant_id: restaurant.id, sort_order: areasQ.data?.length ?? 0,
          })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['areas'] }),
    onError: () => setErr('Não foi possível salvar a escala.'),
  })

  const [editingArea, setEditingArea] = useState<Partial<Area> | null>(null)

  function submitArea(e: FormEvent) {
    e.preventDefault()
    if (!editingArea?.name) return
    upsertArea.mutate(editingArea)
    setEditingArea(null)
  }

  if (shiftsQ.isLoading || areasQ.isLoading) return <Loading />

  const shifts = shiftsQ.data ?? []
  const areas = areasQ.data ?? []

  return (
    <div>
      <h1>Configurações</h1>
      {err && <ErrorMsg msg={err} />}

      <div className="card">
        <h2>Turnos</h2>
        {shifts.length === 0 && <div className="empty">Nenhum turno. Cadastre pelo menos 1 para montar a escala.</div>}
        <table className="simple">
          <tbody>
            {shifts.map((s) => (
              <tr key={s.id}>
                <td><span className="chip" style={{ borderColor: s.color }}>{s.name}</span></td>
                <td>{hhmm(s.start_time)}–{hhmm(s.end_time)}</td>
                <td style={{ textAlign: 'right' }}>
                  <button className="btn small" onClick={() => setEditing(s)}>Editar</button>{' '}
                  <button
                    className="btn small danger"
                    onClick={() => {
                      if (shifts.length <= 1) return setErr('É preciso manter pelo menos 1 turno ativo.')
                      if (confirm(`Desativar o turno "${s.name}"? Ele some das novas escalas; o histórico é preservado.`)) {
                        upsertShift.mutate({ id: s.id, active: false })
                      }
                    }}
                  >
                    Desativar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!editing && (
          <button className="btn" style={{ marginTop: '.6rem' }}
            onClick={() => setEditing({ name: '', start_time: '', end_time: '', color: '#3b82f6' })}>
            + Novo turno
          </button>
        )}
        {editing && (
          <form onSubmit={submitShift} style={{ marginTop: '.75rem' }}>
            <div className="form-row">
              <label className="field">Nome
                <input value={editing.name ?? ''} required
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
              </label>
              <label className="field">Início
                <input type="time" value={editing.start_time ?? ''} required
                  onChange={(e) => setEditing({ ...editing, start_time: e.target.value })} />
              </label>
              <label className="field">Fim
                <input type="time" value={editing.end_time ?? ''} required
                  onChange={(e) => setEditing({ ...editing, end_time: e.target.value })} />
              </label>
              <label className="field">Cor
                <input type="color" value={editing.color ?? '#3b82f6'}
                  onChange={(e) => setEditing({ ...editing, color: e.target.value })} />
              </label>
            </div>
            <button className="btn primary">{editing.id ? 'Salvar turno' : 'Criar turno'}</button>{' '}
            <button type="button" className="btn" onClick={() => setEditing(null)}>Cancelar</button>
          </form>
        )}
      </div>

      <div className="card">
        <h2>Escalas</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          Tipos de escala do restaurante — ex.: Salão, Cozinha, Bar. No menu Escala você escolhe
          qual está montando; cada pessoa fica em uma escala por dia + turno.
        </p>
        {areas.length === 0 && <div className="empty">Nenhuma escala. Cadastre ao menos 1 para montar a escala.</div>}
        <table className="simple">
          <tbody>
            {areas.map((a) => (
              <tr key={a.id}>
                <td><span className="chip" style={{ borderColor: a.color }}>{a.name}</span></td>
                <td style={{ textAlign: 'right' }}>
                  <button className="btn small" onClick={() => setEditingArea(a)}>Editar</button>{' '}
                  <button
                    className="btn small danger"
                    onClick={() => {
                      if (areas.length <= 1) return setErr('É preciso manter pelo menos 1 escala ativa.')
                      if (confirm(`Desativar a escala "${a.name}"? Ela some das novas montagens; o histórico é preservado.`)) {
                        upsertArea.mutate({ id: a.id, active: false })
                      }
                    }}
                  >
                    Desativar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!editingArea && (
          <button className="btn" style={{ marginTop: '.6rem' }}
            onClick={() => setEditingArea({ name: '', color: '#6366f1' })}>
            + Nova escala
          </button>
        )}
        {editingArea && (
          <form onSubmit={submitArea} style={{ marginTop: '.75rem' }}>
            <div className="form-row">
              <label className="field">Nome
                <input value={editingArea.name ?? ''} required autoFocus
                  placeholder="Ex.: Bar"
                  onChange={(e) => setEditingArea({ ...editingArea, name: e.target.value })} />
              </label>
              <label className="field">Cor
                <input type="color" value={editingArea.color ?? '#6366f1'}
                  onChange={(e) => setEditingArea({ ...editingArea, color: e.target.value })} />
              </label>
            </div>
            <button className="btn primary">{editingArea.id ? 'Salvar escala' : 'Criar escala'}</button>{' '}
            <button type="button" className="btn" onClick={() => setEditingArea(null)}>Cancelar</button>
          </form>
        )}
      </div>

      <div className="card">
        <h2>Regras</h2>
        <div className="form-row">
          <label className="field">Antecedência p/ disponibilidade (horas)
            <input type="number" min={0} value={lead} onChange={(e) => setLead(e.target.value)} />
          </label>
          <label className="field">Limite mensal padrão (dias por FREE)
            <input type="number" min={1} value={limit} onChange={(e) => setLimit(e.target.value)} />
          </label>
        </div>
        <p className="muted">O limite gera apenas alerta visual — nunca bloqueia. Alerta gerencial, não é parecer trabalhista.</p>
      </div>

      <div className="card">
        <h2>Template da mensagem do grupo</h2>
        <label className="field">
          Use os marcadores {'{dia}'}, {'{turno}'}, {'{horario}'} e {'{lista}'}
          <textarea value={template} onChange={(e) => setTemplate(e.target.value)} />
        </label>
        <p className="muted">A mensagem usa somente o nome de exibição — nunca telefone ou nome completo.</p>
      </div>

      <button className="btn primary" onClick={() => saveSettings.mutate()} disabled={saveSettings.isPending}>
        {saved ? '✓ Salvo!' : 'Salvar configurações'}
      </button>
    </div>
  )
}
