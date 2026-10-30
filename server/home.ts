// Data for the home page: what to watch tonight, last night's results, standings, league leaders, news.
import { espn, mapLimit, TTL } from "./espn.ts";
import { cardFromCompetition, honorsSummary, honorsWeight, newsItems, num, seasonLabel, teamRef } from "./data.ts";
import { scoreGame, type SideIn, type StarIn } from "./watch.ts";
import lore from "../data/lore.json" with { type: "json" };
import type { LeaderCategory, Lore, NewsItem, ResultCard, StandingRow, Standings, TeamRef, WatchGuide } from "../shared/types.ts";

const ymd = (d: Date) => d.toISOString().slice(0, 10).replaceAll("-", "");

async function seasonYear(): Promise<number> {
  const sb = await espn.scoreboard();
  return sb.season?.year ?? sb.leagues?.[0]?.season?.year;
}

/** Team id -> { bpi, rank }. */
async function powerIndex(year: number) {
  const d = await espn.powerIndex(year).catch(() => null);
  const out = new Map<string, { bpi: number; rank: number }>();
  for (const it of d?.items ?? []) {
    const id = String(it.team?.$ref ?? "").match(/teams\/(\d+)/)?.[1];
    const stat = (n: string) => it.stats?.find((s: any) => s.name === n)?.value;
    if (id && stat("bpi") !== undefined) out.set(id, { bpi: num(stat("bpi")), rank: num(stat("bpirank")) });
  }
  return out;
}

async function teamsById() {
  const d = await espn.teams().catch(() => null);
  const out = new Map<string, TeamRef>();
  for (const { team } of d?.sports?.[0]?.leagues?.[0]?.teams ?? []) out.set(String(team.id), teamRef(team));
  return out;
}

const conferenceShort = (name: string) => (/east/i.test(name) ? "East" : /west/i.test(name) ? "West" : name);

// ---------- what to watch ----------

function streakOf(events: any[] = []): number {
  const r = [...events].sort((a, b) => String(a.gameDate).localeCompare(String(b.gameDate))).map((e) => e.gameResult);
  let n = 0;
  for (let i = r.length - 1; i >= 0 && r[i] === r[r.length - 1]; i--) n++;
  return r[r.length - 1] === "W" ? n : -n;
}

/** Season averages from a player's overview, falling back to career numbers (injured, not played yet). */
function averages(ov: any): { ppg: number; line?: string } {
  const st = ov?.statistics;
  if (!st?.splits) return { ppg: 0 };
  const pick = (name: string) => st.splits.find((x: any) => x.displayName === name);
  const season = pick("Regular Season");
  const split = season && num(season.stats[st.names.indexOf("gamesPlayed")]) > 0 ? season : pick("Career");
  if (!split) return { ppg: 0 };
  const v = (n: string) => split.stats[st.names.indexOf(n)];
  const line = `${v("avgPoints")} PPG, ${v("avgRebounds")} RPG, ${v("avgAssists")} APG`;
  return { ppg: num(v("avgPoints")), line: split === season ? line : `Career: ${line}` };
}

/**
 * Players a fan would tune in for: ESPN's top-rated player and top scorer on the team, plus anyone
 * on the injury report (an injured star isn't among the leaders, but his absence is the story).
 */
async function starsOf(competitor: any, injured: { id: string; name: string; headshot?: string; status: string }[]): Promise<StarIn[]> {
  const lead = (n: string) => competitor.leaders?.find((l: any) => l.name === n)?.leaders?.[0]?.athlete;
  const cands = [lead("rating"), lead("pointsPerGame")]
    .filter(Boolean)
    .map((a: any) => ({ id: String(a.id), name: a.displayName, headshot: typeof a.headshot === "string" ? a.headshot : a.headshot?.href }));
  const all = [...cands, ...injured].filter((c, i, arr) => arr.findIndex((x) => x.id === c.id) === i);
  return Promise.all(
    all.map(async (c): Promise<StarIn> => {
      const ov = await espn.athleteOverview(c.id).catch(() => null);
      const { ppg, line } = averages(ov);
      return {
        id: c.id,
        name: c.name,
        headshot: c.headshot ?? `https://a.espncdn.com/i/headshots/nba/players/full/${c.id}.png`,
        team: competitor.team.abbreviation,
        honors: honorsSummary(ov?.awards),
        line,
        status: injured.find((x) => x.id === c.id)?.status,
        ppg,
        honorWeight: honorsWeight(ov?.awards),
      };
    }),
  );
}

export async function getWatch(date?: string): Promise<Record<string, WatchGuide>> {
  const sb = await espn.scoreboard(date);
  const year: number = sb.season?.year ?? (await seasonYear());
  const [bpi, standings] = await Promise.all([powerIndex(year), espn.standings().catch(() => null)]);
  const seeds = new Map<string, { seed: number; conference: string; gp: number }>();
  for (const conf of standings?.children ?? []) {
    for (const e of conf.standings.entries) {
      const v = (n: string) => num(e.stats.find((s: any) => s.name === n)?.value);
      seeds.set(String(e.team.id), { seed: v("playoffSeed"), conference: conferenceShort(conf.name), gp: v("wins") + v("losses") });
    }
  }

  const out: Record<string, WatchGuide> = {};
  await mapLimit(sb.events ?? [], 4, async (e: any) => {
    const comp = e.competitions[0];
    // Pre-game facts (odds, injuries, form) change slowly; no need for the live cache here.
    const s = await espn.summary(e.id, TTL.short).catch(() => null);
    const injuredOf = (teamId: string) =>
      (s?.injuries?.find((t: any) => String(t.team.id) === teamId)?.injuries ?? []).map((i: any) => ({
        id: String(i.athlete?.id), name: i.athlete?.displayName, headshot: i.athlete?.headshot?.href, status: i.status,
      }));
    const five = new Map<string, any[]>((s?.lastFiveGames ?? []).map((t: any) => [String(t.team.id), t.events]));

    const side = async (homeAway: string): Promise<SideIn> => {
      const c = comp.competitors.find((x: any) => x.homeAway === homeAway);
      const id = String(c.team.id);
      const seed = seeds.get(id);
      return {
        abbr: c.team.abbreviation,
        name: c.team.shortDisplayName ?? c.team.name,
        bpi: bpi.get(id)?.bpi,
        bpiRank: bpi.get(id)?.rank,
        streak: streakOf(five.get(id)),
        seed: seed?.seed,
        conference: seed?.conference,
        gamesPlayed: seed?.gp ?? 0,
        stars: await starsOf(c, injuredOf(id)),
      };
    };
    const [away, home] = await Promise.all([side("away"), side("home")]);
    const odds = comp.odds?.[0] ?? s?.pickcenter?.[0];
    const details: string | undefined = odds?.details;
    const spread = details === "EVEN" ? 0 : odds?.spread !== undefined ? Math.abs(num(odds.spread)) : undefined;
    const pred = s?.predictor?.homeTeam?.gameProjection;
    const rivalsOf = (abbr: string) => (lore as Record<string, Lore>)[abbr]?.rivals ?? [];

    out[e.id] = scoreGame({
      away,
      home,
      spread,
      favorite: details?.split(" ")[0],
      overUnder: odds?.overUnder ? num(odds.overUnder) : undefined,
      homeWinPct: pred !== undefined ? num(pred) : undefined,
      rivals: rivalsOf(away.abbr).includes(home.abbr) || rivalsOf(home.abbr).includes(away.abbr),
      note: comp.notes?.[0]?.headline,
    });
  });
  return out;
}

// ---------- recent results ----------

/** The most recent days with finished games (usually yesterday first), newest first. */
export async function getResults(): Promise<{ days: { date: string; games: ResultCard[] }[] }> {
  const today = (await espn.scoreboard()).day?.date as string;
  const d = new Date(`${today}T12:00:00Z`);
  const days: { date: string; games: ResultCard[] }[] = [];
  for (let i = 1; i <= 10 && days.length < 3; i++) {
    d.setUTCDate(d.getUTCDate() - 1);
    const sb = await espn.scoreboard(ymd(d)).catch(() => null);
    const games: ResultCard[] = (sb?.events ?? [])
      .filter((e: any) => e.competitions[0].status.type.state === "post")
      .map((e: any) => {
        const comp = e.competitions[0];
        const top: ResultCard["top"] = {};
        const periods: ResultCard["periods"] = {};
        for (const c of comp.competitors) {
          const l = c.leaders?.find((x: any) => x.name === "rating")?.leaders?.[0];
          if (l) top[String(c.team.id)] = { id: String(l.athlete.id), name: l.athlete.displayName, headshot: l.athlete.headshot, line: l.displayValue };
          periods[String(c.team.id)] = (c.linescores ?? []).map((x: any) => num(x.value));
        }
        const h = comp.headlines?.[0];
        return { ...cardFromCompetition(e.id, comp), recap: h?.shortLinkText ?? h?.description, top, periods, note: comp.notes?.[0]?.headline };
      });
    if (games.length) days.push({ date: d.toISOString().slice(0, 10), games });
  }
  return { days };
}

// ---------- standings, leaders, news ----------

export async function getStandings(): Promise<Standings> {
  const [st, teams, year] = await Promise.all([espn.standings(), teamsById(), seasonYear()]);
  const bpi = await powerIndex(year);
  return {
    season: seasonLabel(st.season?.year ?? year),
    conferences: (st.children ?? []).map((conf: any) => ({
      name: conferenceShort(conf.name),
      rows: conf.standings.entries
        .map((e: any): StandingRow => {
          const s = (n: string) => e.stats.find((x: any) => x.name === n);
          const id = String(e.team.id);
          return {
            team: teams.get(id) ?? teamRef(e.team),
            seed: num(s("playoffSeed")?.value),
            wins: num(s("wins")?.value),
            losses: num(s("losses")?.value),
            pct: s("winPercent")?.displayValue ?? "",
            gb: s("gamesBehind")?.displayValue ?? "-",
            streak: s("streak")?.displayValue ?? "",
            last10: s("Last Ten Games")?.displayValue ?? "",
            diff: num(s("differential")?.value),
            strength: bpi.get(id)?.rank,
          };
        })
        .sort((a: StandingRow, b: StandingRow) => a.seed - b.seed),
    })),
  };
}

const LEADER_CATS: [string, string, string][] = [
  ["pointsPerGame", "pts", "Points"],
  ["reboundsPerGame", "reb", "Rebounds"],
  ["assistsPerGame", "ast", "Assists"],
  ["3PointsMadePerGame", "3pm", "3-pointers made"],
  ["stealsPerGame", "stl", "Steals"],
  ["blocksPerGame", "blk", "Blocks"],
];

export async function getLeaders(): Promise<{ season: string; categories: LeaderCategory[] }> {
  const year = await seasonYear();
  const d = await espn.leaders(year);
  const cats: any[] = d.leaders?.categories ?? [];
  return {
    season: seasonLabel(year),
    categories: LEADER_CATS.flatMap(([name, key, label]) => {
      const c = cats.find((x) => x.name === name);
      if (!c) return [];
      return [{
        key,
        label,
        leaders: (c.leaders ?? []).map((l: any) => ({
          id: String(l.athlete.id),
          name: l.athlete.displayName,
          headshot: l.athlete.headshot?.href,
          team: l.team?.abbreviation ?? "",
          color: l.team?.color ?? "556070",
          value: l.displayValue,
        })),
      }];
    }),
  };
}

export async function getNews(): Promise<NewsItem[]> {
  const d = await espn.leagueNews();
  // The NBA feed mixes in WNBA, fantasy and betting stories; keep plain NBA ones.
  const nbaOnly = (d.articles ?? []).filter((a: any) =>
    (a.categories ?? []).filter((c: any) => c.type === "league").every((c: any) => c.leagueId === 46),
  );
  return newsItems(nbaOnly);
}
