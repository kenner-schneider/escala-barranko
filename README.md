# Escala Barranko — SaaS de escalas para restaurantes

SaaS multi-tenant de controle de escalas: o Admin monta a escala combinando CLT (sem login)
e freelancers FREE (login por telefone + PIN), publica e copia a mensagem-resumo para o
grupo de WhatsApp. Multi-tenant com isolamento por RLS desde o início.

**Stack:** React + Vite + TypeScript (SPA, hash router) · Supabase (Postgres + RLS, Auth,
Edge Functions/Deno) · dnd-kit · TanStack Query · Deploy no GitHub Pages.

Decisões de projeto: ver [DECISIONS.md](DECISIONS.md).

---

## 1. Variáveis de ambiente

| Variável | Onde | O que é |
|---|---|---|
| `VITE_SUPABASE_URL` | frontend (`.env` local / GitHub Actions var) | URL do projeto Supabase |
| `VITE_SUPABASE_ANON_KEY` | frontend (`.env` local / GitHub Actions var) | anon key (pública por design, protegida por RLS) |
| `SUPABASE_URL` | Edge Functions | injetada automaticamente pelo Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Edge Functions | injetada automaticamente — **JAMAIS no frontend** |
| `FREE_JWT_SECRET` | Edge Functions (`supabase secrets set`) | **= JWT Secret (legacy) do projeto** (Settings → API). Assina o JWT do FREE |

Crie um `.env` na raiz para rodar local:

```
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=<anon key exibida pelo `supabase start`>
```

## 2. Rodar local (do zero)

Pré-requisitos: Node 20+, [Supabase CLI](https://supabase.com/docs/guides/cli), Docker.

```bash
npm install
supabase init          # se ainda não existir supabase/config.toml
supabase start         # sobe Postgres/Auth/PostgREST locais
supabase db reset      # aplica migrations 0001..0003 (schema + RLS + seed dev)

# Edge Functions (em outro terminal)
supabase secrets set FREE_JWT_SECRET=<JWT secret local — `supabase status` mostra>
supabase functions serve

npm run dev            # frontend em http://localhost:5173
```

Credenciais do seed dev: Admin `admin@dev.local` / `admin123456` · Root `root@dev.local` /
`root123456` · FREEs com PIN `123456` (telefones `5511999990001..3`).

## 3. Testes de RLS (rodar antes do piloto)

```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f tests/rls.test.sql
```

Sucesso = 4 notices `OK caso N` (sem exceptions). Cobre: vazamento entre tenants,
FREE lendo dados alheios, insert fora da janela e leitura de rascunho.

## 4. Deploy em produção

### 4.1 Supabase

1. Crie o projeto em supabase.com e conecte: `supabase link --project-ref <ref>`.
2. **Remova/mova `supabase/migrations/0003_seed_dev.sql`** (seed é só p/ dev) e rode
   `supabase db push`.
3. Deploy das functions:
   ```bash
   supabase functions deploy create-tenant create-invite free-set-pin free-login export-csv
   supabase secrets set FREE_JWT_SECRET=<JWT Secret do painel: Settings → API → JWT Secret>
   ```
4. Crie o usuário Root: painel → Authentication → Add user (e-mail + senha forte);
   depois no SQL Editor:
   ```sql
   insert into profiles (id, restaurant_id, role, name)
   values ('<uuid do usuário criado>', null, 'root', 'Root');
   ```
5. Habilite MFA TOTP (Authentication → MFA) e inscreva o Root no primeiro login.
6. Logado como Root em `/#/root`, crie o restaurante piloto — a função devolve a
   credencial provisória do Admin.

### 4.2 GitHub Pages

1. Ajuste `base` em [vite.config.ts](vite.config.ts) para `'/<nome-do-repo>/'`.
2. No repositório: Settings → Pages → Source = **GitHub Actions**.
3. Settings → Secrets and variables → Actions → **Variables**: crie
   `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` (a anon key é pública por design;
   a service role key **nunca** entra aqui).
4. Push na `main` → o workflow [.github/workflows/deploy.yml](.github/workflows/deploy.yml)
   builda e publica.

## 5. Mapa do sistema

| Rota | Papel | Descrição |
|---|---|---|
| `/#/login` | Admin | e-mail + senha (Supabase Auth) |
| `/#/escala` | Admin | grade Diária/Semanal/Mensal, drag-and-drop, publicar + copiar mensagem |
| `/#/pessoas` | Admin | CRUD CLT/FREE, gerar convite, desativar, LGPD |
| `/#/config` | Admin | turnos, antecedência, limite mensal, template da mensagem |
| `/#/relatorios` | Admin | dias por pessoa, taxa de confirmação, exportar CSV |
| `/#/convite/{token}` | FREE | conferir nome, aceitar termo, definir PIN |
| `/#/entrar` | FREE | telefone + PIN |
| `/#/disponibilidade` | FREE | marcar/desmarcar por dia+turno (dias fechados ficam travados) |
| `/#/minha-escala` | FREE | próximas convocações + contador do mês |
| `/#/root` | Root | tenants: criar, suspender, reativar |

Fluxo do FREE: Admin gera convite → envia o link **individualmente** no WhatsApp (nunca no
grupo) → FREE confere o nome, aceita o termo e cria PIN de 6 dígitos → nos próximos acessos
entra com telefone + PIN. PIN esquecido = Admin gera novo convite (reseta PIN e sessões).

Regras de negócio centrais: janela de antecedência decidida **no servidor** (RLS +
`is_within_lead_window`); limite mensal conta **datas distintas** com status
convocado/confirmado e gera **apenas alerta visual**; recusa reabre a vaga; mensagem do
grupo usa somente nome de exibição; pessoas nunca são apagadas (soft delete + anonimização
LGPD).
