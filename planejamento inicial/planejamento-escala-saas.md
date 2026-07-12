# App Barranko Escala — Documento de Requisitos e Planejamento

**Versão:** 1.0 · **Data:** 11/07/2026 · **Responsável:** Kenner
**Status:** Planejamento aprovado para MVP com cliente piloto

---

## 1. Visão Geral

SaaS multi-tenant de controle de escalas para restaurantes, gerenciando em conjunto o efetivo CLT (controlado pelo Admin) e freelancers (que declaram a própria disponibilidade). O MVP será validado com **um cliente piloto**, mas a arquitetura nasce multi-tenant.

**Proposta de valor:** o gerente para de montar escala em papel/planilha/grupo de WhatsApp. Vê quem está disponível, arrasta pra escala, e a convocação sai pronta pro WhatsApp.

**Fora de escopo do MVP:** conformidade trabalhista formal, folha de pagamento, ponto eletrônico, integração automática com WhatsApp, cobrança automatizada (piloto é cobrado manualmente).

---

## 2. Papéis e Permissões

| Papel | Quantidade | Acesso | Capacidades |
|---|---|---|---|
| **Root** | 1 (plataforma) | Login próprio | Cria/suspende restaurantes (tenants), cria conta Admin, métricas da plataforma. **Não vê dados operacionais dos tenants no dia a dia.** |
| **Admin** | 1 por restaurante | E-mail + senha (Supabase Auth) | Configura turnos, antecedência, limites; cadastra CLT e FREE; monta escala; convoca; vê contadores mensais |
| **FREE** | N por restaurante | Telefone + PIN (convite único) | Marca disponibilidade dentro da janela; vê a própria escala e o próprio contador mensal |
| **CLT** | N por restaurante | **Sem login** | Entidade passiva — existe apenas como registro na escala |

**Decisões de segurança embutidas:**
- CLT sem login = menos credenciais pra proteger, menos dados coletados.
- Root sem acesso operacional rotineiro = princípio do menor privilégio; qualquer acesso de suporte deve ser logado.

---

## 3. Requisitos Funcionais

### RF-01 · Gestão de Tenants (Root)
- Criar restaurante (nome, slug) e a conta Admin inicial
- Suspender/reativar tenant
- Painel simples: tenants ativos, nº de usuários, último acesso

### RF-02 · Configuração do Restaurante (Admin)
- **Turnos configuráveis**: nome, horário início/fim, cor (ex.: "Meio-dia 11h–15h", "Noite 18h–23h"). Mínimo 1, sem máximo rígido
- **Antecedência de disponibilidade**: janela em que o FREE pode marcar (ex.: "até 48h antes do dia" ou "disponibilidade da semana N fecha domingo da semana N-1")
- **Limite mensal por FREE**: nº máximo de dias/mês que dispara alerta (padrão sugerido configurável)

### RF-03 · Gestão de Pessoas (Admin)
- **CLT**: nome completo, nome de exibição, ícone/cor, dias fixos de trabalho (opcional, para pré-preencher escala)
- **FREE**: nome completo, nome de exibição, ícone/cor, telefone (WhatsApp)
- Gerar convite do FREE: link único, expira em 48h, uso único, enviado manualmente via WhatsApp
- Desativar pessoa (soft delete — histórico de escalas é preservado)

### RF-04 · Disponibilidade (FREE)
- Ver calendário dos próximos dias abertos pela janela de antecedência
- Marcar/desmarcar disponibilidade por **dia + turno**
- Após o fechamento da janela, disponibilidade fica travada (só o Admin pode alterar)
- Ver a própria escala confirmada e o contador "X dias trabalhados este mês"

### RF-05 · Montagem de Escala (Admin)
- **Visão diária**: colunas por turno, escalados CLT + FREE
- **Visão semanal** (principal para montagem): grade dias × turnos
- **Visão mensal**: panorama + totais por pessoa
- Painel lateral por dia/turno: lista de FREE **disponíveis**, ordenável por "quantas vezes já trabalhou no mês" (distribuição justa de vagas)
- **Arrastar e soltar** (ou tap-to-assign no mobile) do painel "Disponíveis" para "Convocados"
- CLT entra na escala por atribuição direta do Admin (com pré-preenchimento por dias fixos, se configurado)
- Alerta visual (badge/cor) quando um FREE atinge o limite mensal — **não bloqueia**

### RF-06 · Convocação via WhatsApp (grupo)
- A convocação é publicada no **grupo de WhatsApp onde estão todos os FREE** do restaurante
- Ao confirmar convocados de um dia/turno (ou da semana), gerar mensagem-resumo com template editável:
  > "📋 Escala {dia} — {turno} ({horário}):
  > • {nome_exibição_1}
  > • {nome_exibição_2}
  > Convocados: confirmem com 👍 aqui no grupo."
- Botão **"copiar mensagem"** (dia/turno ou semana inteira) — o Admin cola no grupo
- **Privacidade**: a mensagem usa somente nome de exibição; nunca inclui telefone ou nome completo
- Registrar status manual: convocado → confirmado / recusou (Admin marca com base nas respostas no grupo)
- O telefone individual do FREE continua sendo coletado apenas para envio do **link de convite** (que é pessoal e nunca vai no grupo)

### RF-07 · Contadores e Relatórios
- Por pessoa: dias trabalhados no mês corrente e no anterior, quebrados por turno
- Por restaurante: total de convocações no mês, taxa de confirmação
- Exportar mês em CSV (simples, para o Admin guardar)

---

## 4. Requisitos Não Funcionais

### RNF-01 · Segurança
- **Isolamento multi-tenant no banco**: toda tabela carrega `restaurant_id`; RLS obrigatório em todas as tabelas — nenhuma query cruza tenant, mesmo com bug no frontend
- **Auth Admin/Root**: Supabase Auth (e-mail + senha), senha forte obrigatória, e MFA (TOTP) para Root
- **Auth FREE**: telefone + PIN 6 dígitos; PIN armazenado com bcrypt/argon2; convite com token aleatório ≥128 bits, hash no banco, uso único, TTL 48h
- **Rate limiting**: 5 tentativas de PIN → bloqueio 15 min (progressivo); rate limit também em geração de convites
- **Sessões**: JWT curto (Supabase padrão) + refresh; logout invalida refresh
- **Transporte**: HTTPS em tudo (padrão Supabase/Vercel), HSTS
- **Logs de auditoria**: quem convocou, quem alterou escala, acessos do Root a dados de tenant
- **Sem segredo no frontend**: apenas anon key do Supabase (protegida por RLS); operações privilegiadas (gerar convite, criar tenant) via Edge Functions com service role

### RNF-02 · Privacidade / LGPD (minimização por design)
- **FREE**: apenas nome completo, nome de exibição, ícone, telefone. **Nunca coletar** CPF, RG, endereço, dados bancários no MVP
- **CLT**: apenas nome completo, nome de exibição, ícone (nem telefone é necessário)
- Base legal simples: execução de acordo/legítimo interesse para organização de escala; termo curto de aceite no primeiro acesso do FREE
- Direito de exclusão: desativar pessoa anonimiza nome/telefone e preserva contagens agregadas
- Retenção: dados de escala mantidos por 12 meses, depois agregados/anonimizados (configurável)

### RNF-03 · Usabilidade e Plataforma
- Web responsiva: Admin otimizado para desktop (grade semanal), FREE otimizado para celular (marcar disponibilidade em ≤3 toques)
- Funciona em Chrome/Safari mobile sem instalação; PWA (ícone na home) como melhoria posterior

### RNF-04 · Operação
- Supabase free tier no piloto; monitorar limites (500MB DB, 50k MAU — folgado)
- Backups: point-in-time do Supabase (plano pago quando houver 2+ clientes) + dump semanal automatizado para storage próprio
- Disponibilidade alvo do piloto: melhor esforço; sem SLA formal

---

## 5. Modelo de Dados (Supabase / Postgres)

```
restaurants        id, name, slug, status, settings_jsonb (antecedência, limite padrão), created_at
profiles           id (= auth.users.id), restaurant_id, role (root|admin), name
shifts             id, restaurant_id, name, start_time, end_time, color, active
people             id, restaurant_id, type (clt|free), full_name, display_name,
                   icon, phone (null p/ CLT), monthly_limit, fixed_days_jsonb (CLT), active
free_credentials   person_id (PK), pin_hash, failed_attempts, locked_until, last_login_at
invites            id, person_id, token_hash, expires_at, used_at
availability       id, restaurant_id, person_id, date, shift_id, created_at
                   UNIQUE(person_id, date, shift_id)
schedule_entries   id, restaurant_id, person_id, date, shift_id,
                   status (draft|convoked|confirmed|declined), convoked_at, updated_by
audit_log          id, restaurant_id, actor, action, entity, entity_id, at
```

**RLS (resumo):**
- Admin: `restaurant_id = (select restaurant_id from profiles where id = auth.uid())` em todas as tabelas
- FREE (sessão custom via Edge Function emitindo JWT com claims `person_id` + `restaurant_id`):
  - `availability`: SELECT/INSERT/DELETE apenas `person_id = jwt.person_id` **e** data dentro da janela de antecedência
  - `schedule_entries`: SELECT apenas as próprias
  - `people`: SELECT apenas o próprio registro
- Root: acesso via Edge Functions com service role, sempre gravando em `audit_log`

**Contadores** (dias/mês) são derivados de `schedule_entries` com `status IN (convoked, confirmed)` — view materializada ou query agregada; não armazenar contador redundante.

---

## 6. Fluxos Principais

**F1 · Onboarding do FREE**
Admin cadastra → sistema gera link de convite → Admin envia pelo WhatsApp → FREE abre, confere nome, define PIN, aceita termo → ativo.

**F2 · Ciclo semanal de escala**
1. Janela abre (conforme antecedência) → FREE marca disponibilidade
2. Janela fecha → Admin abre a visão semanal
3. Por dia/turno: vê disponíveis ordenados por contagem mensal → arrasta para convocados (alerta se limite atingido)
4. Confirma → gera mensagem-resumo → cola no grupo dos FREE → marca confirmações manualmente conforme as respostas
5. Visões diária/semanal/mensal refletem o estado em tempo real

**F3 · Dia a dia**
FREE abre o app → vê "você trabalha hoje: turno Noite" + contador do mês.

---

## 7. Arquitetura

```
Frontend  ── React + Vite (SPA responsiva), deploy Vercel/Cloudflare Pages
                │  (drag-and-drop: dnd-kit)
Backend   ── Supabase
                ├─ Postgres + RLS (isolamento por tenant)
                ├─ Supabase Auth (Root/Admin)
                ├─ Edge Functions: login FREE (PIN→JWT), gerar convite,
                │  criar tenant, export CSV
                └─ Storage (ícones/avatares, se necessário)
WhatsApp  ── mensagem-resumo gerada no cliente, colada no grupo (nenhuma integração)
```

Justificativas: RLS elimina a classe de bug mais perigosa do multi-tenant (vazamento entre clientes); Edge Functions concentram o que exige service role; frontend estático barato e sem servidor pra manter. Evolution API fica documentada como evolução v2 — você já domina a stack.

---

## 8. Roadmap

### Fase 0 — Fundação (semana 1–2)
- [ ] Projeto Supabase, schema, RLS, seeds
- [ ] Auth Admin + estrutura de tenant + conta Root
- [ ] Edge Functions: convite + login FREE (PIN)
- [ ] Esqueleto do frontend (rotas, layout, auth guard)

### Fase 1 — MVP funcional (semana 3–5)
- [ ] CRUD turnos, CLT, FREE (com convite)
- [ ] Tela de disponibilidade do FREE (mobile-first)
- [ ] Grade semanal com drag-and-drop + painel de disponíveis ordenado
- [ ] Convocação: template + botões wa.me + status manual
- [ ] Contadores mensais + alerta de limite
- [ ] Visões diária e mensal

### Fase 2 — Piloto (semana 6–8)
- [ ] Onboarding do restaurante piloto (dados reais)
- [ ] Acompanhamento de 2 ciclos semanais completos
- [ ] Audit log + export CSV
- [ ] Ajustes de UX com feedback do gerente e dos FREE

### Fase 3 — Pós-piloto (v1 comercial)
- [ ] Cobrança (taxa inicial + recorrência — Stripe/Asaas)
- [ ] PWA instalável + notificações push
- [ ] Automação WhatsApp (Evolution API) opcional por tenant
- [ ] Confirmação de convocação pelo próprio FREE no app

---

## 9. Riscos e Mitigações

| Risco | Impacto | Mitigação |
|---|---|---|
| FREE não adota o app (marca no WhatsApp mesmo) | MVP não valida | UX de ≤3 toques; Admin pode marcar disponibilidade em nome do FREE como fallback |
| Vazamento entre tenants | Crítico | RLS testada com suite específica (tentar ler tenant B logado no A) antes do piloto |
| Convite interceptado | Conta FREE comprometida | TTL 48h + uso único + FREE confere o próprio nome antes de criar PIN |
| Escopo cresce no piloto (pedidos do gerente) | Atraso | Este documento é o contrato de escopo; pedidos novos vão para backlog v1 |
| Limite mensal interpretado como compliance | Jurídico futuro | Deixar explícito na UI: "alerta gerencial, não parecer trabalhista" |

---

## 10. Critérios de Sucesso do Piloto

1. Gerente monta a escala semanal inteira no sistema (zero planilha) por 4 semanas seguidas
2. ≥70% dos FREE marcam disponibilidade sozinhos pelo app
3. Zero incidente de acesso indevido (validado por audit log)
4. Gerente responde "sim" a: "você pagaria por isso?"
