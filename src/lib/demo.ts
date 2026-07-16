// Modo demonstração: banco em memória p/ testar interface/usabilidade sem Supabase.
// Ativado com `npm run demo` (VITE_DEMO=1). Nada aqui roda em produção.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { addDays, mondayOf, monthOf, todaySP, weekdayIdx } from './dates'

type Row = Record<string, any>

const R = '11111111-1111-1111-1111-111111111111'
const ADMIN = '22222222-2222-2222-2222-222222222222'
const ROOT = '33333333-3333-3333-3333-333333333333'
const S1 = 'aaaaaaaa-0000-0000-0000-000000000001'
const S2 = 'aaaaaaaa-0000-0000-0000-000000000002'
const A1 = 'dddddddd-0000-0000-0000-000000000001' // Salão
const A2 = 'dddddddd-0000-0000-0000-000000000002' // Cozinha
const A3 = 'dddddddd-0000-0000-0000-000000000003' // Bar
const P = (n: number) => `ffffffff-0000-0000-0000-${String(n).padStart(12, '0')}`
const C = (n: number) => `cccccccc-0000-0000-0000-00000000000${n}`
const K = (n: number) => `eeeeeeee-0000-0000-0000-00000000000${n}` // critérios
const S3 = 'aaaaaaaa-0000-0000-0000-000000000003' // Noite 2º turno (sobrepõe a Noite)

const today = todaySP()
const uuid = () => crypto.randomUUID()

const db: Record<string, Row[]> = {
  restaurants: [{
    id: R, name: 'Barranko (demo)', slug: 'barranko', status: 'active',
    settings: { availability_lead_hours: 48, default_monthly_limit: 10 },
    created_at: new Date().toISOString(),
  }],
  profiles: [
    { id: ADMIN, restaurant_id: R, role: 'admin', name: 'Gerente Demo' },
    { id: ROOT, restaurant_id: null, role: 'root', name: 'Root Demo' },
  ],
  shifts: [
    { id: S1, restaurant_id: R, name: 'Meio-dia', start_time: '11:00', end_time: '15:00', color: '#f59e0b', label: 'MD', active: true },
    { id: S2, restaurant_id: R, name: 'Noite', start_time: '18:00', end_time: '23:00', color: '#3b82f6', label: 'N', active: true },
    // Sobrepõe a "Noite" — p/ testar o bloqueio de conflito de horário
    { id: S3, restaurant_id: R, name: 'Noite 2º turno', start_time: '19:00', end_time: '23:59', color: '#8b5cf6', label: 'N2', active: true },
  ],
  areas: [
    { id: A1, restaurant_id: R, name: 'Salão', color: '#3b82f6', sort_order: 0, active: true },
    { id: A2, restaurant_id: R, name: 'Cozinha', color: '#f59e0b', sort_order: 1, active: true },
    { id: A3, restaurant_id: R, name: 'Bar', color: '#8b5cf6', sort_order: 2, active: true },
  ],
  people: [
    { id: C(1), restaurant_id: R, type: 'clt', full_name: 'Carlos Pereira', display_name: 'Carlos', icon: '👨‍🍳', phone: null, monthly_limit: null, fixed_days: { mon: [S1], wed: [S1], fri: [S1] }, area_ids: [A2], active: true },
    { id: C(2), restaurant_id: R, type: 'clt', full_name: 'Cintia Souza', display_name: 'Cintia', icon: '🧑‍🍳', phone: null, monthly_limit: null, fixed_days: null, active: true },
    { id: C(3), restaurant_id: R, type: 'clt', full_name: 'Cesar Lima', display_name: 'Cesar', icon: '🍳', phone: null, monthly_limit: null, fixed_days: null, active: true },
    { id: P(1), restaurant_id: R, type: 'free', full_name: 'Fernanda Alves', display_name: 'Fernanda', icon: '⭐', phone: '5511999990001', monthly_limit: null, fixed_days: null, active: true },
    { id: P(2), restaurant_id: R, type: 'free', full_name: 'Fabio Santos', display_name: 'Fabio', icon: '🔥', phone: '5511999990002', monthly_limit: null, fixed_days: null, area_ids: [A2, A3], active: true },
    { id: P(3), restaurant_id: R, type: 'free', full_name: 'Flavia Costa', display_name: 'Flavia', icon: '🌟', phone: '5511999990003', monthly_limit: 5, fixed_days: null, active: true },
    { id: P(4), restaurant_id: R, type: 'free', full_name: 'Felipe Rocha', display_name: 'Felipe', icon: '⚡', phone: '5511999990004', monthly_limit: null, fixed_days: null, active: true },
    { id: P(5), restaurant_id: R, type: 'free', full_name: 'Fatima Dias', display_name: 'Fatima', icon: '🌙', phone: '5511999990005', monthly_limit: null, fixed_days: null, active: true },
    { id: P(6), restaurant_id: R, type: 'free', full_name: 'Gustavo Nunes', display_name: 'Gustavo', icon: '🎸', phone: '5511999990006', monthly_limit: null, fixed_days: null, active: true },
    { id: P(7), restaurant_id: R, type: 'free', full_name: 'Helena Prado', display_name: 'Helena', icon: '🌺', phone: '5511999990007', monthly_limit: 6, fixed_days: null, active: true },
    { id: P(8), restaurant_id: R, type: 'free', full_name: 'Igor Matos', display_name: 'Igor', icon: '🦁', phone: '5511999990008', monthly_limit: null, fixed_days: null, active: true },
    { id: P(9), restaurant_id: R, type: 'free', full_name: 'Julia Ramos', display_name: 'Julia', icon: '🍀', phone: '5511999990009', monthly_limit: null, fixed_days: null, active: true },
    { id: P(10), restaurant_id: R, type: 'free', full_name: 'Kaue Braga', display_name: 'Kaue', icon: '🏄', phone: '5511999990010', monthly_limit: 4, fixed_days: null, active: true },
  ],
  availability: [],
  schedule_entries: [],
  entry_notes: [],
  criteria: [
    { id: K(1), restaurant_id: R, name: 'Pontualidade', weight: 2, sort_order: 0, active: true },
    { id: K(2), restaurant_id: R, name: 'Agilidade', weight: 1, sort_order: 1, active: true },
    { id: K(3), restaurant_id: R, name: 'Postura com o cliente', weight: 1, sort_order: 2, active: true },
  ],
  person_reviews: [],
  team_reviews: [],
}

// Disponibilidade dos próximos 14 dias, por padrão de dia da semana
// (0=dom, 1=seg, 2=ter, 3=qua, 4=qui, 5=sex, 6=sáb) — cenários variados p/ testar equilíbrio:
const AVAIL_PATTERNS: { person: string; days: number[]; shifts: string[] }[] = [
  { person: P(1), days: [0, 1, 2, 3, 4, 5, 6], shifts: [S1, S2, S3] }, // Fernanda: todos os dias, 3 turnos (S2×S3 testam conflito)
  { person: P(2), days: [1, 2, 3, 4, 5], shifts: [S2] },           // Fabio: noites de seg a sex
  { person: P(3), days: [2, 4], shifts: [S1] },                    // Flavia: só ter/qui meio-dia (2x específicos)
  { person: P(4), days: [5, 6, 0], shifts: [S2] },                 // Felipe: noites de fim de semana
  { person: P(5), days: [1, 3, 5], shifts: [S1] },                 // Fatima: seg/qua/sex meio-dia
  { person: P(6), days: [1, 3, 5], shifts: [S1, S2] },             // Gustavo: seg/qua/sex, 2 turnos
  { person: P(7), days: [6, 0], shifts: [S1, S2] },                // Helena: só fim de semana
  { person: P(8), days: [2, 4, 6], shifts: [S2] },                 // Igor: ter/qui/sáb noite
  { person: P(9), days: [0, 1, 2, 3, 4, 5, 6], shifts: [S2] },     // Julia: toda noite
  { person: P(10), days: [2, 3, 4], shifts: [S1] },                // Kaue: ter/qua/qui meio-dia
]
for (let i = 1; i <= 14; i++) {
  const date = addDays(today, i)
  const dow = weekdayIdx(date)
  for (const pat of AVAIL_PATTERNS) {
    if (!pat.days.includes(dow)) continue
    for (const shift_id of pat.shifts) {
      db.availability.push({ id: uuid(), restaurant_id: R, person_id: pat.person, date, shift_id, created_at: new Date().toISOString() })
    }
  }
}

// Escala de exemplo: passado (p/ contadores) + semana atual com vários status
const entry = (person_id: string, date: string, shift_id: string, status: string, area_id = A1): Row => ({
  id: uuid(), restaurant_id: R, person_id, date, shift_id, area_id, status,
  convoked_at: status === 'draft' ? null : new Date().toISOString(),
  updated_by: ADMIN, updated_at: new Date().toISOString(),
})
db.schedule_entries.push(
  entry(P(1), addDays(today, -5), S2, 'convoked', A3),
  entry(P(1), addDays(today, -3), S1, 'convoked', A1),
  entry(P(2), addDays(today, -3), S2, 'convoked', A2),
  // Dias já passados desta semana — p/ a aba Presença (foi/faltou), com estados variados
  entry(P(1), addDays(today, -1), S2, 'convoked', A1),
  entry(P(2), addDays(today, -1), S1, 'confirmed', A2),
  entry(P(4), addDays(today, -1), S2, 'declined', A3),
  entry(P(6), today, S1, 'convoked', A1),
  entry(C(1), today, S1, 'convoked', A2),
  // Futuro
  entry(P(1), addDays(today, 1), S2, 'convoked', A1),
  entry(P(2), addDays(today, 1), S2, 'convoked', A2),
  entry(P(3), addDays(today, 2), S1, 'convoked', A3),
  entry(C(1), addDays(today, 1), S1, 'draft', A2),
  entry(P(5), addDays(today, 2), S1, 'draft', A1),
)

// Anotação de consumo de exemplo (aba Presença) na presença confirmada de ontem
const notedEntry = db.schedule_entries.find((e) => e.status === 'confirmed')
if (notedEntry) {
  db.entry_notes.push({
    entry_id: notedEntry.id, restaurant_id: R, note: '1 coca, 1 água c/ gás',
    value: 9.5, updated_by: ADMIN, updated_at: new Date().toISOString(),
  })
}

// Avaliações de exemplo: individuais da semana passada + notas de equipe de serviços passados
const lastMonday = mondayOf(addDays(today, -7))
const review = (person_id: string, scores: Record<string, number>): Row => ({
  id: uuid(), restaurant_id: R, person_id, week: lastMonday, scores,
  note: null, updated_by: ADMIN, updated_at: new Date().toISOString(),
})
db.person_reviews.push(
  review(P(1), { [K(1)]: 5, [K(2)]: 4, [K(3)]: 5 }), // Fernanda ~4,8
  review(P(2), { [K(1)]: 4, [K(2)]: 3, [K(3)]: 4 }), // Fabio ~3,8
  review(P(4), { [K(1)]: 2, [K(2)]: 3, [K(3)]: 3 }), // Felipe ~2,5
)
const teamReview = (date: string, shift_id: string, score: number): Row => ({
  id: uuid(), restaurant_id: R, date, shift_id, score,
  note: null, updated_by: ADMIN, updated_at: new Date().toISOString(),
})
db.team_reviews.push(
  teamReview(addDays(today, -5), S2, 4),
  teamReview(addDays(today, -3), S1, 5),
  teamReview(addDays(today, -1), S1, 3),
)

function computeCounts(): Row[] {
  const map = new Map<string, { restaurant_id: string; person_id: string; month: string; dates: Set<string>; per_shift: Record<string, number> }>()
  for (const e of db.schedule_entries) {
    if (e.status !== 'convoked' && e.status !== 'confirmed') continue
    const month = monthOf(e.date)
    const key = `${e.person_id}|${month}`
    const cur = map.get(key) ?? {
      restaurant_id: e.restaurant_id as string, person_id: e.person_id as string, month,
      dates: new Set<string>(), per_shift: {} as Record<string, number>,
    }
    cur.dates.add(e.date)
    cur.per_shift[e.shift_id] = (cur.per_shift[e.shift_id] ?? 0) + 1
    map.set(key, cur)
  }
  return [...map.values()].map((c) => ({
    restaurant_id: c.restaurant_id, person_id: c.person_id, month: c.month,
    days_worked: c.dates.size, per_shift: c.per_shift,
  }))
}

interface FreeScope { person_id: string }

class MockQuery {
  private op: 'select' | 'insert' | 'update' | 'delete' | 'upsert' = 'select'
  private filters: ((r: Row) => boolean)[] = []
  private payload: any
  private opts: any
  private orderKey: string | null = null
  private mode: 'many' | 'single' | 'maybe' = 'many'
  private selectStr = '*'

  constructor(private table: string, private scope?: FreeScope) {}

  select(s = '*') { if (this.op === 'select') this.selectStr = s; return this }
  eq(k: string, v: any) { this.filters.push((r) => r[k] === v); return this }
  gte(k: string, v: any) { this.filters.push((r) => r[k] >= v); return this }
  lte(k: string, v: any) { this.filters.push((r) => r[k] <= v); return this }
  in(k: string, vs: any[]) { const s = new Set(vs); this.filters.push((r) => s.has(r[k])); return this }
  order(k: string) { this.orderKey = k; return this }
  single() { this.mode = 'single'; return this }
  maybeSingle() { this.mode = 'maybe'; return this }
  insert(p: any) { this.op = 'insert'; this.payload = p; return this }
  update(p: any) { this.op = 'update'; this.payload = p; return this }
  delete() { this.op = 'delete'; return this }
  upsert(p: any, o?: any) { this.op = 'upsert'; this.payload = p; this.opts = o; return this }

  then(res: any, rej?: any) {
    return new Promise((r) => setTimeout(() => r(this.exec()), 60)).then(res, rej)
  }

  private base(): Row[] {
    let rows = this.table === 'monthly_counts' ? computeCounts() : (db[this.table] ?? [])
    if (this.scope) {
      // emula a RLS do FREE
      const pid = this.scope.person_id
      if (this.table === 'availability') rows = rows.filter((r) => r.person_id === pid)
      if (this.table === 'monthly_counts') rows = rows.filter((r) => r.person_id === pid)
      if (this.table === 'schedule_entries') rows = rows.filter((r) => r.person_id === pid && r.status !== 'draft')
      if (this.table === 'people') rows = rows.filter((r) => r.id === pid)
    }
    return rows
  }

  private matches(r: Row) { return this.filters.every((f) => f(r)) }

  private withDefaults(r: Row): Row {
    return { id: uuid(), created_at: new Date().toISOString(), active: true, updated_at: new Date().toISOString(), ...r }
  }

  private exec(): { data: any; error: any } {
    if (this.op === 'select') {
      let rows = this.base().filter((r) => this.matches(r))
      if (this.orderKey) {
        const k = this.orderKey
        rows = [...rows].sort((a, b) => String(a[k]).localeCompare(String(b[k])))
      }
      let out = rows.map((r) => ({ ...r }))
      if (this.selectStr.includes('shifts(')) {
        out = out.map((r) => ({ ...r, shifts: db.shifts.find((s) => s.id === r.shift_id) ?? null }))
      }
      if (this.selectStr.includes('people(')) {
        out = out.map((r) => ({ ...r, people: db.people.find((p) => p.id === r.person_id) ?? null }))
      }
      if (this.mode === 'single') {
        return out.length ? { data: out[0], error: null } : { data: null, error: { message: 'não encontrado' } }
      }
      if (this.mode === 'maybe') return { data: out[0] ?? null, error: null }
      return { data: out, error: null }
    }
    const rows = db[this.table] ?? (db[this.table] = [])
    if (this.op === 'insert') {
      for (const r of Array.isArray(this.payload) ? this.payload : [this.payload]) rows.push(this.withDefaults(r))
      return { data: null, error: null }
    }
    if (this.op === 'update') {
      for (const r of rows) if (this.matches(r)) Object.assign(r, this.payload)
      return { data: null, error: null }
    }
    if (this.op === 'delete') {
      db[this.table] = rows.filter((r) => !this.matches(r))
      return { data: null, error: null }
    }
    // upsert
    const keys: string[] = (this.opts?.onConflict ?? 'id').split(',')
    for (const r of Array.isArray(this.payload) ? this.payload : [this.payload]) {
      const existing = rows.find((x) => keys.every((k) => x[k] === r[k]))
      if (existing) {
        if (!this.opts?.ignoreDuplicates) Object.assign(existing, r, { updated_at: new Date().toISOString() })
      } else {
        rows.push(this.withDefaults(r))
      }
    }
    return { data: null, error: null }
  }
}

// --- Auth mock (Admin/Root) ---
const SESSION_KEY = 'demo.session'

function currentSession() {
  const id = localStorage.getItem(SESSION_KEY)
  return id ? { user: { id }, access_token: 'demo-token' } : null
}

export function demoClient(): any {
  return {
    from: (t: string) => new MockQuery(t),
    rpc: async (fn: string, params: any) => {
      if (fn === 'anonymize_person') {
        const p = db.people.find((x) => x.id === params.pid)
        if (p) Object.assign(p, { full_name: 'Removido (LGPD)', phone: null, active: false })
      }
      return { data: null, error: null }
    },
    auth: {
      getSession: async () => ({ data: { session: currentSession() } }),
      onAuthStateChange: (_cb: any) => ({ data: { subscription: { unsubscribe() {} } } }),
      signInWithPassword: async ({ email }: { email: string }) => {
        localStorage.setItem(SESSION_KEY, email.toLowerCase().startsWith('root') ? ROOT : ADMIN)
        return { data: {}, error: null }
      },
      signOut: async () => { localStorage.removeItem(SESSION_KEY); return { error: null } },
    },
  }
}

export function demoFreeClient(jwt: string): any {
  let person_id = P(1)
  try { person_id = JSON.parse(atob(jwt.split('.')[1])).person_id ?? P(1) } catch { /* usa padrão */ }
  return { from: (t: string) => new MockQuery(t, { person_id }) }
}

// --- Edge Functions mock ---
const b64 = (o: object) =>
  btoa(JSON.stringify(o)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

const fakeJwt = (p: Row) =>
  `${b64({ alg: 'none' })}.${b64({
    person_id: p.id, restaurant_id: p.restaurant_id, app_role: 'free',
    exp: Math.floor(Date.now() / 1000) + 24 * 3600,
  })}.demo`

const inviteTokens = new Map<string, string>()

export async function demoCallFn(name: string, body: any): Promise<any> {
  await new Promise((r) => setTimeout(r, 250))
  switch (name) {
    case 'create-invite': {
      const token = 'demo-' + uuid()
      inviteTokens.set(token, body.person_id)
      return { token, expires_at: new Date(Date.now() + 48 * 3600_000).toISOString() }
    }
    case 'free-set-pin': {
      const pid = inviteTokens.get(body.token)
      const p = db.people.find((x) => x.id === pid && x.active)
      if (!p) throw new Error('Convite inválido ou expirado (demo: gere um em Pessoas).')
      if (!body.pin) return { full_name: p.full_name, display_name: p.display_name }
      return { jwt: fakeJwt(p), display_name: p.display_name }
    }
    case 'free-login': {
      const phone = String(body.phone).replace(/\D/g, '')
      const p = db.people.find((x) => x.type === 'free' && x.active && x.phone === phone)
      if (!p) throw new Error('Telefone ou PIN incorretos. (demo: use 5511999990001)')
      return { jwt: fakeJwt(p), display_name: p.display_name }
    }
    case 'create-tenant': {
      if (body.action === 'list') {
        return db.restaurants.map((t) => ({
          ...t, people_count: db.people.filter((p) => p.restaurant_id === t.id && p.active).length,
        }))
      }
      if (body.action === 'set_status') {
        const t = db.restaurants.find((x) => x.id === body.restaurant_id)
        if (t) t.status = body.status
        return null
      }
      const rest = { id: uuid(), name: body.name, slug: body.slug, status: 'active', settings: { availability_lead_hours: 48, default_monthly_limit: 10 }, created_at: new Date().toISOString() }
      db.restaurants.push(rest)
      return { restaurant_id: rest.id, admin_email: body.admin_email, temp_password: 'demo-' + uuid().slice(0, 8) }
    }
    case 'export-csv': {
      const lines = ['pessoa;tipo;total_dias']
      for (const c of computeCounts().filter((x) => x.month === body.month)) {
        const p = db.people.find((x) => x.id === c.person_id)
        lines.push(`${p?.display_name ?? '?'};${p?.type.toUpperCase()};${c.days_worked}`)
      }
      return lines.join('\n')
    }
    default:
      throw new Error(`Função desconhecida no demo: ${name}`)
  }
}
