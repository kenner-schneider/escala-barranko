import { FormEvent, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ErrorMsg, Loading } from '../../components/ui'
import { setFreeJwt } from '../../lib/freeAuth'
import { callFn } from '../../lib/supabase'

export function Convite() {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const [state, setState] = useState<'checking' | 'invalid' | 'form'>('checking')
  const [name, setName] = useState('')
  const [pin, setPin] = useState('')
  const [pin2, setPin2] = useState('')
  const [accepted, setAccepted] = useState(false)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!token) return setState('invalid')
    callFn<{ full_name: string }>('free-set-pin', { token })
      .then((d) => { setName(d.full_name); setState('form') })
      .catch((e) => { setErr(e.message); setState('invalid') })
  }, [token])

  async function submit(e: FormEvent) {
    e.preventDefault()
    setErr('')
    if (!/^\d{6}$/.test(pin)) return setErr('O PIN deve ter exatamente 6 números.')
    if (pin !== pin2) return setErr('Os PINs não conferem.')
    if (!accepted) return setErr('É preciso aceitar o termo para continuar.')
    setBusy(true)
    try {
      const d = await callFn<{ jwt: string }>('free-set-pin', { token, pin })
      setFreeJwt(d.jwt)
      navigate('/disponibilidade')
    } catch (e2) {
      setErr((e2 as Error).message)
    } finally {
      setBusy(false)
    }
  }

  if (state === 'checking') return <Loading label="Validando convite…" />
  if (state === 'invalid') {
    return (
      <div className="auth-box card">
        <h1>Convite inválido</h1>
        <ErrorMsg msg={err || 'Este link expirou ou já foi usado. Peça um novo ao gerente.'} />
      </div>
    )
  }

  return (
    <div className="auth-box card">
      <h1>Bem-vindo(a)!</h1>
      <p>Confira se é você: <strong>{name}</strong></p>
      <p className="muted">Se o nome acima não for o seu, não continue — avise o gerente.</p>
      <form onSubmit={submit}>
        <label className="field">Crie um PIN de 6 números
          <input type="password" inputMode="numeric" maxLength={6} value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} required />
        </label>
        <label className="field">Repita o PIN
          <input type="password" inputMode="numeric" maxLength={6} value={pin2}
            onChange={(e) => setPin2(e.target.value.replace(/\D/g, ''))} required />
        </label>
        <label style={{ display: 'flex', gap: '.5rem', alignItems: 'flex-start', fontSize: '.85rem', marginBottom: '.75rem' }}>
          <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} />
          <span>
            Aceito que meu nome e telefone sejam usados apenas para organizar a escala
            de trabalho deste restaurante. Posso pedir a exclusão dos meus dados a qualquer momento.
          </span>
        </label>
        {err && <ErrorMsg msg={err} />}
        <button className="btn primary" disabled={busy} style={{ width: '100%' }}>
          {busy ? 'Criando…' : 'Criar PIN e entrar'}
        </button>
      </form>
    </div>
  )
}
