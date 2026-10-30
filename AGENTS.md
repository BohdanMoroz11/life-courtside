# AGENTS.md

Context for coding agents (and future me). Read this before changing things.

## What this is

A throwaway-but-loved personal project for someone who **doesn't follow the NBA closely** (and watches live, not replays, so spoilers aren't a concern). Two parts:
- **Home**: which of tonight's games to watch (a ranked "watch score" with reasons), recent results, standings, league leaders, news.
- **Game page**: a "second screen" while watching: who the teams are and who the players are.

The owner cares mostly about **UI and how understandable it is**, not the tech. Keep it simple, hackable and fun.

Priorities, in order:
1. Rosters for tonight's game: who matters, pics, numbers, stats, injuries, salary, career gist.
2. Picking tonight's game, and a league overview (results, standings, leaders, news).
3. Team context: identity, goals, last season, news, lore.
4. Live score and box score.

Non-goals for now: accounts, persistence, deployment. AI news summaries are planned (see below); news is plain ESPN headlines until then.

## Stack

- **Server**: Node + Express, TypeScript run directly with `tsx` (no build step). `server/`
- **Frontend**: React 18 + Vite + Tailwind v4 + TanStack Query. `web/`
- **Shared types**: `shared/types.ts`, the contract between server and UI. Change it first when adding data.
- Hash routing in `web/src/lib.ts` (no router dependency): `#/` (home), `#/p/:playerId` and `#/t/:teamId` (home with a player or team modal), `#/game/:id`, `#/game/:id/p/:playerId`.

Runs on a Hetzner box (CPU only, 62 GB RAM), accessed through an SSH tunnel. Server binds to `127.0.0.1:5180`.

## Layout

```
server/
  index.ts       Express routes: /api/games, /api/watch, /api/results, /api/standings, /api/leaders, /api/news,
                 /api/game/:id, /api/team/:id, /api/player/:id, /api/health
  espn.ts        ESPN URLs, fetch + in-memory TTL cache, mapLimit concurrency helper
  data.ts        Raw ESPN payloads -> shared types (games, game detail, team, player)
  home.ts        Home page data: watch-score inputs, recent results, standings, leaders, news
  watch.ts       Heuristic "watch score" for a game (pure function, tune freely)
  importance.ts  Heuristic ranking of a roster into star / starter / rotation / bench
shared/types.ts  API response types
data/lore.json   Hand-written team history keyed by ESPN abbreviation (BOS, GS, NY, UTAH, WSH, ...)
web/src/
  lib.ts         Query hooks, hash router, formatting, team-color helpers
  glossary.ts    Plain-language explainers for every stat/term, shown as hover tooltips
  styles.css     Design tokens (Tailwind @theme) and the few custom classes
  components/    HomePage (panel layout) + TonightPanel, ResultsPanel, LeaguePanels (standings, leaders, news),
                 GamePage (header + layout), TeamPanel (team strip + fit-to-height roster),
                 MatchupPanel (preview, team stat comparison, last 5, odds), TeamModal, PlayerModal,
                 ui (Tooltips layer, Term, Flash, Modal, Segmented, pills...)
docs/data-sources.md  ESPN endpoints we use and what's in them
```

## Data notes

- Source is ESPN's unofficial API. Details and gotchas are in `docs/data-sources.md`. Payloads are huge and loosely typed; `data.ts` uses `any` on purpose and defensive optional chaining. Keep ESPN's shapes out of the frontend.
- ESPN's "season year" is the year the season ends: `2027` == `2026-27`. Use `seasonLabel()`.
- "Last season" for a team = standings for `year-1` + postseason schedule (`seasontype=3`), from which `describePlayoffs()` derives "Lost in East 1st Round to PHI (3-4)".
- Team "outlook" label (`outlookFor`) is a crude guess from last season's record and playoff result. It's labeled as a guess in the UI.
- Player importance (`importance.ts`): minutes + production, blending this season (weight grows to 100% by ~15 games) with last season, plus a small salary term so injured max-contract stars still rank high. Tiers: #1 is always star, #2–3 are stars if ≥85/100, then 2 more starters, 5 rotation, rest bench. Tune freely.
- Cards headline **this season's stats once a player has 8+ games**, otherwise last season's (`headlineLine`).
- Injury details (body part, return date) come from the game summary, not the roster.
- Traded players: ESPN's stats have one row per team plus a combined row with no teamId; we label it `TOT` and prefer it for season lines.
- Per-player honors ("4× MVP, 21× All-NBA", `honorsSummary`) and the latest Rotowire one-liner come from each player's `/overview`, fetched with the roster. ESPN has no All-Star selections.
- Team stat comparison: ESPN core API `/seasons/{y}/types/2/teams/{id}/statistics` (has league ranks); points allowed and margin are ranked from standings. Uses last season until the team has 10 games.
- Heights and weights are converted to metric on the server (`cm()`/`kg()`); the owner isn't American. Don't show US units.
- Coach: name from the roster, headshot from core `/seasons/{y}/coaches/{id}`, career records from core `/coaches/{id}/record/2` (regular season) and `/3` (playoffs). `experience` = completed seasons as head coach. ESPN lacks birth dates for some coaches.
- Watch score (`watch.ts`, 0-100): close game 35 (betting spread, else ESPN's win %), team quality 30 (ESPN BPI of both teams, the weaker one counts extra), star power 25 (best available player per team + a bit for a second; "star" = honorsWeight >= 2 or 24+ PPG), story 10 (lore rivals, 3+ win streak, top-6 clash after 10 games, over/under >= 232). Every point comes with a reason string shown on the card. Star candidates are each team's ESPN `rating` and scoring leader plus everyone on the injury report (an injured star is never a leader, but his absence matters); honors and averages come from `/overview`.
- Results: the last 3 days with finished games (searching back up to 10 days), with AP recap, each team's best player and points per quarter.
- TV broadcasts are deliberately not shown (US channels mean nothing to the owner).
- Caching: scoreboard and game summary 15 s (the watch score reads summaries with a 5 min TTL) (the browser decides how often to poll: 15 s live, 30 s near tip-off, 5 min otherwise); `getJson` honors the shorter of the stored and requested TTL, team/news/leaders/BPI 30 min, league news 5 min, roster and player stats 6 h, last-season data 24 h. All in memory, so a restart clears it.

## Design

Direction: "broadcast tale of the tape". Dark arena base (`#0F1622`), each team brings its own color (there's no house accent color). Fonts: **Big Shoulders Display** (names, numbers, scores) + **Figtree** (body), from Google Fonts.

- Jersey numbers are the signature: big display-font numbers in team color on every roster row, and the giant outlined number (`.jersey-ghost`) in the player modal. Don't add more decoration elsewhere.
- Team colors: use `accent()` for text/strokes on dark (lightens the team color until it has ~3:1 contrast) and `tint()` for backgrounds.
- **Both pages must fit the viewport with no page scroll.** This is the owner's #1 UI requirement: everything visible at a glance while watching. Detail goes into modals and tabs (team "About" modal, player modal with tabs), never into a longer page.
- **Home layout** (`HomePage`): panels in priority order (tonight, results, standings, leaders, news). The window width decides how many get their own column (5 at >=1880px, 4, 3, 2, 1 below 720px); the rest share the last column behind tabs. Each panel measures itself (`useSize`) and picks a density: Tonight gives top-ranked games the full card (reasons + star headshots) while they fit (`RICH_H`/`COMPACT_H`); Results picks full (with quarters) / rich / compact / mini rows per day and adds older days while there's room; Standings stacks both conferences, else side by side, else an East/West toggle; Leaders shows as many categories and names as fit; News as many items as fit. Keep the height constants in sync with the markup.
  - **Fill the space, too.** Empty area on a big screen is wasted: as the viewport grows, show more data rather than bigger padding. Wide (≥100rem): three columns, away | matchup | home. Medium: two teams, matchup behind a header button. Narrow: tabs (away / home / matchup).
  - Roster columns appear with panel width (MIN at `@md`, salary `@xl`, GP/FG%/3P% `@2xl`, STL/BLK `@3xl`; see `GRID`/`COLS` in `TeamPanel`).
  - `TeamPanel`'s roster measures its own height (`useHeight`) and `layout()` picks a density: "rich" (stars/key players get meta, honors and the latest Rotowire note) if the whole roster fits that way, else "compact". `fit()` keeps players in importance order with fixed row heights per tier (`ROW_H`); anything left goes behind a "+N more" row that opens a modal. If you change row markup, keep `ROW_H` in sync.
  - Highlighting: stars get tinted rows and bigger numbers; PTS/REB/AST are bold, secondary stats muted; honors are amber; league ranks are green (top 5) or red (bottom 5).
  - Injuries show inline as a pill (or a dot when narrow) on the player row, with details in the tooltip, team modal and player modal.
  - One stats toggle (last season / this season / this game) drives both rosters; it defaults to "this game" once a game has started, otherwise last season until players have ~8 games.
  - Modals may scroll internally as a last resort on phones; desktop sizes are designed to fit.
- **Responsive via container queries** (`@container`, `@4xl:` etc.), not just viewport breakpoints, because the app often lives in a narrow side window. Below `@4xl` the game page shows one team at a time with a switcher; above it, the two teams sit side by side. Check at 1440×820, 1280×720, 480×860 and 390×760.
- Copy: plain sentence case, explain things for a casual fan, no jargon without context.
- **Explain every stat.** The owner is learning the game: every stat label and basketball term gets a hover explainer from `glossary.ts` (what it is, what counts as good). Use `<Term k="...">` (dotted underline) or `{...tip("key")}`. New stat or term = new glossary entry.
- **Tooltips**: one app-wide `<Tooltips />` layer reads `data-tip` / `data-tip-title` attributes. Add `data-tip-overflow` to truncated or line-clamped text so the full text shows on hover only when it's actually cut off. Don't use native `title=`.
- **Live updates**: the game polls every 15 s while live; `<Flash value scope>` briefly glows a number in the team color when it changes (score, box score cells). The header shows "updated Xs ago".

## Conventions

- Match the existing style: small files, functional components, Tailwind classes inline, minimal comments explaining *why*.
- Run `npm run typecheck` and `npm run build` before committing.
- To eyeball UI: run `npm start`, then screenshot with Playwright at the sizes above and check `document.documentElement.scrollHeight` equals the viewport height on the game page.

## AI (not in v1, here's the research)

- Local Ollama on this box: qwen2.5:7b runs at ~7 tok/s and gets basic facts wrong. The 27B models (qwen3.8:27b, gemma4:26b/31b) would be ~2 tok/s. Usable only for background, cached jobs.
- OpenRouter has free models (`:free` suffix, ~17 listed in Oct 2026). Needs an account and API key; free daily request limits are tight.
- Plan if added: summarize ESPN team/player **news** into "what's going on right now" (grounded in fetched text, never from model memory), cached per day. OpenRouter free model first, Ollama fallback. The key goes in `.env` (gitignored).

## Roadmap / ideas

- AI "storylines" per team and player from news (see above).
- Date picker / browse any team (standings rows already open the team modal).
- Live play-by-play or a quarter-by-quarter score table (summary endpoint has `plays` for live games).
- Team stats comparison (pace, offense/defense rank) in the matchup header.
- Head-to-head history between the two teams.
- Persisted cache (SQLite) if ESPN gets slow, and a real deploy.
- Keep `data/lore.json` up to date (titles list ends with 2025; ESPN-derived data is always current).
