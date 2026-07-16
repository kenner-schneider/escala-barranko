// Score de avaliação: individual (critérios com peso) + equipe (serviços frequentados).
// Nunca armazenado — sempre recalculado a partir de criteria/person_reviews/team_reviews.
import { addDays, mondayOf } from './dates'
import { supabase } from './supabase'
import type { Criterion, PersonReview, Restaurant, TeamReview } from './types'

export interface ScoreParts {
  individual: number | null  // média ponderada dos critérios (1–5), média entre semanas
  team: number | null        // média das notas de equipe dos serviços presentes (1–5)
  final: number | null       // combinação com o peso da equipe
  reviews: number            // nº de semanas avaliadas consideradas
  services: number           // nº de serviços com nota de equipe considerados
}

export const teamWeightOf = (r: Restaurant) =>
  Math.min(100, Math.max(0, r.settings.review_team_weight ?? 20))

export const windowWeeksOf = (r: Restaurant) =>
  Math.max(0, r.settings.ranking_window_weeks ?? 0)

/** Início da janela (segunda de N-1 semanas atrás). null = todo o período. */
export function windowCutoff(weeks: number, today: string): string | null {
  if (weeks <= 0) return null
  return addDays(mondayOf(today), -7 * (weeks - 1))
}

export interface ScoreInputs {
  criteria: Criterion[]
  reviews: PersonReview[]
  teamReviews: TeamReview[]
  // serviços presentes por pessoa: entries status=confirmed dentro da janela
  attendance: { person_id: string; date: string; shift_id: string }[]
}

/** Busca tudo que o cálculo precisa, já filtrado pela janela. */
export async function fetchScoreInputs(restaurantId: string, cutoff: string | null): Promise<ScoreInputs> {
  let reviewsQ = supabase.from('person_reviews').select('*').eq('restaurant_id', restaurantId)
  let teamQ = supabase.from('team_reviews').select('*').eq('restaurant_id', restaurantId)
  let attQ = supabase.from('schedule_entries').select('*')
    .eq('restaurant_id', restaurantId).eq('status', 'confirmed')
  if (cutoff) {
    reviewsQ = reviewsQ.gte('week', cutoff)
    teamQ = teamQ.gte('date', cutoff)
    attQ = attQ.gte('date', cutoff)
  }
  const [criteria, reviews, team, att] = await Promise.all([
    supabase.from('criteria').select('*').eq('restaurant_id', restaurantId).eq('active', true).order('sort_order'),
    reviewsQ, teamQ, attQ,
  ])
  const failed = [criteria, reviews, team, att].find((r) => r.error)
  if (failed?.error) throw failed.error
  return {
    criteria: criteria.data as Criterion[],
    reviews: reviews.data as PersonReview[],
    teamReviews: team.data as TeamReview[],
    attendance: att.data as ScoreInputs['attendance'],
  }
}

/** Média ponderada 1–5 de UMA avaliação semanal (só critérios ativos presentes). */
export function reviewScore(review: PersonReview, criteria: Criterion[]): number | null {
  let sum = 0
  let wsum = 0
  for (const c of criteria) {
    const v = review.scores[c.id]
    if (typeof v === 'number' && v >= 1 && v <= 5) {
      sum += v * c.weight
      wsum += c.weight
    }
  }
  return wsum > 0 ? sum / wsum : null
}

export function computeScores(inputs: ScoreInputs, teamWeightPct: number): Map<string, ScoreParts> {
  const w = Math.min(100, Math.max(0, teamWeightPct)) / 100
  const out = new Map<string, ScoreParts>()
  const get = (pid: string) => {
    const cur = out.get(pid) ?? { individual: null, team: null, final: null, reviews: 0, services: 0 }
    out.set(pid, cur)
    return cur
  }

  // individual: média das semanas avaliadas
  const indAcc = new Map<string, { sum: number; n: number }>()
  for (const r of inputs.reviews) {
    const s = reviewScore(r, inputs.criteria)
    if (s == null) continue
    const acc = indAcc.get(r.person_id) ?? { sum: 0, n: 0 }
    acc.sum += s
    acc.n += 1
    indAcc.set(r.person_id, acc)
  }
  for (const [pid, acc] of indAcc) {
    const p = get(pid)
    p.individual = acc.sum / acc.n
    p.reviews = acc.n
  }

  // equipe: média das notas dos serviços em que a pessoa esteve presente
  const teamOf = new Map(inputs.teamReviews.map((t) => [`${t.date}|${t.shift_id}`, t.score]))
  const teamAcc = new Map<string, { sum: number; n: number }>()
  for (const a of inputs.attendance) {
    const score = teamOf.get(`${a.date}|${a.shift_id}`)
    if (score == null) continue
    const acc = teamAcc.get(a.person_id) ?? { sum: 0, n: 0 }
    acc.sum += score
    acc.n += 1
    teamAcc.set(a.person_id, acc)
  }
  for (const [pid, acc] of teamAcc) {
    const p = get(pid)
    p.team = acc.sum / acc.n
    p.services = acc.n
  }

  // final: se só existe um dos componentes, ele vale sozinho (sem punir falta de dado)
  for (const p of out.values()) {
    if (p.individual != null && p.team != null) p.final = (1 - w) * p.individual + w * p.team
    else p.final = p.individual ?? p.team
  }
  return out
}

export const fmtScore = (n: number) =>
  n.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
