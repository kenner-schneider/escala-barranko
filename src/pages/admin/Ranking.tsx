import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAdmin } from '../../components/AdminShell'
import { Empty, ErrorMsg, Loading } from '../../components/ui'
import { todaySP } from '../../lib/dates'
import {
  computeScores, fetchScoreInputs, fmtScore, teamWeightOf, windowCutoff, windowWeeksOf,
} from '../../lib/score'
import { supabase } from '../../lib/supabase'
import type { Person } from '../../lib/types'
import { StarIcon, TrophyIcon } from '../../components/icons'

const WINDOW_OPTIONS = [
  { value: 0, label: 'Todo o período' },
  { value: 4, label: 'Últimas 4 semanas' },
  { value: 8, label: 'Últimas 8 semanas' },
  { value: 12, label: 'Últimas 12 semanas' },
]

// Visualização do ranking com janela ajustável (só leitura — a janela OFICIAL,
// usada na ordenação da Escala, é a do Config).
export function Ranking() {
  const { restaurant } = useAdmin()
  const officialWeeks = windowWeeksOf(restaurant)
  const teamWeight = teamWeightOf(restaurant)
  const [weeks, setWeeks] = useState(officialWeeks)
  const cutoff = windowCutoff(weeks, todaySP())

  const peopleQ = useQuery({
    queryKey: ['people', restaurant.id],
    queryFn: async () => {
      const { data, error } = await supabase.from('people').select('*')
        .eq('restaurant_id', restaurant.id).eq('active', true).order('display_name')
      if (error) throw error
      return data as Person[]
    },
  })
  const scoresQ = useQuery({
    queryKey: ['scores', restaurant.id, cutoff, teamWeight],
    queryFn: async () =>
      computeScores(await fetchScoreInputs(restaurant.id, cutoff), teamWeight),
  })

  if (peopleQ.isLoading || scoresQ.isLoading) return <Loading />
  if (peopleQ.isError || scoresQ.isError) return <ErrorMsg msg="Não foi possível carregar o ranking." />

  const people = peopleQ.data ?? []
  const scores = scoresQ.data ?? new Map()

  const ranked = people
    .map((p) => ({ p, s: scores.get(p.id) }))
    .filter((r) => r.s?.final != null)
    .sort((a, b) => b.s!.final! - a.s!.final! || a.p.display_name.localeCompare(b.p.display_name))
  const unranked = people.filter((p) => scores.get(p.id)?.final == null)

  const officialLabel = WINDOW_OPTIONS.find((o) => o.value === officialWeeks)?.label
    ?? `Últimas ${officialWeeks} semanas`

  return (
    <div>
      <h1>Ranking</h1>
      <div className="schedule-toolbar">
        <label className="rank-window">
          <span className="muted">Janela:</span>
          <select value={weeks} onChange={(e) => setWeeks(Number(e.target.value))}>
            {WINDOW_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}{o.value === officialWeeks ? ' (oficial)' : ''}
              </option>
            ))}
          </select>
        </label>
        <div className="spacer" />
        <span className="muted">
          Score = {100 - teamWeight}% individual + {teamWeight}% equipe · janela oficial: {officialLabel}
        </span>
      </div>

      <p className="muted" style={{ marginTop: '.1rem' }}>
        Avalie cada pessoa em <a href="#/relatorios"><strong>Relatórios → Semanal</strong></a> e
        a equipe do turno na <a href="#/presenca"><strong>Presença</strong></a>. Este ranking é só leitura.
      </p>

      {ranked.length === 0 && (
        <Empty msg="Sem avaliações na janela escolhida. Avalie a equipe na Presença e as pessoas em Relatórios → Semanal." />
      )}

      {ranked.length > 0 && (
        <div className="card">
          <table className="simple rank-table">
            <thead>
              <tr>
                <th>#</th><th>Pessoa</th><th>Score</th><th>Individual</th><th>Equipe</th>
                <th>Semanas avaliadas</th><th>Serviços c/ nota</th>
              </tr>
            </thead>
            <tbody>
              {ranked.map(({ p, s }, i) => (
                <tr key={p.id}>
                  <td className="rank-pos">
                    {i === 0 ? <TrophyIcon size={16} /> : `${i + 1}º`}
                  </td>
                  <td className="nowrap">
                    {p.icon} {p.display_name}
                    {p.type === 'clt' && <span className="badge" style={{ marginLeft: '.35rem' }}>CLT</span>}
                  </td>
                  <td>
                    <span className="badge score"><StarIcon size={11} filled /> {fmtScore(s!.final!)}</span>
                  </td>
                  <td>{s!.individual != null ? fmtScore(s!.individual) : <span className="muted">—</span>}</td>
                  <td>{s!.team != null ? fmtScore(s!.team) : <span className="muted">—</span>}</td>
                  <td>{s!.reviews}</td>
                  <td>{s!.services}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {ranked.length > 0 && unranked.length > 0 && (
        <p className="muted">
          Sem avaliação na janela: {unranked.map((p) => p.display_name).join(', ')}.
          Quem não tem nota aparece em posição neutra na Escala (nunca por último de castigo).
        </p>
      )}

      <p className="muted">
        A ordenação por ranking na Escala usa sempre a janela oficial (Config → Avaliação e ranking).
        Aqui você pode explorar outros recortes sem mudar a oficial.
      </p>
    </div>
  )
}
