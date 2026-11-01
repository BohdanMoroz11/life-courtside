# Courtside

> ⚡ Vibe coded: agents wrote it, I steered and vibe-checked some code. Maintained to the standard of "works on my machine". Pure vibes.

<img width="1560" height="784" alt="image" src="https://github.com/user-attachments/assets/0307cc7c-1752-4acb-aace-f95a3bec77f0" />

A personal NBA app for a casual fan, in two one-screen dashboards (no scrolling).

**Home** helps you pick a game and keep up with the league:

- **Tonight**: games ranked by a 0-100 **watch score** (is it expected to be close, are both teams good, which stars play, rivalry and form), with the reasons spelled out ("Should be close: NY by 3.5", "Anthony Edwards is out") and star headshots. Hover the score for the breakdown.
- **Results**: the last few game days, with scores by quarter, the AP one-line recap and each team's best player.
- **Standings** for both conferences (playoff and play-in lines, form, streak, ESPN team strength), **league leaders** (points, rebounds, assists, threes, steals, blocks) and **news** headlines.
- Click a player or team anywhere for details; panels that don't fit go behind tabs on smaller windows.

**Game page**, a second screen while you watch:

- **Header**: score or tip-off time in your timezone, live status (refreshes every 15 s, changed numbers glow briefly, "updated Xs ago"), ESPN's win probability, betting favorite, season series.
- **Hover explainers** on every stat and term (what PTS, pace or the betting line mean, and what counts as good), plus tooltips showing the full text of anything cut off.
- **Each team side by side**: name, a rough "what are they aiming for" label, record and standing, head coach (career record on hover), last season's record and playoff result. **About** opens a modal with facts, a short history, legends and rivals, news and the injury report.
- **Full roster ranked by importance**, grouped into stars, key players, rotation and bench, with jersey number, headshot, minutes, points, rebounds, assists, salary and injury status. One toggle switches every row between last season, this season and this game's box score (live during the game).
- **Matchup**: the game preview, a team-vs-team stat comparison with league ranks, each team's last 5 games and the odds. It's a middle column on wide screens, a button on medium ones, and a tab on narrow ones.
- **Honors and the latest note** next to players ("4× MVP, 21× All-NBA", last game's line from Rotowire). More stat columns (GP, FG%, 3P%, STL, BLK) appear as the window gets wider.
- **Player modal** (click anyone), with tabs: overview (bio, contract, injury detail, latest Rotowire note, honors, career path), season-by-season stats, recent games and news.

Works from a narrow side window (one team at a time, with a switcher) up to full screen.

## Run it

Needs Node 22+ (developed on Node 24).

```bash
npm install
npm start          # builds the frontend, serves everything on http://127.0.0.1:5180
```

The live version runs in a container at https://nba.bohdanmoroz.com, behind the shared login from the [hub](https://github.com/BohdanMoroz11/hub) repo. Files changed in the primary checkout go live automatically.

Development (hot reload for UI and API): `npm run dev` (Vite on :5173, API on :5180). `PORT` and `HOST` override the API address.

Other scripts: `npm run typecheck`, `npm run build`.

## How it works

- Data comes from ESPN's public JSON API (no key, unofficial). NBA.com's stats API blocks datacenter IPs, so it's not used. See [docs/data-sources.md](docs/data-sources.md).
- A small Express server fetches from ESPN, caches in memory and returns compact JSON. The browser never talks to ESPN directly, except for images.
- Nothing is stored on disk. Data is fetched when you open a game (about 20 requests per team the first time, then cached).
- Heights and weights are shown in cm and kg.
- The team history text (`data/lore.json`) is hand-written and static.

## Ideas for later

See [AGENTS.md](AGENTS.md#roadmap--ideas).
