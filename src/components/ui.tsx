import { ReactNode, useEffect, useState } from 'react'
import { CheckIcon, StarIcon, XIcon } from './icons'

export const Spinner = () => <div className="spinner" role="status" aria-label="Carregando" />

export const Loading = ({ label = 'Carregando…' }: { label?: string }) => (
  <div className="center-box"><Spinner /><p className="muted">{label}</p></div>
)

export const ErrorMsg = ({ msg }: { msg: string }) => <div className="alert error">{msg}</div>

export const Empty = ({ msg }: { msg: string }) => <div className="empty">{msg}</div>

export function Modal({ title, onClose, children }: {
  title: string
  onClose: () => void
  children: ReactNode
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="btn-icon" onClick={onClose} aria-label="Fechar"><XIcon size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

// Nota 1–5 em estrelas. Clicar na nota atual limpa (volta a "sem nota").
export function StarRating({ value, onChange, size = 16, disabled, label }: {
  value: number | null
  onChange: (v: number | null) => void
  size?: number
  disabled?: boolean
  label?: string
}) {
  return (
    <span className="star-rate" role="group" aria-label={label ?? 'Nota de 1 a 5'}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button"
          className={`star-btn ${value != null && n <= value ? 'on' : ''}`}
          disabled={disabled}
          aria-label={`${n} de 5`}
          aria-pressed={value === n}
          title={value === n ? `${n}/5 — clique para limpar` : `${n}/5`}
          onClick={() => onChange(value === n ? null : n)}>
          <StarIcon size={size} filled={value != null && n <= value} />
        </button>
      ))}
    </span>
  )
}

export function CopyButton({ text, label = 'Copiar' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      className="btn primary"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text)
        } catch {
          // fallback para contextos sem clipboard API
          const ta = document.createElement('textarea')
          ta.value = text
          document.body.appendChild(ta)
          ta.select()
          document.execCommand('copy')
          ta.remove()
        }
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }}
    >
      {copied ? <><CheckIcon size={16} /> Copiado!</> : label}
    </button>
  )
}
