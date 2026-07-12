# ESPECIFICAÇÃO TÉCNICA — SaaS de Controle de Escalas para Restaurantes

> **Instruções para a IA executora:** Este documento é a especificação completa e fechada de um sistema. Seu papel é PROJETAR E IMPLEMENTAR o código conforme descrito aqui. Você NÃO tem acesso ao Supabase: gere todo o SQL (schema, RLS, seeds) como arquivos de migration numerados e as Edge Functions como arquivos prontos para deploy — o desenvolvedor humano aplicará tudo via Supabase CLI/painel. Não invente funcionalidades fora deste escopo. Quando algo não estiver especificado, escolha a opção mais simples e segura e documente a decisão em um arquivo `DECISIONS.md`.

---

## 1. Contexto e Objetivo

SaaS **multi-tenant** de controle de escalas para restaurantes. Cada restaurante (tenant) tem funcionários CLT (gerenciados pelo Admin, sem login) e freelancers "FREE" (com login, que declaram a própria disponibilidade). O Admin monta a escala combinando os dois grupos e publica uma mensagem-resumo em um grupo de WhatsApp.

**MVP para 1 cliente piloto, mas arquitetura multi-tenant desde o início.**

### Fora de escopo (NÃO implementar)
- Integração automática com WhatsApp (a mensagem é gerada e copiada manualmente)
- Pagamentos/cobrança
- Folha de pagamento, ponto eletrônico, compliance trabalhista
- App nativo / notificações push
- Coleta de CPF, RG, endereço ou dados bancários de qualquer pessoa

---

## 2. Stack Obrigatória

| Camada | Tecnologia |
|---|---|
| Frontend | React + Vite, SPA responsiva, TypeScript |
| Drag-and-drop | dnd-kit |
| Backend | Supabase: Postgres + RLS, Supabase Auth, Edge Functions (Deno/TypeScript) |
| Deploy frontend | **GitHub Pages** — gerar workflow de GitHub Actions que builda e publica a cada push na branch main |
| Estado/Data | supabase-js v2 + TanStack Query (ou equivalente simples) |

**Entregáveis esperados:**
```
/supabase/migrations/0001_schema.sql
/supabase/migrations/0002_rls.sql
/supabase/migrations/0003_seed_dev.sql
/supabase/functions/free-login/index.ts
/supabase/functions/free-set-pin/index.ts
/supabase/functions/create-invite/index.ts
/supabase/functions/create-tenant/index.ts
/supabase/functions/export-csv/index.ts
/src/... (frontend completo)
/.github/workflows/deploy.yml (build Vite + publicação no GitHub Pages)
/DECISIONS.md
/README.md (setup: env vars, aplicar migrations, deploy functions, rodar local)
```

**Requisitos específicos do GitHub Pages (obrigatórios):**
- `vite.config.ts` com `base: '/<nome-do-repo>/'` (documentar no README onde trocar)
- Roteamento compatível com SPA em Pages: usar **hash router** OU o padrão `404.html` que redireciona para `index.html` preservando a rota — escolher um e documentar em DECISIONS.md
- As env vars públicas (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) entram como GitHub Actions secrets/vars injetadas no build; lembrar que a anon key é pública por design (protegida por RLS) — jamais colocar a service role key no frontend ou no workflow

Variáveis de ambiente (usar placeholders, nunca valores reais): `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (só em Edge Functions), `FREE_JWT_SECRET`.

---

## 3. Papéis e Autenticação

| Papel | Autenticação | Escopo |
|---|---|---|
| **Root** | Supabase Auth (e-mail+senha, MFA TOTP habilitado) | Plataforma: cria tenants e Admins. Sem acesso operacional rotineiro; toda ação grava em audit_log |
| **Admin** | Supabase Auth (e-mail+senha) | 1 por restaurante. Configura tudo, monta escala, convoca |
| **FREE** | Telefone + PIN 6 dígitos, via Edge Function que emite JWT customizado | Marca disponibilidade, vê a própria escala publicada e contador mensal |
| **CLT** | **Sem login** | Registro passivo em `people` |

### Fluxo de autenticação do FREE
1. Admin cadastra o FREE → chama `create-invite` → recebe URL única (`/convite/{token}`)
2. Admin envia o link individualmente por WhatsApp (o link NUNCA vai no grupo)
3. FREE abre o link → `free-set-pin` valida token (hash, uso único, TTL 48h), exibe o nome para conferência, FREE aceita termo de uso e define PIN (argon2id ou bcrypt cost ≥ 12)
4. Logins seguintes: telefone + PIN → `free-login` → valida, retorna JWT customizado assinado com `FREE_JWT_SECRET`, claims: `{ person_id, restaurant_id, role: 'free', exp: 24h }`
5. O frontend envia esse JWT no header `Authorization`; as policies RLS de FREE leem os claims via `request.jwt.claims`
6. **PIN esquecido**: não há recuperação self-service — Admin gera novo convite, que reseta PIN e invalida sessões

### Proteções obrigatórias
- Rate limit no `free-login`: 5 falhas → bloqueio 15 min (progressivo: 30, 60), campos `failed_attempts`/`locked_until`
- Token de convite: ≥128 bits aleatórios, armazenar apenas hash SHA-256, uso único
- Nenhuma chave privilegiada no frontend: apenas `SUPABASE_ANON_KEY` (protegida por RLS)

---

## 4. Regras de Negócio (fonte da verdade)

1. **Timezone**: todo o sistema opera em `America/Sao_Paulo`. Datas de escala são `date` (sem hora). Cálculos de janela de antecedência SEMPRE no servidor/SQL, nunca no cliente.
2. **Turnos**: configuráveis por restaurante (nome, hora início, hora fim, cor). Mínimo 1. Ex. padrão do piloto: "Meio-dia" 11:00–15:00, "Noite" 18:00–23:00.
3. **Janela de antecedência**: valor em horas em `restaurants.settings` (`availability_lead_hours`, padrão 48). O FREE só pode criar/remover disponibilidade para a data D se `now() < (D 00:00 America/Sao_Paulo) - lead_hours`. Após fechar, só o Admin altera.
4. **Limite mensal**: `people.monthly_limit` (padrão vindo de `restaurants.settings.default_monthly_limit`, ex. 10). Conta **datas distintas** no mês com entrada de escala em status `convoked` ou `confirmed`. Atingido/excedido = **alerta visual apenas**; nunca bloquear. Exibir na UI: "Alerta gerencial — não é parecer trabalhista".
5. **Contagem "dia trabalhado"**: mesmo FREE em 2 turnos no mesmo dia = 1 dia para o limite; relatórios mostram também o total por turno.
6. **Estados da escala**: `schedule_entries.status`: `draft` → `convoked` → `confirmed` | `declined`. FREE só enxerga entradas próprias com status ≠ `draft`. `declined` reabre a vaga (a pessoa volta a aparecer como disponível para aquele dia/turno).
7. **Convocação em grupo**: a mensagem-resumo usa somente `display_name`. Nunca incluir telefone ou nome completo. Confirmações são registradas manualmente pelo Admin.
8. **Soft delete**: pessoas são desativadas (`active = false`), nunca apagadas; histórico de escala preservado. "Exclusão LGPD": função que anonimiza `full_name` e `phone` mantendo contagens.

---

## 5. Schema SQL (implementar exatamente; adicionar índices e constraints óbvios)

```sql
-- 0001_schema.sql (esqueleto — completar com tipos, defaults, FKs, índices)

create table restaurants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  status text not null default 'active' check (status in ('active','suspended')),
  settings jsonb not null default '{"availability_lead_hours":48,"default_monthly_limit":10}',
  created_at timestamptz not null default now()
);

-- Root e Admin (vinculados ao Supabase Auth)
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  restaurant_id uuid references restaurants(id),  -- null para root
  role text not null check (role in ('root','admin')),
  name text not null
);

create table shifts (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id),
  name text not null,
  start_time time not null,
  end_time time not null,
  color text not null default '#3b82f6',
  active boolean not null default true
);

create table people (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id),
  type text not null check (type in ('clt','free')),
  full_name text not null,
  display_name text not null,
  icon text,                      -- emoji ou cor
  phone text,                     -- obrigatório p/ free (validar em app), null p/ clt
  monthly_limit int,              -- null = usa default do restaurante
  fixed_days jsonb,               -- clt: ex. {"mon":["shift_id"],...} p/ pré-preencher
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table free_credentials (
  person_id uuid primary key references people(id) on delete cascade,
  pin_hash text,
  failed_attempts int not null default 0,
  locked_until timestamptz,
  last_login_at timestamptz
);

create table invites (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references people(id) on delete cascade,
  token_hash text not null,       -- sha256 do token; token em claro nunca é persistido
  expires_at timestamptz not null,
  used_at timestamptz
);

create table availability (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id),
  person_id uuid not null references people(id),
  date date not null,
  shift_id uuid not null references shifts(id),
  created_at timestamptz not null default now(),
  unique (person_id, date, shift_id)
);

create table schedule_entries (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id),
  person_id uuid not null references people(id),
  date date not null,
  shift_id uuid not null references shifts(id),
  status text not null default 'draft'
    check (status in ('draft','convoked','confirmed','declined')),
  convoked_at timestamptz,
  updated_by uuid,                -- profiles.id do admin
  updated_at timestamptz not null default now(),
  unique (person_id, date, shift_id)
);

create table audit_log (
  id bigint generated always as identity primary key,
  restaurant_id uuid,
  actor text not null,            -- 'admin:<uuid>' | 'root:<uuid>' | 'free:<uuid>' | 'system'
  action text not null,           -- ex. 'schedule.convoke', 'invite.create', 'person.anonymize'
  entity text not null,
  entity_id uuid,
  at timestamptz not null default now()
);
```

### Contadores (view)
Criar view `monthly_counts(person_id, month, days_worked, per_shift jsonb)` derivada de `schedule_entries` com `status in ('convoked','confirmed')`, contando `distinct date` por pessoa/mês. Nunca armazenar contador redundante em coluna.

---

## 6. RLS (0002_rls.sql) — requisito de segurança CRÍTICO

Habilitar RLS em TODAS as tabelas. Diretrizes:

- **Admin** (JWT do Supabase Auth): acesso total de leitura/escrita **apenas** onde `restaurant_id = (select restaurant_id from profiles where id = auth.uid())`. `profiles`: pode ler o próprio.
- **FREE** (JWT customizado; ler claims com `current_setting('request.jwt.claims', true)::jsonb`):
  - `availability`: SELECT/INSERT/DELETE somente `person_id = claim.person_id`; INSERT/DELETE adicionalmente restritos pela janela de antecedência (checar via função SQL `is_within_lead_window(date, restaurant_id)`)
  - `schedule_entries`: SELECT somente próprias e `status <> 'draft'`
  - `people`: SELECT somente o próprio registro (colunas sensíveis de terceiros jamais expostas)
  - `shifts`: SELECT do próprio restaurante
  - Nenhum outro acesso
- **Root**: NENHUMA policy de acesso direto — opera exclusivamente via Edge Functions com service role, que gravam em `audit_log`
- `free_credentials`, `invites`, `audit_log`: sem policies para anon/authenticated (acesso apenas via service role nas Edge Functions)

**Gerar também** `/tests/rls.test.sql` (ou script) com casos: Admin do tenant A tentando ler dados do tenant B (deve falhar), FREE tentando ler disponibilidade de outro FREE (deve falhar), FREE tentando inserir disponibilidade fora da janela (deve falhar), FREE tentando ler entrada `draft` (deve falhar).

---

## 7. Edge Functions (contratos)

Todas com service role; validar inputs (zod); registrar em `audit_log`; respostas JSON `{ ok, data? , error? }`.

| Função | Input | Comportamento |
|---|---|---|
| `create-tenant` | `{ name, slug, admin_email, admin_name }` (só Root) | Cria restaurant + usuário Auth do Admin + profile. Retorna credencial provisória |
| `create-invite` | `{ person_id }` (só Admin do tenant) | Gera token 128+ bits, salva hash, TTL 48h, invalida convites anteriores e reseta `pin_hash`. Retorna URL `/convite/{token}` |
| `free-set-pin` | `{ token, pin }` | Valida token (hash, não usado, não expirado), marca `used_at`, grava `pin_hash` (argon2id/bcrypt≥12). Retorna nome para conferência + JWT |
| `free-login` | `{ phone, pin }` | Aplica rate limit/lockout progressivo; valida PIN; retorna JWT customizado (claims: person_id, restaurant_id, role='free', exp 24h) |
| `export-csv` | `{ month }` (só Admin) | CSV do mês: pessoa, tipo, datas, turnos, total de dias |

---

## 8. Frontend — Páginas e Componentes

### Área Admin (otimizada para desktop, funcional no mobile)
- `/login` — Supabase Auth
- `/config` — turnos (CRUD), antecedência (horas), limite mensal padrão, template da mensagem
- `/pessoas` — abas CLT e FREE; CRUD; botão "Gerar convite" (mostra link p/ copiar); desativar; exibir contador do mês em cada card
- `/escala` — **tela principal**:
  - Alternância de visão: **Diária | Semanal | Mensal** (semanal é a default de trabalho)
  - Grade dias × turnos; chips de pessoas (ícone + display_name; CLT e FREE visualmente distintos)
  - Painel lateral por dia/turno: FREE **disponíveis**, ordenados por menor nº de dias no mês (distribuição justa), com badge de contagem; badge de alerta vermelho se ≥ limite
  - Drag-and-drop do painel → célula da grade (mobile: tap-to-assign)
  - CLT: atribuição direta + botão "aplicar dias fixos da semana"
  - Botão **Publicar dia/semana** (draft → convoked) → modal com a **mensagem-resumo** (template com `{dia}`, `{turno}`, `{horário}`, lista de `display_name`) + botão copiar
  - Em cada chip convocado: marcar ✔ confirmado / ✖ recusou (recusa reabre a vaga)
- `/relatorios` — totais do mês por pessoa (dias e turnos), taxa de confirmação, exportar CSV

### Área FREE (mobile-first, ≤3 toques para marcar)
- `/convite/{token}` — conferir nome, aceitar termo curto, definir PIN
- `/entrar` — telefone + PIN
- `/disponibilidade` — calendário dos dias abertos pela janela; toque alterna disponível/indisponível por turno; dias fechados aparecem travados
- `/minha-escala` — próximas convocações publicadas + "Você trabalhou X dias este mês"

### Área Root
- `/root` — lista de tenants, criar tenant (via Edge Function), suspender/reativar

### UX obrigatória
- Responsivo (breakpoints mobile/desktop); estados de loading e vazio; erros amigáveis em PT-BR; confirmação antes de ações destrutivas; todo texto da UI em português do Brasil.

---

## 9. Critérios de Aceite

1. Suite RLS passa: zero vazamento entre tenants e entre FREEs
2. FREE consegue: receber convite → definir PIN → logar → marcar disponibilidade em ≤3 toques → ver escala publicada e contador
3. Admin consegue: configurar turnos/antecedência → cadastrar pessoas → montar semana com drag-and-drop → publicar → copiar mensagem do grupo → registrar confirmações/recusas → ver relatório mensal e exportar CSV
4. Disponibilidade fora da janela é rejeitada pelo SERVIDOR (não só escondida na UI)
5. 5 PINs errados bloqueiam o login por 15 min
6. Mensagem-resumo nunca contém telefone ou nome completo
7. README permite ao desenvolvedor subir tudo do zero (migrations + functions + GitHub Pages) sem conhecimento prévio do projeto

## 10. Ordem de Implementação Sugerida

1. Migrations (schema → RLS → seed de desenvolvimento com 1 tenant, 2 turnos, 3 CLT, 5 FREE)
2. Edge Functions de auth (create-invite, free-set-pin, free-login) + testes
3. Frontend Admin: config + pessoas + escala (visão semanal primeiro)
4. Frontend FREE: convite/login/disponibilidade/minha-escala
5. Visões diária/mensal, relatórios, export, Root
6. Suite de testes RLS + revisão de segurança final
