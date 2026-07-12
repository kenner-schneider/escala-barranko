import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { demoCallFn, demoClient, demoFreeClient } from './demo'

const url = import.meta.env.VITE_SUPABASE_URL
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY

/** `npm run demo`: app roda com dados fictícios em memória, sem Supabase. */
export const DEMO_MODE = import.meta.env.VITE_DEMO === '1'

/** Cliente para Admin/Root (Supabase Auth). */
export const supabase: SupabaseClient = DEMO_MODE
  ? (demoClient() as SupabaseClient)
  : createClient(url, anon)

let freeClient: SupabaseClient | null = null
let freeClientJwt: string | null = null

/** Cliente para FREE: envia o JWT customizado no header Authorization (RLS lê os claims). */
export function freeSupabase(jwt: string): SupabaseClient {
  if (DEMO_MODE) return demoFreeClient(jwt) as SupabaseClient
  if (!freeClient || freeClientJwt !== jwt) {
    freeClient = createClient(url, anon, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    })
    freeClientJwt = jwt
  }
  return freeClient
}

export async function adminToken(): Promise<string | undefined> {
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token
}

/** Chama uma Edge Function. Lança Error com mensagem amigável em caso de falha. */
export async function callFn<T = unknown>(name: string, body: unknown, jwt?: string): Promise<T> {
  if (DEMO_MODE) return (await demoCallFn(name, body)) as T
  let res: Response
  try {
    res = await fetch(`${url}/functions/v1/${name}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: anon,
        Authorization: `Bearer ${jwt ?? anon}`,
      },
      body: JSON.stringify(body),
    })
  } catch {
    throw new Error('Sem conexão com o servidor. Verifique sua internet.')
  }
  const ct = res.headers.get('Content-Type') ?? ''
  if (ct.includes('text/csv')) {
    if (!res.ok) throw new Error('Falha ao exportar CSV.')
    return (await res.text()) as unknown as T
  }
  const json = await res.json().catch(() => ({ ok: false, error: 'Resposta inválida do servidor.' }))
  if (!res.ok || json.ok === false) throw new Error(json.error ?? 'Erro inesperado.')
  return json.data as T
}
