import { ReactNode, useEffect, useState } from 'react'

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
          <button className="btn-icon" onClick={onClose} aria-label="Fechar">✕</button>
        </div>
        {children}
      </div>
    </div>
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
      {copied ? '✓ Copiado!' : label}
    </button>
  )
}
