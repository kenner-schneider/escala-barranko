// create-tenant — operações do Root sobre tenants (Root NÃO tem acesso direto via RLS;
// tudo passa por aqui com service role e vai para o audit_log).
// actions: 'create' (default) | 'list' | 'set_status'
import { z } from 'npm:zod@3'
import {
  audit, fail, getCallerProfile, handleOptions, ok, randomToken, serviceClient,
} from '../_shared/mod.ts'

const Input = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('create'),
    name: z.string().min(2),
    slug: z.string().regex(/^[a-z0-9-]{2,40}$/),
    admin_email: z.string().email(),
    admin_name: z.string().min(2),
  }),
  z.object({ action: z.literal('list') }),
  z.object({
    action: z.literal('set_status'),
    restaurant_id: z.string().uuid(),
    status: z.enum(['active', 'suspended']),
  }),
])

Deno.serve(async (req) => {
  const opt = handleOptions(req)
  if (opt) return opt

  const sb = serviceClient()
  const caller = await getCallerProfile(req, sb)
  if (!caller || caller.role !== 'root') return fail('Não autorizado.', 403)

  const parsed = Input.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return fail('Dados inválidos.')
  const input = parsed.data

  if (input.action === 'list') {
    const { data: tenants } = await sb
      .from('restaurants')
      .select('id, name, slug, status, created_at')
      .order('created_at')
    const { data: counts } = await sb.from('people').select('restaurant_id, active')
    const enriched = (tenants ?? []).map((t) => ({
      ...t,
      people_count: (counts ?? []).filter((c) => c.restaurant_id === t.id && c.active).length,
    }))
    await audit(sb, { actor: `root:${caller.id}`, action: 'tenant.list', entity: 'restaurants' })
    return ok(enriched)
  }

  if (input.action === 'set_status') {
    const { error } = await sb.from('restaurants')
      .update({ status: input.status })
      .eq('id', input.restaurant_id)
    if (error) return fail('Erro ao atualizar tenant.', 500)
    await audit(sb, {
      restaurant_id: input.restaurant_id, actor: `root:${caller.id}`,
      action: `tenant.${input.status === 'active' ? 'reactivate' : 'suspend'}`,
      entity: 'restaurants', entity_id: input.restaurant_id,
    })
    return ok()
  }

  // create
  const { data: rest, error: restErr } = await sb
    .from('restaurants')
    .insert({ name: input.name, slug: input.slug })
    .select()
    .single()
  if (restErr) return fail(`Erro ao criar restaurante: ${restErr.message}`, 500)

  // Escala padrão para o restaurante já funcionar (o gerente renomeia/adiciona em Config).
  await sb.from('areas').insert({ restaurant_id: rest.id, name: 'Geral', sort_order: 0 })

  const temp_password = randomToken(9) // credencial provisória
  const { data: created, error: userErr } = await sb.auth.admin.createUser({
    email: input.admin_email,
    password: temp_password,
    email_confirm: true,
  })
  if (userErr || !created.user) {
    await sb.from('restaurants').delete().eq('id', rest.id)
    return fail(`Erro ao criar usuário Admin: ${userErr?.message ?? 'desconhecido'}`, 500)
  }

  const { error: profErr } = await sb.from('profiles').insert({
    id: created.user.id, restaurant_id: rest.id, role: 'admin', name: input.admin_name,
  })
  if (profErr) return fail(`Usuário criado mas perfil falhou: ${profErr.message}`, 500)

  await audit(sb, {
    restaurant_id: rest.id, actor: `root:${caller.id}`,
    action: 'tenant.create', entity: 'restaurants', entity_id: rest.id,
  })
  return ok({ restaurant_id: rest.id, admin_email: input.admin_email, temp_password })
})
