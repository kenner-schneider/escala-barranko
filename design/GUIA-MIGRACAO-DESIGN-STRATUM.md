# Guia de Migração de Design — Escala Barranko → estilo **Stratum**

> **Para quem vai implementar (dev/IA):** este documento descreve **como aplicar o novo visual** ("Stratum": dark + claro comutável, vidro, acento laranja, grão) no app de produção **React + Vite + CSS puro**.
>
> **Referência viva:** o arquivo **`escala-stratum.html`** (entregue junto) contém **todo o CSS e HTML finais** já prontos e testados. Este `.md` explica **o que copiar, para onde, e o que NÃO fazer**. Quando em dúvida sobre um valor exato, **copie do `escala-stratum.html`** — ele é a fonte da verdade visual.

---

## 0. Objetivo e escopo (LEIA PRIMEIRO)

O objetivo é **trocar apenas a aparência** (a "pele") do app. A **estrutura, a ordem dos elementos e a lógica das páginas de produção permanecem EXATAMENTE como estão.**

### ✅ EM ESCOPO (o que muda)
- Paleta / design tokens (cores, sombras, raios) — **dois temas: escuro e claro**.
- Tipografia (troca das fontes).
- Estilo dos **botões**: vidro líquido (utilitários) + Shiny CTA laranja (ação primária).
- **Superfícies de vidro** (backdrop-blur), **texturas** (grão + halo de acento).
- **Toggle de tema** claro/escuro no cabeçalho (feature nova, pedida).
- **Cabeçalho** (topnav) retexturizado.
- Substituir **emojis por ícones SVG**.
- Remover **"dots" decorativos** (indício de IA).

### 🚫 FORA DE ESCOPO (NÃO alterar)
- **A ordem/sequência dos elementos** em `Escala.tsx` (ex.: o card "Equilíbrio" continua **acima** da grade, como na produção — **não reordenar**).
- A **estrutura de componentes** e o **JSX de layout** (não quebrar em novos componentes, não reagrupar toolbar, etc.).
- A **lógica de negócio**, queries, mutations, roteamento, permissões.
- **Não adicionar** features novas do protótipo que não sejam o tema: nada de legenda de status nova, date-picker, painel colapsável, estado-vazio redesenhado ou "clusters" de toolbar — **isso é reskin, não reengenharia**.

> ⚠️ O protótipo `escala-stratum.html` mostra uma **reorganização** da tela (grade como herói, equilíbrio colapsável, toolbar em clusters). **Ignore a reorganização.** Use o HTML só como **referência de estilo** (cores, vidro, botões, texturas). Aplique esse estilo sobre a **DOM atual de produção, na ordem atual.**

### Arquivos de produção afetados
| Arquivo | O que muda |
|---|---|
| `src/index.css` | Núcleo: tokens dos 2 temas, fontes, e todas as regras de componente reescritas para o visual Stratum. |
| `src/components/AdminShell.tsx` | Cabeçalho: logo SVG, wordmark, **botão de toggle de tema**; injeção do filtro SVG do vidro + camadas de textura (grão/halo). |
| `src/main.tsx` (ou `AdminShell`) | Inicialização do tema (`data-theme` no `<html>` + localStorage). |
| `src/pages/admin/Escala.tsx` | Trocar emojis por SVG (labels de stats, título do Equilíbrio, botão de toggle, setas ←/→, fallback 👤). **Sem mudar a ordem.** |
| Demais telas (`Pessoas`, `Config`, `Relatorios`, `Login`, telas FREE) | Herdam tokens/estilos automaticamente; trocar emojis remanescentes por SVG quando quiserem. |

---

## 1. Design Tokens — colar no topo de `src/index.css`

Substituir o bloco `:root { … }` atual (tema "Brasa") por estes **dois blocos**. O tema é escolhido pelo atributo `data-theme` no `<html>`.

```css
/* ---------- TOKENS: ESCURO (padrão) ---------- */
:root{
  color-scheme:dark;
  /* Acento e status (iguais nos 2 temas) */
  --accent:#f97316; --accent-2:#ea580c;
  --accent-ink:#fb923c;                 /* texto de acento legível no fundo */
  --accent-soft:rgba(249,115,22,.14);
  --accent-line:rgba(249,115,22,.42);
  --glow:0 0 8px rgba(249,115,22,.55);
  --success:#22c55e; --success-soft:rgba(34,197,94,.14);
  --danger:#ef4444;  --danger-soft:rgba(239,68,68,.14);
  --amber:#f59e0b; --violet:#a78bfa; --sky:#60a5fa;

  /* Superfícies */
  --bg:#09090b;
  --bg-grad:radial-gradient(circle at 30% -18%, #292a2e 0%, #0b0b0d 52%);
  --ink:#e4e4e7; --ink-strong:#fafafa; --muted:#a1a1aa; --dim:#7c7c86;
  --glass:rgba(255,255,255,.035); --glass-2:rgba(255,255,255,.07);
  --panel:rgba(24,24,27,.6); --panel-blur:14px;
  --border:rgba(255,255,255,.09); --border-2:rgba(255,255,255,.16); --swatch-border:#3f3f46;
  --shadow:0 20px 40px rgba(0,0,0,.4);
  --glass-shadow:rgba(0,0,0,.35); --rim-hi:rgba(255,255,255,.5); --rim-hi-2:rgba(255,255,255,.34);
  --zebra:rgba(255,255,255,.016); --row-hover:rgba(249,115,22,.07);
  --cell:rgba(255,255,255,.008); --cell-hover:rgba(255,255,255,.045); --weekend:rgba(0,0,0,.22);
  --nav-bg:rgba(10,10,12,.7);
  --grain-op:.055; --grain-blend:overlay; --halo-op:1;

  /* Chips por status (cor de texto varia por tema) */
  --chip-convoked:#fed7aa; --chip-confirmed:#bbf7d0; --chip-declined:#fecaca;
  /* Lua "apagada" (disponível) — adapta via var() dentro do SVG */
  --moon-body:#3f3f46; --moon-crater:#52525b; --moon-stroke:#a1a1aa;

  --radius:14px; --tap:44px;
  --font:'DM Sans',system-ui,-apple-system,'Segoe UI',sans-serif;
  --mono:'JetBrains Mono',ui-monospace,SFMono-Regular,Menlo,monospace;
  --ease:cubic-bezier(.2,.7,.2,1);
}

/* ---------- TOKENS: CLARO ---------- */
:root[data-theme="light"]{
  color-scheme:light;
  --accent-ink:#c2410c;
  --accent-soft:rgba(249,115,22,.13);
  --accent-line:rgba(234,88,12,.4);
  --glow:0 0 8px rgba(249,115,22,.35);
  --success-soft:rgba(34,197,94,.16); --danger-soft:rgba(239,68,68,.12);

  --bg:#f2efe9;
  --bg-grad:radial-gradient(circle at 30% -18%, #ffffff 0%, #ece7df 55%);
  --ink:#2b2a28; --ink-strong:#1a1917; --muted:#57534e; --dim:#8a847c;
  --glass:rgba(255,255,255,.62); --glass-2:rgba(255,255,255,.9);
  --panel:rgba(255,255,255,.7);
  --border:rgba(41,37,33,.11); --border-2:rgba(41,37,33,.18); --swatch-border:#cfc7bb;
  --shadow:0 18px 38px rgba(60,50,40,.14);
  --glass-shadow:rgba(60,50,40,.16); --rim-hi:rgba(255,255,255,.95); --rim-hi-2:rgba(255,255,255,.7);
  --zebra:rgba(41,37,33,.022); --row-hover:rgba(249,115,22,.08);
  --cell:rgba(255,255,255,.35); --cell-hover:rgba(249,115,22,.06); --weekend:rgba(41,37,33,.04);
  --nav-bg:rgba(250,248,244,.78);
  --grain-op:.04; --grain-blend:multiply; --halo-op:.5;

  --chip-convoked:#9a3412; --chip-confirmed:#15803d; --chip-declined:#b91c1c;
  --moon-body:#e7e3db; --moon-crater:#c7c0b4; --moon-stroke:#9a938a;
}
```

**Regra de ouro:** daqui pra frente, **nenhuma cor hardcoded** nas regras de componente — sempre via `var(--…)`. É o que faz os dois temas funcionarem.

> Observação sobre nomes antigos: a produção usava `--primary`, `--surface`, `--text`, `--muted`, `--border`, `--danger`, `--success`. Mapeie:
> `--primary → --accent` · `--surface → --panel`/`--glass` · `--text → --ink` · mantidos: `--muted`, `--border`, `--danger`, `--success`. Faça um "find & replace" cuidadoso no `index.css`.

---

## 2. Tipografia

Trocar as fontes (produção usava Bricolage Grotesque + Karla) por **DM Sans** (corpo/títulos) + **JetBrains Mono** (micro-labels técnicos).

No `<head>` do `index.html` da produção:

```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet" />
```

- `body`, `h1/h2/h3` → `font-family: var(--font)` (DM Sans). Títulos com `font-weight:700; letter-spacing:-.02em`.
- Micro-labels (código de semana, "de N", contagens, rótulos de eixo) → classe utilitária `.mono { font-family:var(--mono); font-variant-numeric:tabular-nums }`.
- **Reduzir CAIXA-ALTA**: usar maiúsculas só nos micro-labels em mono (ex.: "ESCALA", "SEG"), não em textos de conteúdo.

---

## 3. Texturas globais (grão + halo)

Adicionar **duas camadas fixas** e o **filtro SVG do vidro** uma única vez, no layout raiz do admin (`AdminShell.tsx`, logo dentro do fragmento de retorno, antes do `<header>`):

```tsx
{/* Filtro SVG do vidro líquido — usado por backdrop-filter:url(#liquid-glass) */}
<svg className="sr-only" aria-hidden="true"><defs>
  <filter id="liquid-glass" x="0%" y="0%" width="100%" height="100%" colorInterpolationFilters="sRGB">
    <feTurbulence type="fractalNoise" baseFrequency="0.05 0.05" numOctaves="1" seed="2" result="noise"/>
    <feGaussianBlur in="noise" stdDeviation="1.4" result="blur"/>
    <feDisplacementMap in="SourceGraphic" in2="blur" scale="40" xChannelSelector="R" yChannelSelector="B"/>
  </filter>
</defs></svg>

<div className="halo" aria-hidden="true"></div>
<div className="grain" aria-hidden="true"></div>
```

CSS (copiar de `escala-stratum.html`, seção "Texturas globais"):

```css
.halo{position:fixed; inset:0; z-index:0; pointer-events:none; overflow:hidden; opacity:var(--halo-op)}
.halo::before{content:""; position:absolute; top:-12%; left:50%; transform:translateX(-50%);
  width:62%; height:44%; background:rgba(249,115,22,.07); filter:blur(130px); border-radius:50%}
.grain{position:fixed; inset:0; z-index:2; pointer-events:none; opacity:var(--grain-op); mix-blend-mode:var(--grain-blend);
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
  background-size:200px 200px}
```

- Garanta que o conteúdo do app fique em uma camada com `position:relative; z-index:1` (o `<main class="page">` já serve; se precisar, envolva o app num `.wrap{position:relative;z-index:1}`).
- `.sr-only` já pode existir; se não, adicione o utilitário padrão de leitor de tela.

---

## 4. Toggle de tema (claro/escuro)

### 4.1 Inicialização (uma vez, cedo — em `src/main.tsx` antes do render, ou num `useEffect` no `AdminShell`)

```ts
const saved = localStorage.getItem('escala.theme');
const initial = saved ?? (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
document.documentElement.setAttribute('data-theme', initial);
```

### 4.2 Botão no cabeçalho (`AdminShell.tsx`)

```tsx
function ThemeToggle() {
  const [theme, setTheme] = useState<'dark' | 'light'>(
    () => (document.documentElement.getAttribute('data-theme') as 'dark' | 'light') || 'dark'
  )
  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    document.documentElement.setAttribute('data-theme', next)
    localStorage.setItem('escala.theme', next)
    setTheme(next)
  }
  return (
    <button className="glass icon theme-toggle" onClick={toggle}
      aria-label="Alternar tema claro/escuro">
      <span className="ti sun"><SunToggleIcon /></span>
      <span className="ti moon"><MoonToggleIcon /></span>
    </button>
  )
}
```

Os SVGs `SunToggleIcon`/`MoonToggleIcon` e o CSS `.theme-toggle .ti { … }` (crossfade dos ícones por tema) estão prontos em `escala-stratum.html` — copie de lá. Detalhe importante: as regras usam `:root[data-theme="dark"] .theme-toggle .sun{…}` e `…light… .moon{…}` para mostrar o ícone certo.

---

## 5. Botões: **Liquid Glass** + **Shiny CTA**

O usuário **rejeitou os botões antigos**. Novo padrão:

| Botão de produção | Vira | Classe nova |
|---|---|---|
| `.btn` (utilitário/secundário: "Aplicar dias fixos", "Hoje", "Sair", "Ocultar equilíbrio") | **Vidro líquido** | `.glass` (+ `.sm` para pequeno, `.icon` para só-ícone) |
| `.btn.primary` ("Publicar semana", "Publicar dia") | **Shiny CTA** laranja | `.shiny` (conteúdo dentro de `<span>`) |
| `.btn-icon`, setas `←`/`→` | **Vidro ícone** | `.glass.icon` (44×44) |

O CSS completo de `.glass` (com os pseudo-elementos `::before` = backdrop distorcido e `::after` = rima de vidro) e de `.shiny` (borda cônica animada com `@property --ga`) está em `escala-stratum.html`. **Copie as duas seções inteiras** ("LIQUID GLASS BUTTON" e "SHINY CTA").

Pontos de atenção:
- O `.shiny` usa `<span>` interno para o conteúdo (texto/ícone acima do brilho). Ao migrar `<button className="btn primary">Publicar…</button>`, envolva o conteúdo: `<button className="shiny"><span>…</span></button>`.
- **Sem os pontos**: a versão final do `.shiny` **não tem** o `::before` de padrão de pontos — só o `::after` de brilho interno. Não reintroduza o padrão pontilhado.
- Estado `disabled` do CTA: manter (`.shiny:disabled{opacity:.5;cursor:not-allowed}`), e é recomendável exibir a contagem de rascunhos como `<span class="count">N</span>` dentro do botão (só visual; a lógica de `disabled` continua a mesma).

---

## 6. Regra "**sem dots**" (indício de IA)

- **Não usar** pontinhos decorativos (bolinhas pulsantes, dots de status ao lado de textos, padrão pontilhado dentro de botões).
- Onde a produção usa um **dot de cor para setor** (`.area-tab .area-dot`, um círculo), troque por um **swatch quadrado** com cantos levemente arredondados:

```css
.seg-swatch{width:11px; height:11px; border-radius:3px; background:var(--sw);
  box-shadow:inset 0 0 0 1px rgba(255,255,255,.25)}
```

Uso: `<span class="seg-swatch" style={{'--sw': area.color}} />`. Mantém a informação (cor do setor) sem a estética de "bolinha".

---

## 7. Ícones: **emoji → SVG**

Substituir todos os emojis de chrome por ícones SVG de traço (padrão Lucide/Heroicons, `stroke-width:2`, `viewBox 0 0 24 24`). **Os ícones de turno sol/lua já são SVG** em `Escala.tsx` (`SunIcon`/`MoonIcon`/`ShiftIcon`) — **mantê-los**, apenas ajustar as cores do estado "apagado/disponível" para usar as vars de tema (ver §8).

| Local (arquivo:linha aprox.) | Emoji atual | Trocar por (SVG) |
|---|---|---|
| `AdminShell.tsx:59` marca | `📋` | ícone "clipboard" (ver logo em §9) |
| `Escala.tsx:331` botão | `⚖️ Equilíbrio` | ícone "scale" |
| `Escala.tsx:672` título | `⚖️ Equilíbrio da semana` | ícone "scale" |
| `Escala.tsx:678` ordenar | `⚖️ Menos escalados` | ícone "scale/arrow-down" |
| `Escala.tsx:691/695/703/708/713` stat-labels | `✅ 📊 🔻 🔺` | check-circle / bar-chart / arrow-down / arrow-up |
| `Escala.tsx:324/326` navegação | `← →` | chevron-left / chevron-right |
| `Escala.tsx:446/519/544` avatar fallback | `👤` | ícone "user" dentro de um círculo `.av` |
| `ui.tsx:28`, `Escala.tsx:418/551` fechar/remover | `✕` | ícone "x" (pode manter `✕` se preferir, mas SVG é o padrão) |
| `Config.tsx:255`, `ui.tsx:57` sucesso | `✓ Salvo/Copiado` | ícone "check" |

> `person.icon` (ex.: `⭐`, `🍪`) é **dado do usuário** (cada pessoa tem um ícone). **Não** remova — apenas garanta que o **fallback** `👤` vire um SVG "user" num avatar circular `.av`. Todos os SVGs necessários já existem no `escala-stratum.html` (copie de lá).

---

## 8. Ajuste dos ícones sol/lua (turnos) para os 2 temas

Em `Escala.tsx`, `MoonIcon`/`SunIcon` têm o estado **"apagado"** (`on=false`, = disponível) com cinzas fixos. Para funcionar no tema claro, troque esses fixos por **variáveis CSS** (SVG aceita `fill="var(--…)"`):

```tsx
// MoonIcon, quando on === false (apagada/disponível):
const body   = on ? '#FBE27A' : 'var(--moon-body)'
const crater = on ? '#F7CE46' : 'var(--moon-crater)'
const stroke = on ? '#26201A' : 'var(--moon-stroke)'   // usar em stroke dos círculos
```

O estado **"aceso"** (`on=true`, escalado) mantém as cores vibrantes (amarelo/laranja) — funcionam bem nos dois temas. Idem `SunIcon`.

---

## 9. Cabeçalho (topnav) retexturizado

Estrutura visual (mantendo os mesmos links de navegação e o botão Sair já existentes):

```
[ logo-mark SVG ]  Barranko / ESCALAS   |   Escala  Pessoas  Relatórios  Config   ……  [ 🌗 toggle ]  [ Sair ]
```

- **Logo-mark**: tile 38×38 com gradiente laranja + grão interno + bevel de luz; ícone "clipboard" branco dentro.
- **Wordmark** em duas linhas: `Barranko` (forte) + `ESCALAS` (mono, tracking largo, cor `--accent-ink`).
- Fundo do header: `--nav-bg` + `backdrop-filter:blur(16px) saturate(1.2)`, um **brilho radial de acento** (`::before`) e uma **hairline luminosa** de acento na base (`::after`).

Todo o CSS (`.topnav`, `.topnav::before/::after`, `.brand .logo`, `.brand .name`, `.brand-div`, `.topnav nav a`) e o markup estão prontos em `escala-stratum.html`, seção "CABEÇALHO". Copie e encaixe no `<header className="topnav">` do `AdminShell.tsx`, preservando os `<NavLink>` atuais.

---

## 10. Mapeamento de componentes (produção → Stratum)

Para **cada** classe abaixo, copie a regra correspondente do `escala-stratum.html`. A ordem no DOM **não muda** — só o estilo.

| Classe de produção | Novo estilo (referência no HTML) |
|---|---|
| `.card` | `.card` + `.glass-surface` (vidro: `background:var(--panel)`, blur, borda `--border`, sombra) |
| `.schedule-toolbar` | `.toolbar` (mesma barra; **não** precisa virar "clusters" — só reskin) |
| `.view-switch`, `.area-switch` | `.segmented` (segmented control de vidro; ativo = gradiente laranja) |
| `.area-tab .area-dot` | `.seg-swatch` (quadrado, §6) |
| `table.schedule`, `th`, `td.cell`, `.today`, `.shift-label`, `.cell-avail` | seção "GRADE" |
| `.chip` + `.clt/.free/.draft/.confirmed/.declined` | seção "Chips" (cores de texto via `--chip-*`) |
| `.balance-card/.balance-head/.balance-stats/.stat` | seção "Equilíbrio" |
| `table.balance`, zebra, `.week-count`, `.bar` | seção "Equilíbrio" (zebra via `--zebra`, hover `--row-hover`) |
| `.pill`, `.pill.icon-pill` | `.pill` (44×44, `--tap`) |
| `.badge`, `.badge.over` | seção "Painel de atribuição" |
| `.side-panel`, `.person-row`, `.person-list` | seção "Painel de atribuição" |
| `.modal`, `.alert`, `.empty`, `.spinner`, `.form/.field` | reestilizar com tokens (`--panel`, `--border`, `--ink`, `--danger-soft`, etc.) |
| `.bottomnav` (telas FREE) | mesmo tratamento de vidro do `.topnav` |

**Acessibilidade / toque:** manter `--tap:44px` em botões, setas, `.pill`, `.add`, `✕`. Contraste já foi calibrado nos tokens (o texto de acento **escurece** no tema claro via `--accent-ink`).

---

## 11. Compatibilidade de navegador

- O **vidro líquido** usa `backdrop-filter: url(#liquid-glass)` — recurso **Chromium** (Chrome/Edge/mobile Chrome). Em Firefox/Safari o `::before` cai para `blur()` simples: o botão ainda fica com aspecto de vidro fosco (degradação graciosa, já embutida). **Nada quebra.**
- `@property` (borda animada do Shiny CTA) — Chromium/Safari recentes; em navegadores sem suporte a borda fica estática (ainda válida).
- `@media (prefers-reduced-motion: reduce)` já desliga as animações (incluindo o Shiny) — manter.
- Testar nos dois temas em 375 / 768 / 1024 / 1440 px.

---

## 12. Checklist de implementação

- [ ] `index.css`: substituir `:root` pelos **dois blocos de tokens** (§1); find&replace de nomes antigos (`--primary→--accent`, etc.).
- [ ] `index.html`: trocar `<link>` das fontes para **DM Sans + JetBrains Mono** (§2).
- [ ] `AdminShell.tsx`: injetar filtro SVG `#liquid-glass` + `.halo` + `.grain` (§3); reconstruir `<header>` (§9); adicionar `<ThemeToggle/>` (§4).
- [ ] `main.tsx`: inicializar `data-theme` (localStorage → prefers-color-scheme) (§4.1).
- [ ] `index.css`: reescrever **cada** regra de componente com tokens, copiando do `escala-stratum.html` (§10). **Sem cores hardcoded.**
- [ ] Botões: `.btn`→`.glass`, `.btn.primary`→`.shiny` (com `<span>` interno), `.btn-icon`/setas→`.glass.icon` (§5).
- [ ] Trocar emojis por SVG (§7); ajustar `MoonIcon/SunIcon` "apagado" para vars de tema (§8).
- [ ] Trocar dots de setor por `.seg-swatch` (§6). Conferir que **não sobrou nenhum dot decorativo**.
- [ ] **Conferência final:** a **ordem/estrutura** das telas está **idêntica** à produção anterior (só o visual mudou). ✅
- [ ] Testar toggle de tema (persistência + primeira visita), Chromium vs Firefox/Safari, e responsividade.

---

## Anexo — onde achar cada coisa no `escala-stratum.html`

| Preciso de… | Procure no HTML por (comentário/seletor) |
|---|---|
| Tokens dos 2 temas | `:root{` e `:root[data-theme="light"]{` |
| Filtro do vidro | `<filter id="liquid-glass">` |
| Texturas | `.halo`, `.grain` |
| Cabeçalho | `/* ===== CABEÇALHO ===== */`, `.topnav`, `.brand` |
| Toggle de tema | `.theme-toggle`, `#themeToggle`, `<script>` no fim |
| Botão vidro | `/* LIQUID GLASS BUTTON */`, `.glass` |
| Shiny CTA | `/* SHINY CTA */`, `.shiny`, `@property` |
| Segmented / swatch | `.segmented`, `.seg-swatch` |
| Grade / chips / equilíbrio / pills | seções "GRADE", "Chips", "Equilíbrio", "Pills sol/lua" |

> **Fonte da verdade visual = `escala-stratum.html`.** Este guia diz *o que fazer e o que preservar*; o HTML entrega *os valores exatos*. Em conflito, siga o HTML para estilo e este `.md` para **escopo e ordem**.
