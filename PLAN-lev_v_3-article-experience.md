# Implementation Plan — `lev_v_3`: Style-Selectable Article Experience

**Goal:** Port the three validated prototype article experiences (Terminal / Broadsheet / Abyssal) into the Leviathan app behind feature flag `lev_v_3` — disabled by default, internal testers first — with a first-visit style picker and full Mixpanel instrumentation for a 3-way style A/B test against the existing article flow.

**Architecture:** A device-scoped style preference (`terminal | broadsheet | abyssal | classic`) resolves the article route's theme. All themes share one behavioral contract (the "hook journey") and one data layer; only presentation differs. Entry points change globally under the flag: headline taps open the **internal article view** instead of exiting to source.

**Reference implementation (source of truth):** the `prototypes/` repo — see *Prototype Map* below. Port the logic into app code (TypeScript); do not copy the prototype JS verbatim.

---

## 1. Feature flag & gating

- Flag name: `lev_v_3` (boolean). Default: **off** everywhere.
- Stage 1: internal tester allowlist only (flag service user-ID allowlist, or company-domain check).
- QA override: `?lev_v_3=1` URL param honored on any device for testing; never persisted to other users.
- Stage 2 (later decision, not this plan): percentage ramp. Do not build ramping logic now.

## 2. First-visit style picker

- When `lev_v_3` is on and the device has **no stored preference**, show the picker **once per device** on first article visit (bottom sheet on mobile, modal on desktop).
- Four choices, each with a mini preview: **Terminal** (command-center mono), **Broadsheet** (WSJ editorial serif), **Abyssal** (deep-sea bioluminescent), **Classic** (current experience).
- Persist choice in `localStorage["lev_article_style"]`. Device-scoped, not account-scoped (deliberate: matches prototype behavior and keeps anonymous users in the experiment).
- User can re-switch anytime from article view (a compact style switcher in the article header/footer is sufficient — reuse the picker's tiles).
- Selection fires `style_selected` (below). Classic = flag bypass for that device.

## 3. The hook journey (shared behavioral contract — every theme implements ALL zones)

The prototype's reason to exist: kill the exit-to-source reflex and run hook → read → bet → yap → earn → return.

| # | Zone | Contract |
|---|------|----------|
| 0 | Reading progress | 2px lime bar, fixed top |
| 1 | **Hook hero** | Kicker tags (plain mono text), headline (**no external link**), standfirst (URL-stripped, clamped 2 lines), meta line: source · time · species dot · ▲ weight. Hero media with letter-fallback |
| 2 | **THE BRIEF** (Perplexity-style) | 3–4 summary bullets (hard-truncated ~140 chars), 3-across key-numbers strip, analysis pull-quote. Hide gracefully when no TLDR data |
| 3 | **THE DESK SAYS** (Polymarket-style bet) | Big % numeral + status badge, full-width probability bar, "N WEIGHTED · X UP / Y DOWN" caption, **LONG / SHORT** 48px side-by-side buttons → token-weighted vote API. Anonymous → inline wallet-connect nudge |
| 4 | **THE POD** (Reddit-style comments) | **Composer ABOVE the comment list**, placeholder "Join the pod — earn SQUID…", tag pills (TLDR/ANALYSIS/QUESTION), yap rows with left vote rail + species dot + reply affordance ("REPLYING TO @user ×" chip). Anonymous → connect-wallet card swap |
| 5 | **WHAT ELSE IS BEING REPORTED** | Related same-tag articles — **internal links only** (this is the return loop) |
| 6 | **FIRST-SQUID journey** | 4-step progressive disclosure: Yap → Add weight → Back a narrative → Connect wallet. Persisted per device; current step highlighted, locked steps dimmed |
| 7 | **Return loop footer** | NEXT DISPATCH card (internal), back-to-feed link, and the deliberately quiet `Read at source ↗` — small, dim, last element on the page |

**In-viewport CTA system (key conversion mechanic):**
- Hero CTA row directly under hero meta: `▲ PREDICT` (scrolls to desk) + `YAP · EARN SQUID` (scrolls to composer, focuses textarea).
- Mobile-only sticky bottom bar with the same two actions: appears after ~60% of hero is scrolled, hides when desk or composer is in viewport (IntersectionObserver, threshold 0.15) or while the composer textarea is focused. Respect `env(safe-area-inset-bottom)`.
- `scroll-margin-top: 90px` on scroll targets.

## 4. Theme specs (the UX details that must survive the port)

Brand lock (all themes): navy `#021f53`, lime `#c1ff72`, white, gray `#d9d9d9`, black. No new colors.

### Theme A — Terminal Intelligence (`terminal`)
- **Type:** JetBrains Mono everything; Horizon for display headline. Small caps labels with `// SECTION [n]` ledger headers separated by hairlines.
- **Signature elements:** ASCII block meter `[███████░░░]` for consensus; hotkeys (`j/k` navigate related, `u` add weight, `c` focus composer, `esc` back) with keycap-styled hints (desktop only); command-pipeline journey stepper (`[01] YAP → [02] WEIGHT → …`).
- **Density:** highest of the three. Ledger rows, tabular numerals, lime used only for data (weights, active states, progress).
- **Mobile:** switcher-only headers; sticky CTA bar with mono keycap buttons; hotkey hints hidden.

### Theme B — Prestige Broadsheet (`broadsheet`)
- **Type:** serif display (nameplate + headline + drop cap), League Spartan body, mono only for meta/data. Double rules and single hairlines as separators — **no boxed chips**, open typography.
- **Signature elements:** WSJ-style nameplate + dateline masthead; drop-cap standfirst; THE BRIEF as a ruled "answer card"; THE DESK SAYS as an A1-style markets box (huge serif % numeral, LONG solid / SHORT ghost); pod as "LETTERS TO THE DESK"; **light/dark theme toggle** in masthead (both palettes within brand lock).
- **Mobile:** masthead collapses to one row (nameplate + date + toggle; hide VOL/NO + taglines); full article text/media collapsed behind a `FULL SIGNAL ↓` disclosure so the desk is ~1.3 scrolls from the hero.
- **Tone:** restraint; the serif does the work.

### Theme C — Bioluminescent Abyssal (`abyssal`)
- **Type:** mono labels + Horizon headline; depth-tagged panels (`DEPTH: 0M (SURFACE)` live readout follows scroll).
- **Signature elements:** deep-navy depths with lime as *bioluminescence* — hairlines and 6px dots only (**no glow slop, radius ≤6px**); hero as `SURFACE SIGNAL` panel; brief as `SONAR READING` with depth-gauge numerals; consensus as `PRESSURE GAUGE` (thin lime fill on dark track); pod as `THE TRENCH — VOICES`; journey as a vertical **descent gauge** (−200M TWILIGHT yap → −1000M MIDNIGHT weight → −4000M ABYSSAL narrative → −11000M HADAL wallet); related as `CURRENTS ELSEWHERE`.
- **Mobile:** journey rail moves below the article flow (hook-first — never above the hero); descent cards become 210px horizontal scroll.

## 5. Mobile requirements (hard-won — do not regress)

- Grid collapses MUST use `minmax(0, 1fr)` — bare `1fr` lets nowrap children prop the track open (this exact bug broke V2 in production testing).
- Composer textareas ≥16px font (iOS focus auto-zoom kills yap conversion).
- Tap targets ≥40px (44px preferred); journey/stepper and tag pills included.
- Fixed bottom bars need `padding-bottom` on the page so footer content clears them.
- Zone order on mobile is identical to desktop: hero → brief → desk → pod → related → journey → footer.
- Long tag rows fade at the right edge (mask gradient) instead of clipping mid-chip.

## 6. Data layer (port of `shared/article-engine.js`)

Verified Leviathan API surface (base `https://api.leviathannews.xyz/api/v1`):

| Need | Endpoint | Notes |
|---|---|---|
| Article detail | `GET /news/:id/` | headline, canonical_url, media, tags, vote_details{upvotes,downvotes,total_vote_weight}, top_tldr, top_yaps |
| Comments | `GET /news/:id/list_yaps` | text, tags, author (species meta), created_at |
| Post comment | `POST /news/:id/post_yap` | cookie session auth; 401 → wallet-connect nudge |
| Vote (= position) | `POST /news/:id/vote` `{weight: ±1}` | the "bet" primitive that exists TODAY |
| Related | `GET /news/?status=approved&sort_type=hot` | filter client-side by shared tags |
| Wallet auth | `GET /wallet/nonce/:addr/` → `POST /wallet/verify/` | EIP-191 personal_sign via window.ethereum; sets access_token cookie |

Browser POSTs need headers `Origin: https://leviathannews.xyz` + `Referer: https://leviathannews.xyz/` (CSRF allowlist) and `credentials: 'include'`.

Engine functions to port: `buildBrief` (sentence-split TLDR → bullets, regex key-numbers, analysis quote), `consensusFromVotes` (up/down ratio → pct + label), `journeyState` (4-step localStorage state machine), `trackReadingProgress`, `articleIdFromUrl`.

**Provider seam:** there is NO prediction-market endpoint yet (Kalshi/Polymarket aggregation is a draft backend PR). The desk card runs on Leviathan's real token-weighted consensus; keep the odds source behind a provider interface so real market odds drop in without touching UI.

## 7. Mixpanel instrumentation

Wire through the app's existing Mixpanel wrapper. Set super property `lev_article_variant` (`terminal|broadsheet|abyssal|classic`) on all events when the flag is on.

| Event | Properties | Fires |
|---|---|---|
| `style_picker_shown` | — | first-visit sheet displayed |
| `style_selected` | `variant`, `surface` (first_visit / switcher) | choice made |
| `article_viewed` | `article_id`, `variant` | article view mount |
| `scroll_depth` | `article_id`, `depth` (25/50/75/100) | once per quartile |
| `brief_viewed` | `article_id` | brief in viewport |
| `consensus_viewed` | `article_id`, `pct` | desk in viewport |
| `cta_clicked` | `target` (consensus/pod), `placement` (hero/sticky_bar) | CTA taps |
| `weight_clicked` | `article_id`, `side` (long/short) | LONG/SHORT tap |
| `yap_started` | `article_id` | first composer focus |
| `yap_submitted` | `article_id`, `reply` (bool) | post success |
| `wallet_connect_started` / `wallet_connected` | `context` (yap/consensus) | auth funnel |
| `journey_step_completed` | `step` (yap/weight/position/wallet) | step transitions |
| `related_clicked` / `next_dispatch_clicked` | `article_id`, `to_id` | return loop |
| `source_out_clicked` | `article_id` | **the metric this project exists to reduce** |

**Dashboards/funnels to build:** (1) article_viewed → brief → consensus → weight_clicked; (2) yap_started → yap_submitted (anonymous split); (3) source-out rate by variant vs classic; (4) second-action rate after first yap (the first-squid hypothesis); (5) style_selected distribution.

**Success criteria:** source-out clicks down, yap conversion up, ≥1 scroll-depth-50 improvement, no p95 regression. Guardrail: if a variant's yap error rate or page p95 regresses >10%, that variant loses traffic (manual, no auto-kill needed at internal stage).

## 8. Task breakdown (ordered)

1. Flag `lev_v_3` in flag service + tester allowlist + `?lev_v_3=1` QA override.
2. `lev_article_style` storage + first-visit picker sheet/modal (4 tiles) + switcher entry point.
3. Port article-engine data layer to app TypeScript (with provider seam for odds).
4. Themed article components ×3 against the zone contract in §3 (Terminal, Broadsheet, Abyssal), sharing one behavioral controller.
5. Rewire feed/detail entry points under flag: headline taps → internal article route; source-out link demoted per contract.
6. Mixpanel: events + super property + funnels (§7).
7. Wallet connect flow reuse (app likely has one — do not rebuild; prototype's EIP-191 flow is the fallback reference).
8. QA matrix: 3 themes × mobile/desktop × anonymous/authed × no-TLDR article (brief hides) × no-yaps article (empty pod) × offline (fixture/error state).
9. Enable for internal testers; watch `source_out_clicked` + funnel baselines for a week before any ramp discussion.

## 9. Prototype map (reference implementation)

- `prototypes/variant-1-terminal-article.html` — Terminal theme
- `prototypes/variant-2-editorial-article.html` — Broadsheet theme
- `prototypes/variant-3-abyssal-article.html` — Abyssal theme
- `prototypes/shared/article-engine.js` — data layer reference (all functions in §6)
- `prototypes/shared/leviathan-api.js` — API helpers (esc, timeAgo, fmtWeight, accountMeta species)
- `prototypes/shared/showcase-nav.js` — prototype-only dock; **not** part of the port
- Live preview: `https://alex0xhodler.github.io/leviathan-news-prototypes/variant-{1-terminal,2-editorial,3-abyssal}-article.html?id=305013`

---

# Handoff (restartable)

**Current goal:** Bring the three prototype article experiences into the Leviathan app behind flag `lev_v_3` (off by default, internal testers first), with a first-visit device-scoped style picker (Terminal/Broadsheet/Abyssal/Classic) and Mixpanel A/B measurement. This document IS the plan; the next agent works in the actual app repo, not the prototypes repo.

**Changes made (prototypes repo, all pushed to `main`, live on GitHub Pages):**
- Three article pages implementing the full hook journey (§3 zones 0–7), per-theme aesthetics (§4), in-viewport PREDICT/YAP CTA system (hero row + mobile sticky bar), Reddit-style composer-on-top pods with reply chips, journey stepper persisted in localStorage.
- `shared/article-engine.js`: fetchers (article/yaps/related), `buildBrief`, `consensusFromVotes`, EIP-191 wallet connect, journey state machine, reading progress. Contains the HTML-comment provider seam for future Kalshi/Polymarket odds.
- Entry rewiring in the three list pages: V1 drawer has "OPEN FULL DISPATCH →"; V2/V3 headlines link internally; external source demoted to the page-bottom quiet link.
- Mobile hardening: minmax(0,1fr) grid collapses, 16px composers, ≥40px tap targets, safe-area-aware sticky bars, dock clearance, tag-row fade masks, V1 mobile header = brand + live dot + switcher-only feed header.
- Dock trimmed to variants 1–3 (V4–6 prototypes still exist in repo, just unlinked).

**Verification evidence:** every claim above was exercised in a real Chromium at 390×844 and ≥1280px against live API data (article id 305013): zero horizontal overflow (`scrollW === 390`), zero console errors, zone order confirmed by measured Y positions, journey state persisted across reloads, dock verified serving 3 items. V2's mid-project breakage (grid squeeze + duplicated journey/footer) was diagnosed, fixed, and re-verified.

**Untouched scope (do not assume done):** the actual Leviathan app repo (nothing there has been modified — zero commits); variants 4/5/6; theming of list/feed pages in the app (this plan themes the article view only); real prediction-market odds (no API exists — consensus-as-position is the wedge); backend work of any kind.

**Uncertainties:** whether the app is SSR/SEO-sensitive for article routes (internal article view changes crawlability of outbound links — confirm with app owner); whether the app already has wallet connect (reuse if so); flag service mechanism (assumed available — adapt §1.1 to whatever exists); Mixpanel wrapper API shape in the app.

**Open risks:** (1) post/vote POSTs require the CSRF Origin/Referer allowlist to include the app's origin — test on staging first; (2) brief bullets are synthesized from TLDR/yaps, not true article-body AI summaries — copy should say "synthesized", not imply full-text comprehension; (3) localStorage style choice can't be cohort-corrected server-side later without a migration; (4) if the app's feed and article share a component, the entry-rewiring (task 5) may be more invasive than scoped.

**Off-limits:** variants 4/5/6 deletion; changes to the live `leviathannews.xyz` backend; enabling the flag beyond the tester allowlist; redesigning the zone contract mid-port (it was user-approved verbatim).

**Last decision/gate:** user signed off on zone hierarchy — *summary → bet → yap → other articles* — and the PREDICT/YAP naming. The ship/no-ship gate for internal testers is task 9's one-week baseline review.

**Exactly one safe next action:** read the app repo's existing article route + feature-flag service, then implement plan task 1 (flag `lev_v_3` + allowlist + QA override) — no UI work before the flag exists.

**Must not assume:** that the prototypes repo's aesthetic approval equals approval to change app flows outside the article view, and that the Leviathan API offers a prediction-market endpoint (it does not — use the consensus wedge + provider seam).
