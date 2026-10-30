# Data sources

Everything comes from ESPN's public, keyless, **unofficial** JSON API. It can change without notice. If something breaks, `curl` the URL and look at the shape. All URLs live in `server/espn.ts`.

NBA.com (`stats.nba.com`, `cdn.nba.com`) was tested and is **blocked from the Hetzner box** (timeout / 403). Don't bother unless running from a residential IP.

Base: `https://site.api.espn.com/apis/site/v2/sports/basketball/nba`

| Endpoint | Used for |
|---|---|
| `/scoreboard[?dates=YYYYMMDD]` | Game list. Default = ESPN's "today" (US time). Status, scores, records, odds (`spread`, `overUnder`), `notes` ("NBA Cup - Group Play"). Each competitor has `leaders`: before a game the season leaders (`rating` = "28.8 PPG, 3.8 RPG, ...", `pointsPerGame`), after it the game's best players ("29 PTS, 12 REB"). Finished games have `headlines` (AP recap one-liner) and `linescores` (points per quarter). |
| `/teams` | All 30 teams with colors (standings entries lack colors). |
| `/summary?event={id}` | Game page. `header` (status/score), `boxscore.players` (live/final player lines), `injuries` (with body part and return date), `predictor` (win %), `pickcenter` (odds, over/under), `seasonseries`, `article` (preview), `lastFiveGames` (form/streak, also used by the watch score). Also has `leaders`, `standings`, `winprobability` and, for live games, play-by-play; none of those are used yet. |
| `/teams/{id}` | Team colors, logos, current record, `standingSummary`. |
| `/teams/{id}/roster` | Players: headshot URL, jersey, position, age, height/weight, college, experience, **contract** (salary, years remaining), injury status. Also `coach`, `season.year`. |
| `/teams/{id}/schedule?season={year}&seasontype=3` | Postseason games, used to derive how far a team went last year. |
| `/news?team={id}&limit=8` | Team news. |
| `/news?limit=25` | League news for the home page. Mixes in WNBA, fantasy and betting stories; filter on `categories[type=league].leagueId === 46` (NBA). |

Standings: `https://site.api.espn.com/apis/v2/sports/basketball/nba/standings[?season={year}]`. Conference groups, each entry has `overall`, `playoffSeed`, `streak`, etc.

League leaders: `https://site.web.api.espn.com/apis/site/v3/sports/basketball/nba/leaders?season={year}`. `leaders.categories[]` (`pointsPerGame`, `reboundsPerGame`, `assistsPerGame`, `3PointsMadePerGame`, `stealsPerGame`, `blocksPerGame`, and more), 10 players each with team and headshot. `3PointPct` is useless early in the season (a 1-for-1 shooter leads).

Athletes: `https://site.web.api.espn.com/apis/common/v3/sports/basketball/nba/athletes/{id}`

| Path | Used for |
|---|---|
| `` (none) | Bio: DOB, birthplace, draft (`displayDraft`), debut year, experience. |
| `/stats` | Per-season averages with team (`categories[name=averages]`, plus `totals` for career). Missing `categories` for players with no NBA games. |
| `/overview` | `awards`, `rotowire` (latest note), `gameLog` (recent games), `news`, `nextGame`, `statistics` (this season and career averages). |
| `/gamelog` | Full game log (not used, large). |

## Core API (`sports.core.api.espn.com/v2/sports/basketball/leagues/nba`)

Hypermedia JSON (lots of `$ref` links); we only call a few leaf URLs directly.

| Path | Used for |
|---|---|
| `/seasons/{y}/types/2/teams/{id}/statistics` | Team stats with league ranks (`rankDisplayValue`) for the matchup comparison. |
| `/seasons/{y}/coaches/{coachId}` | Coach headshot and `dateOfBirth` (missing for some coaches). |
| `/seasons/{y}/powerindex?limit=40` | ESPN BPI per team (`team.$ref` holds the id): `bpi` (expected margin vs an average team), `bpirank`, projected wins, playoff/title odds. Used for the watch score and the standings "Str." column. |
| `/coaches/{coachId}/record/2`, `/record/3` | Coach career record, regular season and playoffs (`summary` like `"247-101-0"`). |

Images: headshots `https://a.espncdn.com/i/headshots/nba/players/full/{id}.png`, logos `https://a.espncdn.com/i/teamlogos/nba/500/{abbr}.png`.

Team IDs / abbreviations (ESPN): ATL 1, BOS 2, NO 3, CHI 4, CLE 5, DAL 6, DEN 7, DET 8, GS 9, HOU 10, IND 11, LAC 12, LAL 13, MIA 14, MIL 15, MIN 16, BKN 17, NY 18, ORL 19, PHI 20, PHX 21, POR 22, SAC 23, SA 24, OKC 25, UTAH 26, WSH 27, TOR 28, MEM 29, CHA 30.

ESPN sometimes answers 200 with an empty body. `getJson` retries once and logs `ESPN fetch failed: <url>` if the retry fails too.
