import { FormEvent, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAdmin } from '../../components/AdminShell'
import { ErrorMsg, Loading } from '../../components/ui'
import { hhmm } from '../../lib/dates'
import { DEFAULT_TEMPLATE } from '../../lib/messages'
import { supabase } from '../../lib/supabase'
import type { Area, Criterion, Shift } from '../../lib/types'
import { CheckIcon } from '../../components/icons'

export function Config() {
  const { restaurant, reloadRestaurant } = useAdmin()
  const qc = useQueryClient()
  const [err, setErr] = useState('')

  // --- Settings ---
  const [lead, setLead] = useState(String(restaurant.settings.availability_lead_hours ?? 48))
  const [limit, setLimit] = useState(String(restaurant.settings.default_monthly_limit ?? 10))
  const [template, setTemplate] = useState(restaurant.settings.message_template ?? DEFAULT_TEMPLATE)
  const [teamWeight, setTeamWeight] = useState(String(restaurant.settings.review_team_weight ?? 20))
  const [windowWeeks, setWindowWeeks] = useState(String(restaurant.settings.ranking_window_weeks ?? 0))
  const [saved, setSaved] = useState(false)

  const saveSettings = useMutation({
    mutationFn: async () => {
      const settings = {
        ...restaurant.settings,
        availability_lead_hours: Math.max(0, parseInt(lead) || 48),
        default_monthly_limit: Math.max(1, parseInt(limit) || 10),
        message_template: template,
        review_team_weight: Math.min(100, Math.max(0, parseInt(teamWeight) || 0)),
        ranking_window_weeks: Math.max(0, parseInt(windowWeeks) || 0),
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

  // --- Critérios de avaliação ---
  const criteriaQ = useQuery({
    queryKey: ['criteria', restaurant.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('criteria').select('*')
        .eq('restaurant_id', restaurant.id).eq('active', true)
        .order('sort_order')
      if (error) throw error
      return data as Criterion[]
    },
  })

  const upsertCriterion = useMutation({
    mutationFn: async (c: Partial<Criterion>) => {
      const { error } = c.id
        ? await supabase.from('criteria').update(c).eq('id', c.id)
        : await supabase.from('criteria').insert({
            ...c, restaurant_id: restaurant.id, sort_order: criteriaQ.data?.length ?? 0,
          })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['criteria'] }),
    onError: () => setErr('Não foi possível salvar o critério.'),
  })

  const [editingCrit, setEditingCrit] = useState<Partial<Criterion> | null>(null)

  function submitCriterion(e: FormEvent) {
    e.preventDefault()
    if (!editingCrit?.name || !editingCrit.weight || editingCrit.weight <= 0) return
    upsertCriterion.mutate(editingCrit)
    setEditingCrit(null)
  }

  if (shiftsQ.isLoading || areasQ.isLoading || criteriaQ.isLoading) return <Loading />

  const shifts = shiftsQ.data ?? []
  const areas = areasQ.data ?? []
  const criteria = criteriaQ.data ?? []

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
                <td>
                  <span className="chip" style={{ borderColor: s.color }}>{s.name}</span>
                  {s.label && (
                    <span className="badge" style={{ marginLeft: '.4rem', borderColor: s.color }}>{s.label}</span>
                  )}
                </td>
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
            onClick={() => setEditing({ name: '', start_time: '', end_time: '', color: '#3b82f6', label: '' })}>
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
              <label className="field">Ícone (até 3)
                <input value={editing.label ?? ''} placeholder="Ex.: M11"
                  onChange={(e) => setEditing({
                    ...editing,
                    label: e.target.value.replace(/[^a-zA-Z0-9]/g, '').slice(0, 3).toUpperCase(),
                  })} />
              </label>
            </div>
            <p className="muted" style={{ marginTop: 0 }}>
              O ícone aparece nos quadradinhos da escala. Até 3 letras/números (sem símbolos).
              Vazio = usa a inicial do nome.
            </p>
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
        <h2>Avaliação e ranking</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          Critérios objetivos usados na avaliação individual semanal (notas 1–5). O peso
          define quanto cada critério conta na média. O ranking ordena quem tem as melhores notas.
        </p>
        <p className="muted" style={{ marginTop: '-.35rem' }}>
          As notas de cada pessoa são dadas em <strong>Relatórios → Semanal</strong>;
          a nota da equipe, na <strong>Presença</strong> (estrelas ao lado de cada turno).
        </p>
        {criteria.length === 0 && (
          <div className="empty">Nenhum critério. Cadastre para habilitar avaliações e ranking (ex.: Pontualidade, Agilidade).</div>
        )}
        {criteria.length > 0 && (
          <table className="simple">
            <tbody>
              {criteria.map((c) => (
                <tr key={c.id}>
                  <td><span className="chip">{c.name}</span></td>
                  <td>peso <strong>{c.weight}</strong></td>
                  <td style={{ textAlign: 'right' }}>
                    <button className="btn small" onClick={() => setEditingCrit(c)}>Editar</button>{' '}
                    <button
                      className="btn small danger"
                      onClick={() => {
                        if (confirm(`Desativar o critério "${c.name}"? Ele deixa de contar nas avaliações; o histórico é preservado.`)) {
                          upsertCriterion.mutate({ id: c.id, active: false })
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
        )}
        {!editingCrit && (
          <button className="btn" style={{ marginTop: '.6rem' }}
            onClick={() => setEditingCrit({ name: '', weight: 1 })}>
            + Novo critério
          </button>
        )}
        {editingCrit && (
          <form onSubmit={submitCriterion} style={{ marginTop: '.75rem' }}>
            <div className="form-row">
              <label className="field">Nome
                <input value={editingCrit.name ?? ''} required autoFocus placeholder="Ex.: Pontualidade"
                  onChange={(e) => setEditingCrit({ ...editingCrit, name: e.target.value })} />
              </label>
              <label className="field">Peso
                <input type="number" min={0.5} max={10} step={0.5} value={editingCrit.weight ?? 1} required
                  onChange={(e) => setEditingCrit({ ...editingCrit, weight: Number(e.target.value) })} />
              </label>
            </div>
            <button className="btn primary">{editingCrit.id ? 'Salvar critério' : 'Criar critério'}</button>{' '}
            <button type="button" className="btn" onClick={() => setEditingCrit(null)}>Cancelar</button>
          </form>
        )}
        <div className="form-row" style={{ marginTop: '.9rem' }}>
          <label className="field">Peso da nota da equipe no score (%)
            <input type="number" min={0} max={100} value={teamWeight}
              onChange={(e) => setTeamWeight(e.target.value)} />
          </label>
          <label className="field">Janela oficial do ranking
            <select value={windowWeeks} onChange={(e) => setWindowWeeks(e.target.value)}>
              <option value="0">Todo o período</option>
              <option value="4">Últimas 4 semanas</option>
              <option value="8">Últimas 8 semanas</option>
              <option value="12">Últimas 12 semanas</option>
            </select>
          </label>
        </div>
        <p className="muted">
          Score = {100 - Math.min(100, Math.max(0, parseInt(teamWeight) || 0))}% avaliação individual
          + {Math.min(100, Math.max(0, parseInt(teamWeight) || 0))}% nota da equipe dos serviços em que a
          pessoa esteve presente. A janela oficial é a usada na ordenação por ranking da Escala;
          na aba Ranking dá para visualizar outros recortes.
        </p>
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
        {saved ? <><CheckIcon size={16} /> Salvo!</> : 'Salvar configurações'}
      </button>
    </div>
  )
}
