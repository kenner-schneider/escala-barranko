import { FormEvent, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { ErrorMsg } from '../../components/ui'
import { ClipboardIcon } from '../../components/icons'

export function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate('/escala', { replace: true })
    })
  }, [navigate])

  async function submit(e: FormEvent) {
    e.preventDefault()
    setErr('')
    setBusy(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setBusy(false)
    if (error) return setErr('E-mail ou senha incorretos.')
    navigate('/escala')
  }

  return (
    <div className="auth-box card">
      <h1 style={{ display: 'flex', alignItems: 'center', gap: '.5rem' }}><ClipboardIcon size={22} /> Escala — Gerente</h1>
      <form onSubmit={submit}>
        <label className="field">
          E-mail
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
        </label>
        <label className="field">
          Senha
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        {err && <ErrorMsg msg={err} />}
        <button className="btn primary" disabled={busy} style={{ width: '100%' }}>
          {busy ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
      <p className="muted" style={{ marginTop: '1rem' }}>
        É freelancer? <Link to="/entrar">Entre aqui com telefone e PIN</Link>.
      </p>
    </div>
  )
}
