import { FormEvent, useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Empty, ErrorMsg, Loading, Modal } from '../../components/ui'
import { adminToken, callFn, supabase } from '../../lib/supabase'

interface Tenant {
  id: string
  name: string
  slug: string
  status: 'active' | 'suspended'
  created_at: string
  people_count: number
}

export function RootPage() {
  const navigate = useNavigate()
  const [state, setState] = useState<'loading' | 'ready'>('loading')
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [err, setErr] = useState('')
  const [creating, setCreating] = useState(false)
  const [created, setCreated] = useState<{ admin_email: string; temp_password: string } | null>(null)
  const [form, setForm] = useState({ name: '', slug: '', admin_email: '', admin_name: '' })
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return navigate('/login')
    const { data: prof } = await supabase.from('profiles').select('role').eq('id', session.user.id).maybeSingle()
    if (prof?.role !== 'root') return navigate('/login')
    try {
      const list = await callFn<Tenant[]>('create-tenant', { action: 'list' }, session.access_token)
      setTenants(list)
      setState('ready')
    } catch (e) {
      setErr((e as Error).message)
      setState('ready')
    }
  }, [navigate])

  useEffect(() => { load() }, [load])

  async function submit(e: FormEvent) {
    e.preventDefault()
    setErr('')
    setBusy(true)
    try {
      const token = await adminToken()
      const res = await callFn<{ admin_email: string; temp_password: string }>(
        'create-tenant', { action: 'create', ...form }, token)
      setCreated(res)
      setCreating(false)
      setForm({ name: '', slug: '', admin_email: '', admin_name: '' })
      await load()
    } catch (e2) {
      setErr((e2 as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function setStatus(t: Tenant, status: 'active' | 'suspended') {
    if (!confirm(`${status === 'suspended' ? 'Suspender' : 'Reativar'} o restaurante "${t.name}"?`)) return
    setErr('')
    try {
      const token = await adminToken()
      await callFn('create-tenant', { action: 'set_status', restaurant_id: t.id, status }, token)
      await load()
    } catch (e) {
      setErr((e as Error).message)
    }
  }

  if (state === 'loading') return <Loading />

  return (
    <div className="page">
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <h1 style={{ flex: 1 }}>Plataforma — Tenants</h1>
        <button className="btn-link" onClick={async () => { await supabase.auth.signOut(); navigate('/login') }}>
          Sair
        </button>
      </div>
      {err && <ErrorMsg msg={err} />}

      <button className="btn primary" style={{ marginBottom: '1rem' }} onClick={() => setCreating(true)}>
        + Novo restaurante
      </button>

      {tenants.length === 0 && <Empty msg="Nenhum tenant ainda." />}
      {tenants.length > 0 && (
        <div className="card">
          <table className="simple">
            <thead>
              <tr><th>Nome</th><th>Slug</th><th>Status</th><th>Pessoas</th><th></th></tr>
            </thead>
            <tbody>
              {tenants.map((t) => (
                <tr key={t.id}>
                  <td>{t.name}</td>
                  <td>{t.slug}</td>
                  <td>
                    <span className={`badge ${t.status === 'suspended' ? 'over' : ''}`}>
                      {t.status === 'active' ? 'ativo' : 'suspenso'}
                    </span>
                  </td>
                  <td>{t.people_count}</td>
                  <td style={{ textAlign: 'right' }}>
                    {t.status === 'active'
                      ? <button className="btn small danger" onClick={() => setStatus(t, 'suspended')}>Suspender</button>
                      : <button className="btn small" onClick={() => setStatus(t, 'active')}>Reativar</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {creating && (
        <Modal title="Novo restaurante" onClose={() => setCreating(false)}>
          <form onSubmit={submit}>
            <label className="field">Nome
              <input value={form.name} required onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </label>
            <label className="field">Slug (letras minúsculas e hífens)
              <input value={form.slug} required pattern="[a-z0-9-]{2,40}"
                onChange={(e) => setForm({ ...form, slug: e.target.value })} />
            </label>
            <label className="field">E-mail do Admin
              <input type="email" value={form.admin_email} required
                onChange={(e) => setForm({ ...form, admin_email: e.target.value })} />
            </label>
            <label className="field">Nome do Admin
              <input value={form.admin_name} required
                onChange={(e) => setForm({ ...form, admin_name: e.target.value })} />
            </label>
            <button className="btn primary" disabled={busy}>{busy ? 'Criando…' : 'Criar'}</button>
          </form>
        </Modal>
      )}

      {created && (
        <Modal title="Restaurante criado" onClose={() => setCreated(null)}>
          <p>Envie a credencial provisória ao Admin com segurança (ela não será exibida de novo):</p>
          <pre className="message">{created.admin_email}{'\n'}Senha provisória: {created.temp_password}</pre>
        </Modal>
      )}
    </div>
  )
}
