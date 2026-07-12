// free-login — telefone + PIN → JWT customizado (claims: person_id, restaurant_id, app_role='free').
// Rate limit progressivo: 5 falhas → 15 min; 10 → 30 min; 15+ → 60 min.
import { z } from 'npm:zod@3'
import bcrypt from 'npm:bcryptjs@2.4.3'
import {
  audit, fail, handleOptions, normalizePhone, ok, serviceClient, signFreeJwt,
} from '../_shared/mod.ts'

const Input = z.object({
  phone: z.string().min(8),
  pin: z.string().regex(/^\d{6}$/),
})

const GENERIC = 'Telefone ou PIN incorretos.'

Deno.serve(async (req) => {
  const opt = handleOptions(req)
  if (opt) return opt

  const parsed = Input.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return fail('Dados inválidos. Informe telefone e PIN de 6 dígitos.')
  const phone = normalizePhone(parsed.data.phone)
  const sb = serviceClient()

  const { data: person } = await sb
    .from('people')
    .select('id, restaurant_id, display_name, active, type')
    .eq('phone', phone).eq('type', 'free').eq('active', true)
    .maybeSingle()
  if (!person) return fail(GENERIC, 401)

  const { data: cred } = await sb
    .from('free_credentials')
    .select('*')
    .eq('person_id', person.id)
    .maybeSingle()
  if (!cred?.pin_hash) return fail(GENERIC, 401)

  if (cred.locked_until && new Date(cred.locked_until) > new Date()) {
    const min = Math.ceil((new Date(cred.locked_until).getTime() - Date.now()) / 60000)
    return fail(`Muitas tentativas. Tente novamente em ${min} min.`, 429)
  }

  if (!bcrypt.compareSync(parsed.data.pin, cred.pin_hash)) {
    const attempts = (cred.failed_attempts ?? 0) + 1
    let locked_until: string | null = null
    if (attempts % 5 === 0) {
      const tier = Math.min(Math.floor(attempts / 5), 3) // 15, 30, 60 min
      const minutes = tier === 1 ? 15 : tier === 2 ? 30 : 60
      locked_until = new Date(Date.now() + minutes * 60000).toISOString()
    }
    await sb.from('free_credentials')
      .update({ failed_attempts: attempts, locked_until })
      .eq('person_id', person.id)
    if (locked_until) {
      await audit(sb, {
        restaurant_id: person.restaurant_id, actor: `free:${person.id}`,
        action: 'login.lockout', entity: 'free_credentials', entity_id: person.id,
      })
    }
    return fail(GENERIC, 401)
  }

  await sb.from('free_credentials')
    .update({ failed_attempts: 0, locked_until: null, last_login_at: new Date().toISOString() })
    .eq('person_id', person.id)

  const jwt = await signFreeJwt(person.id, person.restaurant_id)
  await audit(sb, {
    restaurant_id: person.restaurant_id, actor: `free:${person.id}`,
    action: 'login.success', entity: 'free_credentials', entity_id: person.id,
  })
  return ok({ jwt, display_name: person.display_name })
})
