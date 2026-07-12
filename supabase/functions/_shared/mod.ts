// Utilitários compartilhados das Edge Functions.
import { createClient, SupabaseClient } from 'npm:@supabase/supabase-js@2'
import * as jose from 'npm:jose@5'

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

export function handleOptions(req: Request): Response | null {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  return null
}

export function json(body: unknown, status = 200, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders, ...headers },
  })
}

export const ok = (data?: unknown) => json({ ok: true, data })
export const fail = (error: string, status = 400) => json({ ok: false, error }, status)

export function serviceClient(): SupabaseClient {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  )
}

export interface Profile {
  id: string
  restaurant_id: string | null
  role: 'root' | 'admin'
  name: string
}

// Identifica o chamador (Admin/Root) pelo JWT do Supabase Auth no header Authorization.
export async function getCallerProfile(req: Request, sb: SupabaseClient): Promise<Profile | null> {
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (!token) return null
  const { data: { user } } = await sb.auth.getUser(token)
  if (!user) return null
  const { data } = await sb.from('profiles').select('*').eq('id', user.id).maybeSingle()
  return (data as Profile) ?? null
}

export async function audit(sb: SupabaseClient, entry: {
  restaurant_id?: string | null
  actor: string
  action: string
  entity: string
  entity_id?: string | null
}): Promise<void> {
  await sb.from('audit_log').insert(entry)
}

// JWT customizado do FREE. FREE_JWT_SECRET deve ser o JWT secret (legacy) do projeto
// Supabase, para que o PostgREST aceite o token e as policies RLS leiam os claims.
// role='authenticated' sem 'sub': auth.uid() fica null e nenhuma policy de Admin casa.
export async function signFreeJwt(person_id: string, restaurant_id: string): Promise<string> {
  const secret = new TextEncoder().encode(Deno.env.get('FREE_JWT_SECRET')!)
  return await new jose.SignJWT({
    person_id,
    restaurant_id,
    app_role: 'free',
    role: 'authenticated',
  })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setAudience('authenticated')
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(secret)
}

export async function sha256hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

export function randomToken(bytes = 32): string {
  const arr = new Uint8Array(bytes)
  crypto.getRandomValues(arr)
  return btoa(String.fromCharCode(...arr)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export const normalizePhone = (p: string) => p.replace(/\D/g, '')
