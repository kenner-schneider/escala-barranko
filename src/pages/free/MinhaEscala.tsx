import { useQuery } from '@tanstack/react-query'
import { Empty, ErrorMsg, Loading } from '../../components/ui'
import { dayLabelPT, hhmm, monthOf, todaySP } from '../../lib/dates'
import { freeClaims, getFreeJwt } from '../../lib/freeAuth'
import { freeSupabase } from '../../lib/supabase'
import type { MonthlyCount } from '../../lib/types'

interface EntryRow {
  id: string
  date: string
  status: 'convoked' | 'confirmed' | 'declined'
  shifts: { name: string; start_time: string; end_time: string; color: string } | null
}

export function MinhaEscala() {
  const jwt = getFreeJwt()!
  const claims = freeClaims()!
  const sb = freeSupabase(jwt)
  const today = todaySP()
  const month = monthOf(today)

  const q = useQuery({
    queryKey: ['free-schedule', claims.person_id],
    queryFn: async () => {
      const [entries, counts] = await Promise.all([
        sb.from('schedule_entries')
          .select('id, date, status, shifts(name, start_time, end_time, color)')
          .gte('date', today)
          .in('status', ['convoked', 'confirmed'])
          .order('date'),
        sb.from('monthly_counts').select('*').eq('month', month),
      ])
      const failed = [entries, counts].find((r) => r.error)
      if (failed?.error) throw failed.error
      return {
        entries: entries.data as unknown as EntryRow[],
        counts: counts.data as MonthlyCount[],
      }
    },
  })

  if (q.isLoading) return <Loading />
  if (q.isError || !q.data) return <ErrorMsg msg="Não foi possível carregar. Tente sair e entrar de novo." />

  const { entries, counts } = q.data
  const worked = counts[0]?.days_worked ?? 0
  const todayEntries = entries.filter((e) => e.date === today)

  return (
    <div>
      <h1>Minha escala</h1>

      <div className="card">
        {todayEntries.length > 0 ? (
          <p>
            🎉 Você trabalha <strong>hoje</strong>:{' '}
            {todayEntries.map((e) => e.shifts?.name).join(' e ')}
          </p>
        ) : (
          <p>Você não está escalado(a) para hoje.</p>
        )}
        <p className="muted">Você trabalhou <strong>{worked}</strong> {worked === 1 ? 'dia' : 'dias'} este mês.</p>
      </div>

      <h2 style={{ marginTop: '1rem' }}>Próximas convocações</h2>
      {entries.length === 0 && <Empty msg="Nenhuma convocação publicada por enquanto." />}
      {entries.map((e) => (
        <div className="card day-card" key={e.id}>
          <div className="day-label">{dayLabelPT(e.date)}</div>
          <div className="shifts">
            <span className="chip free" style={{ borderColor: e.shifts?.color }}>
              {e.shifts?.name} {e.shifts ? `${hhmm(e.shifts.start_time)}–${hhmm(e.shifts.end_time)}` : ''}
            </span>
            {e.status === 'confirmed'
              ? <span className="badge" style={{ color: 'var(--success)' }}>✅ confirmado</span>
              : <span className="badge">aguardando sua confirmação no grupo</span>}
          </div>
        </div>
      ))}
    </div>
  )
}
