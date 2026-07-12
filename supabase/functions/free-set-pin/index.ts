// free-set-pin — valida token de convite e define o PIN.
// Sem `pin` no body: só valida o token e retorna o nome (conferência antes do aceite).
// Com `pin`: consome o token, grava pin_hash (bcrypt custo 12) e retorna JWT.
import { z } from 'npm:zod@3'
import bcrypt from 'npm:bcryptjs@2.4.3'
import {
  audit, fail, handleOptions, ok, serviceClient, sha256hex, signFreeJwt,
} from '../_shared/mod.ts'

const Input = z.object({
  token: z.string().min(20),
  pin: z.string().regex(/^\d{6}$/).optional(),
})

Deno.serve(async (req) => {
  const opt = handleOptions(req)
  if (opt) return opt

  const parsed = Input.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return fail('Dados inválidos.')
  const { token, pin } = parsed.data
  const sb = serviceClient()

  const tokenHash = await sha256hex(token)
  const { data: invite } = await sb
    .from('invites')
    .select('id, person_id, expires_at, used_at')
    .eq('token_hash', tokenHash)
    .maybeSingle()
  if (!invite || invite.used_at || new Date(invite.expires_at) < new Date()) {
    return fail('Convite inválido ou expirado. Peça um novo link ao gerente.', 410)
  }

  const { data: person } = await sb
    .from('people')
    .select('id, restaurant_id, full_name, display_name, active')
    .eq('id', invite.person_id).eq('active', true)
    .maybeSingle()
  if (!person) return fail('Cadastro não encontrado. Fale com o gerente.', 404)

  // Modo conferência: só devolve o nome
  if (!pin) return ok({ full_name: person.full_name, display_name: person.display_name })

  const pin_hash = bcrypt.hashSync(pin, 12)
  await sb.from('free_credentials').upsert({
    person_id: person.id, pin_hash, failed_attempts: 0, locked_until: null,
  })
  await sb.from('invites').update({ used_at: new Date().toISOString() }).eq('id', invite.id)

  const jwt = await signFreeJwt(person.id, person.restaurant_id)
  await audit(sb, {
    restaurant_id: person.restaurant_id, actor: `free:${person.id}`,
    action: 'invite.accept', entity: 'invites', entity_id: invite.id,
  })
  return ok({ jwt, display_name: person.display_name })
})
