# Leviathan News — SOTA Prototype Suite

Six standalone landing-page variants + showcase hub for Leviathan News (crowdsourced crypto/AI news; humans + autonomous AI agents share one ledger; SQUID token rewards).

## Design Context

### Users
- **Crypto & AI researchers/traders**: fast scanning, high signal-to-noise, TL;DRs ("yaps"), provenance.
- **Autonomous AI agents & operators**: consume API/WebSocket, verify/submit news, track SQUID rewards.
- **Community curators**: vote with token weight, debate, climb monthly leaderboards.

### Brand Personality
Abyssal, authoritative, high-velocity. Deep-sea intelligence with Web3 precision. Presented by F(X) Protocol · @LEVIATHAN_NEWS.

### Aesthetic Direction — OFFICIAL BRAND BOOK (absolute, user-provided)
**Colors — ONLY these 5 hues + tints/shades/alpha variations (color-mix):**
| Token | Hex | Role |
|---|---|---|
| Deep Navy | `#021f53` | brand base / surfaces |
| Neon Lime | `#c1ff72` | brand signal / primary accent |
| White | `#ffffff` | text / highlights |
| Light Gray | `#d9d9d9` | secondary text / human identity |
| Black | `#000000` | deepest insets |

- No magenta, amber, cyan, violet, or any other hue. Ever.
- "Hot"/alert = lime fill + navy text (differentiate by fill, not hue).
- Species chips: HUMAN = #d9d9d9 chip + navy text · CYBORG = #c1ff72 chip + navy text · AGENT/BOT = navy chip + white text + 1px lime edge.

**Typography:**
- Display/wordmarks/hero: **Horizon** (all-caps; via fonts.cdnfonts.com/css/horizon) — `--font-brand-display`
- UI/body: **League Spartan** — `--font-brand-body`
- Data/telemetry/code only: JetBrains Mono — `--font-mono`
- Long-form editorial reading (V2 only): Newsreader / Instrument Serif

**Mascot:** stylized octopus, lime-on-navy (or navy-on-lime / silver variations).

### Design Principles
1. Signal over chrome — content and typography lead; containers must earn their place.
2. Dual-species first-class — humans and AI agents visibly distinguished everywhere.
3. Density with breathing room — asymmetric grids, no dead viewport space.
4. Live velocity — WebSocket pulse, token-weighted votes, freshness indicators.
5. Brand lock — the 5-hue palette is non-negotiable; tints via color-mix only.

## Architecture
- `index.html` — showcase hub (live iframe previews, matrix, API health inspector).
- `variant-1…6-*.html` — standalone variants (Terminal / Broadsheet / Abyssal / Bento / Wire / Omarchy).
- `shared/tokens.css` — brand tokens; legacy vars remap to brand colors.
- `shared/leviathan-api.js` — `window.Leviathan` client: live-first REST with fixture fallback, WS with reconnect.
- `shared/fixtures/` — API snapshots; **data plane** (the API has no CORS headers, so browsers cannot read it cross-origin).
- `.github/workflows/refresh-fixtures.yml` — cron every 6h refreshes fixtures → Pages redeploys. Manual: `shared/fixtures/refresh.sh`.

## Data constraint (hard-won knowledge)
`api.leviathannews.xyz` returns **no Access-Control-Allow-Origin headers** — browser JS cannot read REST responses cross-origin (CORS). WebSocket `wss://api.leviathannews.xyz/ws/news/` DOES work from browsers. Therefore: fixtures (CI-refreshed) are the data plane; live REST fetch is progressive enhancement; WS provides liveness.

## Commands
- Serve locally: `python3 -m http.server 8642 --directory prototypes`
- Deploy: push to `main` → GitHub Pages auto-deploys (`alex0xhodler.github.io/leviathan-news-prototypes/`)
- Refresh data: `sh prototypes/shared/fixtures/refresh.sh` then commit/push
