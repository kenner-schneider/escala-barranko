import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Empty, ErrorMsg, Loading } from '../../components/ui'
import { useState } from 'react'
import { addDays, dayLabelPT, hhmm, isOpenForAvailability, todaySP } from '../../lib/dates'
import { freeClaims, getFreeJwt } from '../../lib/freeAuth'
import { freeSupabase } from '../../lib/supabase'
import type { Availability, Restaurant, Shift } from '../../lib/types'

const DAYS_AHEAD = 21

export function Disponibilidade() {
  const jwt = getFreeJwt()!
  const claims = freeClaims()!
  const sb = freeSupabase(jwt)
  const qc = useQueryClient()
  const [err, setErr] = useState('')
  const today = todaySP()
  const end = addDays(today, DAYS_AHEAD)

  const q = useQuery({
    queryKey: ['free-avail', claims.person_id],
    queryFn: async () => {
      const [rest, shifts, avail] = await Promise.all([
        sb.from('restaurants').select('*').eq('id', claims.restaurant_id).single(),
        sb.from('shifts').select('*').eq('active', true).order('start_time'),
        sb.from('availability').select('*').gte('date', today).lte('date', end),
      ])
      const failed = [rest, shifts, avail].find((r) => r.error)
      if (failed?.error) throw failed.error
      return {
        restaurant: rest.data as Restaurant,
        shifts: shifts.data as Shift[],
        avail: avail.data as Availability[],
      }
    },
  })

  const toggle = useMutation({
    mutationFn: async (v: { date: string; shiftId: string; existing?: Availability }) => {
      if (v.existing) {
        const { error } = await sb.from('availability').delete().eq('id', v.existing.id)
        if (error) throw error
      } else {
        const { error } = await sb.from('availability').insert({
          restaurant_id: claims.restaurant_id,
          person_id: claims.person_id,
          date: v.date,
          shift_id: v.shiftId,
        })
        if (error) throw error
      }
    },
    onSuccess: () => { setErr(''); qc.invalidateQueries({ queryKey: ['free-avail'] }) },
    onError: () => setErr('Este dia já fechou — só o gerente pode alterar agora.'),
  })

  if (q.isLoading) return <Loading />
  if (q.isError || !q.data) return <ErrorMsg msg="Não foi possível carregar. Tente sair e entrar de novo." />

  const { restaurant, shifts, avail } = q.data
  const lead = restaurant.settings.availability_lead_hours ?? 48
  const days = Array.from({ length: DAYS_AHEAD }, (_, i) => addDays(today, i + 1))
  const openDays = days.filter((d) => isOpenForAvailability(d, lead))

  return (
    <div>
      <h1>Minha disponibilidade</h1>
      <p className="muted">
        Toque no turno para marcar ou desmarcar. Dias travados 🔒 já fecharam
        (antecedência de {lead}h) — fale com o gerente se precisar mudar.
      </p>
      {err && <ErrorMsg msg={err} />}
      {openDays.length === 0 && (
        <Empty msg="Nenhum dia aberto para marcar no momento. Volte mais tarde." />
      )}
      {days.map((date) => {
        const open = isOpenForAvailability(date, lead)
        return (
          <div className="card day-card" key={date}>
            <div className="day-label">
              {dayLabelPT(date)}
              {!open && <div className="locked-tag">🔒 fechado</div>}
            </div>
            <div className="shifts">
              {shifts.map((s) => {
                const existing = avail.find((a) => a.date === date && a.shift_id === s.id)
                return (
                  <button key={s.id}
                    className={`shift-toggle ${existing ? 'on' : ''}`}
                    disabled={!open || toggle.isPending}
                    onClick={() => toggle.mutate({ date, shiftId: s.id, existing })}>
                    {s.name} {hhmm(s.start_time)}
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
