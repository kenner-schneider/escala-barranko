import { FormEvent, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ErrorMsg } from '../../components/ui'
import { getFreeJwt, setFreeJwt } from '../../lib/freeAuth'
import { callFn } from '../../lib/supabase'
import { CalendarIcon } from '../../components/icons'

export function Entrar() {
  const navigate = useNavigate()
  const [phone, setPhone] = useState('')
  const [pin, setPin] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (getFreeJwt()) navigate('/disponibilidade', { replace: true })
  }, [navigate])

  async function submit(e: FormEvent) {
    e.preventDefault()
    setErr('')
    setBusy(true)
    try {
      const d = await callFn<{ jwt: string }>('free-login', { phone, pin })
      setFreeJwt(d.jwt)
      navigate('/disponibilidade')
    } catch (e2) {
      setErr((e2 as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-box card">
      <h1 style={{ display: 'flex', alignItems: 'center', gap: '.5rem' }}><CalendarIcon size={22} /> Minha escala</h1>
      <form onSubmit={submit}>
        <label className="field">Telefone (com DDD)
          <input inputMode="numeric" value={phone} placeholder="11999998888"
            onChange={(e) => setPhone(e.target.value)} required autoFocus />
        </label>
        <label className="field">PIN (6 números)
          <input type="password" inputMode="numeric" maxLength={6} value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} required />
        </label>
        {err && <ErrorMsg msg={err} />}
        <button className="btn primary" disabled={busy} style={{ width: '100%' }}>
          {busy ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
      <p className="muted" style={{ marginTop: '1rem' }}>
        Esqueceu o PIN? Peça um novo link de convite ao gerente.
      </p>
    </div>
  )
}
