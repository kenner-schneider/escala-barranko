import { FormEvent, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAdmin } from '../../components/AdminShell'
import { CopyButton, Empty, ErrorMsg, Loading, Modal } from '../../components/ui'
import { FIXED_KEYS, WEEKDAYS_PT, monthOf, todaySP } from '../../lib/dates'
import { adminToken, callFn, supabase } from '../../lib/supabase'
import type { MonthlyCount, Person, Shift } from '../../lib/types'
import { PhoneIcon, UserIcon } from '../../components/icons'

const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0] // seg..dom

export function Pessoas() {
  const { restaurant } = useAdmin()
  const qc = useQueryClient()
  const [tab, setTab] = useState<'clt' | 'free'>('free')
  const [err, setErr] = useState('')
  const [editing, setEditing] = useState<Partial<Person> | null>(null)
  const [inviteLink, setInviteLink] = useState<string | null>(null)
  const month = monthOf(todaySP())

  const [showInactive, setShowInactive] = useState(false)
  const peopleQ = useQuery({
    queryKey: ['people-all', restaurant.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('people').select('*')
        .eq('restaurant_id', restaurant.id)
        .order('display_name')
      if (error) throw error
      return data as Person[]
    },
  })

  const shiftsQ = useQuery({
    queryKey: ['shifts', restaurant.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shifts').select('*')
        .eq('restaurant_id', restaurant.id).eq('active', true).order('start_time')
      if (error) throw error
      return data as Shift[]
    },
  })

  const countsQ = useQuery({
    queryKey: ['counts', restaurant.id, month],
    queryFn: async () => {
      const { data, error } = await supabase.from('monthly_counts').select('*').eq('month', month)
      if (error) throw error
      return data as MonthlyCount[]
    },
  })

  const savePerson = useMutation({
    mutationFn: async (p: Partial<Person>) => {
      const row = { ...p, restaurant_id: restaurant.id, phone: p.phone ? p.phone.replace(/\D/g, '') : null }
      if (row.type === 'free' && !row.phone) throw new Error('Telefone é obrigatório para FREE.')
      const { error } = p.id
        ? await supabase.from('people').update(row).eq('id', p.id)
        : await supabase.from('people').insert(row)
      if (error) {
        if (error.code === '23505') throw new Error('Já existe um FREE ativo com esse telefone.')
        throw new Error('Não foi possível salvar.')
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['people-all'] })
      qc.invalidateQueries({ queryKey: ['people'] })
      setEditing(null)
      setErr('')
    },
    onError: (e: Error) => setErr(e.message),
  })

  const deactivate = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('people').update({ active: false }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['people-all'] })
      qc.invalidateQueries({ queryKey: ['people'] })
    },
    onError: () => setErr('Não foi possível desativar.'),
  })

  const reactivate = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('people').update({ active: true }).eq('id', id)
      if (error) {
        if (error.code === '23505') throw new Error('Já existe um FREE ativo com esse telefone — edite o telefone antes de reativar.')
        throw new Error('Não foi possível reativar.')
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['people-all'] }); setErr('') },
    onError: (e: Error) => setErr(e.message),
  })

  const anonymize = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('anonymize_person', { pid: id })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['people-all'] })
      qc.invalidateQueries({ queryKey: ['people'] })
    },
    onError: () => setErr('Não foi possível anonimizar.'),
  })

  const invite = useMutation({
    mutationFn: async (personId: string) => {
      const token = await adminToken()
      return await callFn<{ token: string }>('create-invite', { person_id: personId }, token)
    },
    onSuccess: (data) => {
      setInviteLink(`${location.origin}${location.pathname}#/convite/${data.token}`)
    },
    onError: (e: Error) => setErr(e.message),
  })

  if (peopleQ.isLoading || shiftsQ.isLoading) return <Loading />

  const people = (peopleQ.data ?? []).filter((p) => p.type === tab && p.active)
  const inactive = (peopleQ.data ?? []).filter((p) => p.type === tab && !p.active)
  const counts = countsQ.data ?? []
  const countOf = (id: string) => counts.find((c) => c.person_id === id)?.days_worked ?? 0
  const limitOf = (p: Person) => p.monthly_limit ?? restaurant.settings.default_monthly_limit

  return (
    <div>
      <h1>Pessoas</h1>
      {err && <ErrorMsg msg={err} />}
      <div className="tabs">
        <button className={tab === 'free' ? 'active' : ''} onClick={() => setTab('free')}>Freelancers (FREE)</button>
        <button className={tab === 'clt' ? 'active' : ''} onClick={() => setTab('clt')}>Fixos (CLT)</button>
      </div>

      <button className="btn primary" style={{ marginBottom: '.9rem' }}
        onClick={() => setEditing({ type: tab, icon: '⭐' })}>
        + {tab === 'free' ? 'Novo FREE' : 'Novo CLT'}
      </button>

      {people.length === 0 && <Empty msg={`Nenhum ${tab.toUpperCase()} cadastrado ainda.`} />}

      <div className="people-grid">
        {people.map((p) => {
          const worked = countOf(p.id)
          const over = p.type === 'free' && worked >= limitOf(p)
          return (
            <div className="card person-card" key={p.id}>
              <div className="head">
                <span className="icon">{p.icon ?? <UserIcon size={20} />}</span>
                <div>
                  <strong>{p.display_name}</strong>
                  <div className="muted">{p.full_name}</div>
                </div>
              </div>
              {p.type === 'free' && (
                <div>
                  <span className={`badge ${over ? 'over' : ''}`}
                    title="Alerta gerencial — não é parecer trabalhista">
                    {worked}/{limitOf(p)} dias no mês
                  </span>{' '}
                  <span className="muted" style={{ display: 'inline-flex', alignItems: 'center', gap: '.25rem' }}><PhoneIcon size={13} /> {p.phone}</span>
                </div>
              )}
              {p.type === 'clt' && (
                <div className="badge">{worked} dias escalados no mês</div>
              )}
              <div className="actions">
                <button className="btn small" onClick={() => setEditing(p)}>Editar</button>
                {p.type === 'free' && (
                  <button className="btn small" disabled={invite.isPending}
                    onClick={() => invite.mutate(p.id)}>
                    Gerar convite
                  </button>
                )}
                <button className="btn small danger" onClick={() => {
                  if (confirm(`Desativar ${p.display_name}? O histórico de escalas é preservado.`)) {
                    deactivate.mutate(p.id)
                  }
                }}>Desativar</button>
                <button className="btn small danger"
                  title="Exclusão de dados (LGPD): anonimiza nome e telefone de forma irreversível"
                  onClick={() => {
                    if (confirm(`Exclusão LGPD de ${p.display_name}: anonimiza nome e telefone de forma IRREVERSÍVEL, mantendo apenas contagens. Continuar?`)) {
                      anonymize.mutate(p.id)
                    }
                  }}>LGPD</button>
              </div>
            </div>
          )
        })}
      </div>

      {inactive.length > 0 && (
        <p style={{ marginTop: '1rem' }}>
          <button className="btn-link" onClick={() => setShowInactive(!showInactive)}>
            {showInactive ? 'Ocultar desativados' : `Mostrar desativados (${inactive.length})`}
          </button>
        </p>
      )}
      {showInactive && inactive.length > 0 && (
        <div className="people-grid">
          {inactive.map((p) => (
            <div className="card person-card inactive" key={p.id}>
              <div className="head">
                <span className="icon">{p.icon ?? <UserIcon size={20} />}</span>
                <div>
                  <strong>{p.display_name}</strong>
                  <div className="muted">{p.full_name}</div>
                </div>
              </div>
              <div className="actions">
                <button className="btn small" disabled={reactivate.isPending}
                  onClick={() => reactivate.mutate(p.id)}>
                  Reativar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <PersonForm person={editing} shifts={shiftsQ.data ?? []}
          onSave={(p) => savePerson.mutate(p)} onClose={() => setEditing(null)} />
      )}

      {inviteLink && (
        <Modal title="Convite gerado" onClose={() => setInviteLink(null)}>
          <p>Envie este link <strong>individualmente</strong> pelo WhatsApp da pessoa. Ele expira em 48h e só pode ser usado uma vez. <strong>Nunca envie no grupo.</strong></p>
          <pre className="message">{inviteLink}</pre>
          <CopyButton text={inviteLink} label="Copiar link" />
        </Modal>
      )}
    </div>
  )
}

function PersonForm({ person, shifts, onSave, onClose }: {
  person: Partial<Person>
  shifts: Shift[]
  onSave: (p: Partial<Person>) => void
  onClose: () => void
}) {
  const [form, setForm] = useState<Partial<Person>>({ ...person })
  const isFree = form.type === 'free'
  const fixed = (form.fixed_days ?? {}) as Record<string, string[]>

  function toggleFixed(dayKey: string, shiftId: string) {
    const cur = fixed[dayKey] ?? []
    const next = cur.includes(shiftId) ? cur.filter((s) => s !== shiftId) : [...cur, shiftId]
    setForm({ ...form, fixed_days: { ...fixed, [dayKey]: next } })
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    onSave(form)
  }

  return (
    <Modal title={person.id ? 'Editar pessoa' : (isFree ? 'Novo FREE' : 'Novo CLT')} onClose={onClose}>
      <form onSubmit={submit}>
        <div className="form-row">
          <label className="field">Nome completo
            <input value={form.full_name ?? ''} required
              onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
          </label>
          <label className="field">Nome de exibição
            <input value={form.display_name ?? ''} required
              onChange={(e) => setForm({ ...form, display_name: e.target.value })} />
          </label>
        </div>
        <div className="form-row">
          <label className="field">Ícone (emoji)
            <input value={form.icon ?? ''} maxLength={4}
              onChange={(e) => setForm({ ...form, icon: e.target.value })} />
          </label>
          {isFree && (
            <>
              <label className="field">Telefone (WhatsApp)
                <input value={form.phone ?? ''} required placeholder="5511999998888"
                  onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </label>
              <label className="field">Limite mensal (vazio = padrão)
                <input type="number" min={1} value={form.monthly_limit ?? ''}
                  onChange={(e) => setForm({ ...form, monthly_limit: e.target.value ? parseInt(e.target.value) : null })} />
              </label>
            </>
          )}
        </div>
        {!isFree && shifts.length > 0 && (
          <div style={{ marginBottom: '.75rem' }}>
            <strong style={{ fontSize: '.85rem' }}>Dias fixos (pré-preenchem a escala)</strong>
            <table className="simple">
              <thead>
                <tr><th></th>{shifts.map((s) => <th key={s.id}>{s.name}</th>)}</tr>
              </thead>
              <tbody>
                {WEEK_ORDER.map((dow) => (
                  <tr key={dow}>
                    <td>{WEEKDAYS_PT[dow]}</td>
                    {shifts.map((s) => (
                      <td key={s.id}>
                        <input type="checkbox"
                          checked={(fixed[FIXED_KEYS[dow]] ?? []).includes(s.id)}
                          onChange={() => toggleFixed(FIXED_KEYS[dow], s.id)} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <button className="btn primary">Salvar</button>{' '}
        <button type="button" className="btn" onClick={onClose}>Cancelar</button>
      </form>
    </Modal>
  )
}
