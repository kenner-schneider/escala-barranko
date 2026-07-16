// Helpers de formatação compartilhados entre as páginas.
import type { Shift } from './types'

// Sigla do turno: rótulo curto do Config (até 3 chars, ex. "M11") ou inicial do nome.
// Mesma regra em Escala, Pessoas (dias fixos) e Relatórios.
export const shiftAbbr = (s: Pick<Shift, 'name' | 'label'>) =>
  ((s.label ?? '').trim() || s.name.charAt(0)).toUpperCase().slice(0, 3)

export const fmtBRL = (n: number) =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

// Aceita "12,50" e "12.50"; vazio/inválido/negativo → null.
export function parseValorBRL(raw: string): number | null {
  const t = raw.trim()
  if (!t) return null
  const n = Number(t.replace(',', '.'))
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null
}
