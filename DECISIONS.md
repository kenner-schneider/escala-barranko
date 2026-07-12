# DECISIONS.md — decisões tomadas onde a spec deixou em aberto

1. **Roteamento SPA no GitHub Pages: hash router.** `HashRouter` do react-router. É a opção mais simples e à prova de 404 no Pages (nenhum redirect hack). URLs ficam `/#/escala`, `/#/convite/{token}`.

2. **JWT do FREE assinado com o JWT secret (legacy) do projeto Supabase.** Para as policies RLS lerem `request.jwt.claims`, o PostgREST precisa aceitar o token — o que exige assinatura com o secret do projeto. Portanto `FREE_JWT_SECRET` **deve ser configurado com o mesmo valor** do "JWT Secret" do painel Supabase. Claims: `{ person_id, restaurant_id, app_role: 'free', role: 'authenticated', exp: 24h }`. Usamos `role: 'authenticated'` (papel Postgres existente) + claim próprio `app_role: 'free'`, em vez de criar um papel Postgres novo. O token **não tem `sub`**, então `auth.uid()` é null e nenhuma policy de Admin casa com sessões FREE.

3. **Hash de PIN: bcryptjs custo 12.** Puro JS, roda no runtime das Edge Functions sem workers. O seed usa `crypt(..., gen_salt('bf', 12))` do pgcrypto, que gera `$2a$` — compatível com bcryptjs.

4. **`free-set-pin` tem modo "conferência".** Chamada só com `{ token }` valida e retorna o nome sem consumir o convite (a spec pede exibir o nome antes do aceite). Com `{ token, pin }` consome o token e grava o PIN.

5. **Telefone: só dígitos, único entre FREEs ativos (global).** O login é `telefone + PIN` sem seletor de tenant, então o telefone precisa ser globalmente único entre FREEs ativos (índice parcial `uniq_free_phone`). Limitação aceita no MVP: um mesmo telefone não pode ser FREE em dois restaurantes.

6. **`create-tenant` concentra as operações do Root** (`create` | `list` | `set_status`). A spec proíbe acesso direto do Root via RLS, mas o painel `/root` precisa listar e suspender tenants — a alternativa seria criar funções extras fora da lista de entregáveis. Tudo passa pela service role e grava em `audit_log`.

7. **URL do convite é montada no frontend** (`{origin}{base}#/convite/{token}`). A Edge Function retorna apenas o token — ela não conhece o domínio do Pages.

8. **`monthly_counts` é uma view com `security_invoker = true`.** A RLS de `schedule_entries` se aplica a quem consulta: Admin vê o tenant, FREE vê só a si.

9. **Anonimização LGPD (`anonymize_person`)**: limpa `full_name` e `phone`, desativa a pessoa, apaga credenciais/convites e disponibilidades futuras. **Mantém `display_name`** para o histórico de escala continuar legível (a spec pede anonimizar full_name e phone).

10. **Janela de antecedência no cliente usa UTC-3 fixo** (Brasil não tem horário de verão desde 2019) — apenas para a UI travar dias fechados. Quem decide de verdade é `is_within_lead_window()` no Postgres, chamada pelas policies.

11. **CSV**: uma linha por pessoa — `pessoa;tipo;total_dias;turnos;datas`, separador `;` e BOM UTF-8 (abre direto no Excel PT-BR).

12. **Mensagem de publicação** inclui convocados + já confirmados do período (republicar mostra a lista completa atual, não só os novos).

13. **Seed (0003) é só para desenvolvimento.** Antes de `supabase db push` em produção, remova/mova `0003_seed_dev.sql`. Em produção o Root é criado manualmente (ver README) e o resto nasce via `create-tenant`.

14. **MFA TOTP do Root** é habilitado no painel do Supabase (Auth → MFA) e no primeiro login do Root — não é imposto por código no MVP.

15. **Rate limit de convites**: máx. 10/hora por tenant, além do lockout progressivo de PIN exigido pela spec.

16. **Backlog (fora do MVP, anotado do planejamento):** Admin marcar disponibilidade em nome do FREE pela UI; PWA; confirmação pelo próprio FREE no app; Evolution API.
