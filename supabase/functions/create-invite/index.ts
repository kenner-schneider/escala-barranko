// create-invite — (só Admin do tenant) gera token de convite p/ FREE.
// Token ≥128 bits; só o hash SHA-256 é persistido; TTL 48h; uso único.
// Invalida convites anteriores e reseta o PIN (fluxo de "PIN esquecido").
import { z } from 'npm:zod@3'
import {
  audit, fail, getCallerProfile, handleOptions, ok, randomToken, serviceClient, sha256hex,
} from '../_shared/mod.ts'

const Input = z.object({ person_id: z.string().uuid() })

Deno.serve(async (req) => {
  const opt = handleOptions(req)
  if (opt) return opt

  const sb = serviceClient()
  const caller = await getCallerProfile(req, sb)
  if (!caller || caller.role !== 'admin' || !caller.restaurant_id) {
    return fail('Não autorizado.', 403)
  }

  const parsed = Input.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return fail('Dados inválidos.')

  const { data: person } = await sb
    .from('people')
    .select('id, restaurant_id, type, active')
    .eq('id', parsed.data.person_id)
    .maybeSingle()
  if (!person || person.restaurant_id !== caller.restaurant_id) return fail('Pessoa não encontrada.', 404)
  if (person.type !== 'free' || !person.active) return fail('Convite só para FREE ativo.')

  // Rate limit simples: máx. 10 convites/hora por tenant
  const hourAgo = new Date(Date.now() - 3600_000).toISOString()
  const { count } = await sb
    .from('invites')
    .select('id, people!inner(restaurant_id)', { count: 'exact', head: true })
    .eq('people.restaurant_id', caller.restaurant_id)
    .gte('expires_at', hourAgo)
  if ((count ?? 0) > 10) return fail('Limite de convites por hora atingido. Aguarde.', 429)

  const token = randomToken(32) // 256 bits
  const token_hash = await sha256hex(token)
  const expires_at = new Date(Date.now() + 48 * 3600_000).toISOString()

  // Invalida convites anteriores e reseta PIN/lockout
  await sb.from('invites').delete().eq('person_id', person.id)
  await sb.from('free_credentials').upsert({
    person_id: person.id, pin_hash: null, failed_attempts: 0, locked_until: null,
  })
  const { error } = await sb.from('invites').insert({ person_id: person.id, token_hash, expires_at })
  if (error) return fail('Erro ao criar convite.', 500)

  await audit(sb, {
    restaurant_id: caller.restaurant_id, actor: `admin:${caller.id}`,
    action: 'invite.create', entity: 'people', entity_id: person.id,
  })
  // O frontend monta a URL completa: {origin}/#/convite/{token}
  return ok({ token, expires_at })
})
