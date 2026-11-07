// Turns raw ESPN payloads into the compact shapes in shared/types.ts.
import { espn, mapLimit } from "./espn.ts";
import { rankRoster } from "./importance.ts";
import { nameKey, SALARY_SOURCE, seasonSalaries } from "./salaries.ts";
import lore from "../data/lore.json" with { type: "json" };
import type {
  BoxLine, Coach, GameCard, GameDetail, GameLogEntry, Injury, LastSeason, Lore, NewsItem,
  PlayerDetail, RecentResult, RosterPlayer, StatLine, TeamDetail, TeamRef, TeamStatRow,
} from "../shared/types.ts";

export const num = (v: unknown) => {
  const n = parseFloat(String(v));
  return Number.isFinite(n) ? n : 0;
};

// ESPN gives US units ("6' 9\"", "243 lbs"); the owner thinks in metric.
function cm(display?: string) {
  const m = display?.match(/(\d+)'\s*(\d+)?/);
  return m ? `${Math.round((+m[1] * 12 + +(m[2] ?? 0)) * 2.54)} cm` : undefined;
}
function kg(display?: string) {
  const lbs = parseFloat(display ?? "");
  return lbs ? `${Math.round(lbs * 0.4536)} kg` : undefined;
}

function logoOf(t: any): string {
  return t.logo ?? t.logos?.find((l: any) => l.rel?.includes("default"))?.href ?? t.logos?.[0]?.href ?? "";
}

export function teamRef(t: any, extra: Partial<TeamRef> = {}): TeamRef {
  return {
    id: String(t.id),
    abbr: t.abbreviation,
    name: t.name ?? t.shortDisplayName,
    location: t.location,
    displayName: t.displayName,
    logo: logoOf(t),
    color: t.color ?? "556070",
    altColor: t.alternateColor ?? "ffffff",
    ...extra,
  };
}

export function newsItems(articles: any[] = []): NewsItem[] {
  return articles.map((a) => ({
    headline: a.headline,
    description: a.description,
    published: a.published,
    url: a.links?.web?.href,
    image: a.images?.find((i: any) => i.type !== "stitcher")?.url,
  }));
}

// ---------- games ----------

function competitorRef(c: any): TeamRef {
  return teamRef(c.team, {
    record: c.records?.find((r: any) => r.type === "total")?.summary ?? c.record?.find?.((r: any) => r.type === "total")?.summary,
    score: c.score?.displayValue ?? c.score,
    winner: c.winner,
  });
}

export function cardFromCompetition(id: string, comp: any): GameCard {
  const st = comp.status;
  const state = st.type.state as GameCard["state"];
  const away = comp.competitors.find((c: any) => c.homeAway === "away");
  const home = comp.competitors.find((c: any) => c.homeAway === "home");
  return {
    id,
    date: comp.date,
    state,
    statusText: state === "pre" ? st.type.shortDetail : st.type.detail,
    period: st.period,
    clock: st.displayClock,
    venue: comp.venue?.fullName,
    city: comp.venue?.address?.city,
    odds: comp.odds?.[0]?.details,
    away: competitorRef(away),
    home: competitorRef(home),
  };
}

export async function getGames(date?: string): Promise<{ date: string; games: GameCard[]; upcoming?: boolean }> {
  const sb = await espn.scoreboard(date);
  const games: GameCard[] = (sb.events ?? []).map((e: any) => cardFromCompetition(e.id, e.competitions[0]));
  const day: string = sb.day?.date ?? date;
  if (games.length || date) return { date: day, games };

  // Nothing today (off day, All-Star break, offseason): look ahead for the next game day.
  const d = new Date(`${day}T12:00:00Z`);
  for (let i = 1; i <= 10; i++) {
    d.setUTCDate(d.getUTCDate() + 1);
    const ymd = d.toISOString().slice(0, 10);
    const next = await getGames(ymd.replaceAll("-", ""));
    if (next.games.length) return { date: ymd, games: next.games, upcoming: true };
  }
  return { date: day, games };
}

export async function getGame(id: string): Promise<GameDetail> {
  const s = await espn.summary(id);
  const comp = s.header.competitions[0];
  const card = cardFromCompetition(id, { ...comp, venue: s.gameInfo?.venue });

  const injuries: Record<string, Injury[]> = {};
  for (const t of s.injuries ?? []) {
    injuries[t.team.id] = (t.injuries ?? []).map((i: any) => ({
      athleteId: String(i.athlete?.id),
      name: i.athlete?.displayName,
      status: i.status,
      type: i.details?.type,
      detail: i.details?.detail,
      side: i.details?.side !== "Not Specified" ? i.details?.side : undefined,
      returnDate: i.details?.returnDate,
    }));
  }

  const box: Record<string, BoxLine> = {};
  for (const team of s.boxscore?.players ?? []) {
    const st = team.statistics?.[0];
    if (!st) continue;
    const ix = (k: string) => st.labels.indexOf(k);
    for (const a of st.athletes ?? []) {
      const v = a.stats ?? [];
      box[String(a.athlete.id)] = {
        min: v[ix("MIN")] ?? "", pts: v[ix("PTS")] ?? "", reb: v[ix("REB")] ?? "", ast: v[ix("AST")] ?? "",
        fg: v[ix("FG")] ?? "", threes: v[ix("3PT")] ?? "", plusMinus: v[ix("+/-")] ?? "",
        starter: !!a.starter, didNotPlay: !!a.didNotPlay || v.length === 0,
      };
    }
  }

  const pick = s.pickcenter?.[0];
  const series = s.seasonseries?.[0];
  const pred = s.predictor;
  return {
    ...card,
    odds: card.odds ?? pick?.details,
    overUnder: pick?.overUnder,
    predictor: pred?.homeTeam?.gameProjection
      ? { home: num(pred.homeTeam.gameProjection), away: num(pred.awayTeam.gameProjection) }
      : undefined,
    series: series ? `${series.summary || series.seriesScore}` : undefined,
    preview: s.article?.headline ? { headline: s.article.headline, description: s.article.description, ...parsePreview(s.article.story) } : undefined,
    lastFive: lastFiveOf(s.lastFiveGames),
    injuries,
    box,
  };
}

function lastFiveOf(teams: any[] = []): Record<string, RecentResult[]> {
  const out: Record<string, RecentResult[]> = {};
  for (const t of teams) {
    out[String(t.team.id)] = (t.events ?? [])
      .map((e: any) => ({ result: e.gameResult, opponent: e.opponent?.abbreviation, atVs: e.atVs, score: e.score, date: e.gameDate }))
      .sort((a: RecentResult, b: RecentResult) => a.date.localeCompare(b.date));
  }
  return out;
}

/** The AP preview is boilerplate text: pull out "BOTTOM LINE" and the team paragraphs that follow it. */
function parsePreview(story?: string): { bottomLine?: string; paragraphs: string[] } {
  if (!story) return { paragraphs: [] };
  const paras = story
    .replace(/<[^>]+>/g, "")
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const i = paras.findIndex((p) => p.startsWith("BOTTOM LINE:"));
  if (i < 0) return { paragraphs: [] };
  const paragraphs: string[] = [];
  for (const p of paras.slice(i + 1)) {
    if (/^(INJURIES|TOP PERFORMERS|LAST 10 GAMES|-{3,}|The Associated Press)/.test(p)) break;
    paragraphs.push(p);
  }
  return { bottomLine: paras[i].replace("BOTTOM LINE:", "").trim(), paragraphs };
}

// ---------- teams ----------

/** "4× MVP, 1× Finals MVP, 21× All-NBA": the honors a casual fan recognizes, merged and ordered. */
export function honorsSummary(awards: any[] = []): string | undefined {
  const groups: [string, RegExp][] = [
    ["MVP", /^MVP$/],
    ["Finals MVP", /^Finals MVP$/],
    ["DPOY", /Defensive Player of the Year/],
    ["All-NBA", /^All-NBA/],
    ["All-Defense", /^All-Defensive/],
    ["ROY", /^Rookie of the Year$/],
    ["6th Man", /Sixth Man/],
    ["Most Improved", /Most Improved/],
    ["Clutch POY", /Clutch Player/],
  ];
  const parts: string[] = [];
  for (const [label, re] of groups) {
    const n = awards.filter((a) => re.test(a.name)).reduce((sum, a) => sum + (parseInt(a.displayCount) || 1), 0);
    if (n) parts.push(`${n}× ${label}`);
  }
  return parts.length ? parts.join(", ") : undefined;
}

/** Roughly "how decorated": an MVP counts 3, Finals MVP 2, DPOY 1.5, an All-NBA team or ROY 1. Used to spot stars. */
export function honorsWeight(awards: any[] = []): number {
  const w: [RegExp, number][] = [[/^MVP$/, 3], [/^Finals MVP$/, 2], [/Defensive Player of the Year/, 1.5], [/^All-NBA/, 1], [/^Rookie of the Year$/, 1]];
  return awards.reduce((sum, a) => sum + (w.find(([re]) => re.test(a.name))?.[1] ?? 0) * (parseInt(a.displayCount) || 1), 0);
}

/** Team stats with league ranks. ESPN ranks most stats; points allowed and differential we rank from standings. */
async function teamStatsFor(teamId: string, year: number): Promise<TeamDetail["stats"]> {
  const [d, standings] = await Promise.all([espn.teamStats(teamId, year).catch(() => null), espn.standings(year).catch(() => null)]);
  if (!d?.splits) return undefined;
  const cats: any[] = d.splits.categories ?? [];
  const find = (cat: string, name: string) => cats.find((c) => c.name === cat)?.stats.find((x: any) => x.name === name);
  const rankOf = (x: any) => (x?.rankDisplayValue ? parseInt(String(x.rankDisplayValue).replace(/\D+/g, "")) || undefined : undefined);

  const entries = (standings?.children ?? []).flatMap((c: any) => c.standings.entries);
  const raw = (e: any, n: string) => e.stats.find((x: any) => x.name === n)?.value;
  const sv = (e: any, n: string) => num(raw(e, n));
  const mine = entries.find((e: any) => String(e.team.id) === teamId);
  const rankBy = (n: string, lowerIsBetter: boolean) => {
    if (!mine) return undefined;
    const v = sv(mine, n);
    return 1 + entries.filter((e: any) => (lowerIsBetter ? sv(e, n) < v : sv(e, n) > v)).length;
  };

  const rows: TeamStatRow[] = [];
  const add = (key: string, label: string, value: unknown, rank?: number, digits = 1, suffix = "") => {
    // num() turns a missing stat into 0, so check the raw value: no stat means no row, not "0.0".
    if (value == null || !Number.isFinite(parseFloat(String(value)))) return;
    const v = num(value);
    rows.push({ key, label, value: v, display: `${v > 0 && key === "diff" ? "+" : ""}${v.toFixed(digits)}${suffix}`, rank });
  };
  add("ppg", "Points scored", find("offensive", "avgPoints")?.value, rankOf(find("offensive", "points")));
  if (mine) {
    add("papg", "Points allowed", raw(mine, "avgPointsAgainst"), rankBy("avgPointsAgainst", true));
    add("diff", "Point margin", raw(mine, "differential"), rankBy("differential", false));
  }
  add("pace", "Pace", find("offensive", "paceFactor")?.value, rankOf(find("offensive", "paceFactor")));
  add("fg", "Field goal %", find("offensive", "fieldGoalPct")?.value, rankOf(find("offensive", "fieldGoalPct")));
  add("3p", "3-point %", find("offensive", "threePointPct")?.value, rankOf(find("offensive", "threePointPct")));
  add("ast", "Assists", find("offensive", "avgAssists")?.value, rankOf(find("offensive", "assists")));
  add("reb", "Rebound share %", find("general", "reboundRate")?.value, rankOf(find("general", "reboundRate")));
  add("stl", "Steals", find("defensive", "avgSteals")?.value, rankOf(find("defensive", "steals")));
  add("blk", "Blocks", find("defensive", "avgBlocks")?.value, rankOf(find("defensive", "blocks")));
  add("tov", "Turnovers", find("offensive", "avgTotalTurnovers")?.value);
  return { season: seasonLabel(year), rows };
}

function parseStatSeasons(stats: any): { seasons: StatLine[]; career?: StatLine } {
  const avg = stats?.categories?.find((c: any) => c.name === "averages");
  if (!avg) return { seasons: [] };
  const L: string[] = avg.labels;
  const toLine = (vals: string[], season: string, team?: string): StatLine => {
    const g = (k: string) => num(vals[L.indexOf(k)]);
    return {
      season, team, gp: g("GP"), gs: g("GS"), min: g("MIN"), pts: g("PTS"), reb: g("REB"), ast: g("AST"),
      stl: g("STL"), blk: g("BLK"), fgPct: g("FG%"), threePct: g("3P%"), ftPct: g("FT%"),
    };
  };
  const teams = stats.teams ?? {};
  // Traded players get one row per team plus a combined row without a teamId; we label that one "TOT".
  const seasons = (avg.statistics ?? []).map((s: any) =>
    toLine(s.stats, s.season.displayName, s.teamId ? (teams[s.teamSlug]?.abbreviation ?? s.teamSlug) : "TOT"),
  );
  return { seasons, career: avg.totals ? toLine(avg.totals, "Career") : undefined };
}

/** Combine split rows (traded mid-season) into one line per season, weighted by games. */
function seasonLine(seasons: StatLine[], season: string): StatLine | undefined {
  const total = seasons.find((s) => s.season === season && s.team === "TOT");
  if (total) return total;
  const rows = seasons.filter((s) => s.season === season);
  if (rows.length <= 1) return rows[0];
  const gp = rows.reduce((a, r) => a + r.gp, 0) || 1;
  const w = (k: keyof StatLine) => rows.reduce((a, r) => a + (r[k] as number) * r.gp, 0) / gp;
  return {
    season, team: rows.map((r) => r.team).join("/"), gp, gs: rows.reduce((a, r) => a + r.gs, 0),
    min: w("min"), pts: w("pts"), reb: w("reb"), ast: w("ast"), stl: w("stl"), blk: w("blk"),
    fgPct: w("fgPct"), threePct: w("threePct"), ftPct: w("ftPct"),
  };
}

export function seasonLabel(year: number) {
  // ESPN season "year" 2027 == 2026-27
  return `${year - 1}-${String(year).slice(2)}`;
}

async function lastSeasonFor(teamId: string, currentYear: number): Promise<LastSeason> {
  const year = currentYear - 1;
  const out: LastSeason = { season: seasonLabel(year) };
  const [standings, post] = await Promise.all([
    espn.standings(year).catch(() => null),
    espn.postseason(teamId, year).catch(() => null),
  ]);
  for (const conf of standings?.children ?? []) {
    const e = conf.standings.entries.find((x: any) => String(x.team.id) === teamId);
    if (e) {
      const stat = (n: string) => e.stats.find((s: any) => s.name === n)?.displayValue;
      out.record = stat("overall");
      out.seed = num(stat("playoffSeed")) || undefined;
      out.conference = conf.name;
    }
  }
  out.playoffs = describePlayoffs(teamId, post?.events ?? []);
  return out;
}

function describePlayoffs(teamId: string, events: any[]): string {
  const games = events
    .map((e) => {
      const c = e.competitions[0];
      const me = c.competitors.find((x: any) => String(x.team?.id ?? x.id) === teamId);
      const opp = c.competitors.find((x: any) => x !== me);
      const round = (c.notes?.[0]?.headline ?? "").split(" - ")[0];
      return { round, won: me?.winner, opp: opp?.team?.abbreviation, done: c.status?.type?.completed };
    })
    .filter((g) => g.done && g.round);
  if (!games.length) return "Missed the playoffs";
  const last = games[games.length - 1];
  const inRound = games.filter((g) => g.round === last.round);
  const w = inRound.filter((g) => g.won).length;
  const l = inRound.length - w;
  if (/play-in/i.test(last.round)) return last.won ? "Won play-in, then out" : "Lost in the play-in";
  if (/nba finals/i.test(last.round) && w === 4) return `Won the NBA title over ${last.opp} (${w}-${l})`;
  if (w === 4) return `Won ${last.round} (${w}-${l})`; // season data incomplete
  return `Lost in ${last.round} to ${last.opp} (${w}-${l})`;
}

function outlookFor(last?: LastSeason): TeamDetail["outlook"] {
  const reason = last?.record ? `Last season ${last.record}. ${last.playoffs ?? ""}`.trim() : "No data from last season.";
  const [w, l] = (last?.record ?? "").split("-").map(Number);
  const pct = w + l ? w / (w + l) : 0.5;
  const p = last?.playoffs ?? "";
  if (/Won the NBA title/.test(p)) return { label: "Defending champions", reason };
  if (/Conference Finals|East Finals|West Finals|NBA Finals/i.test(p) || pct >= 0.65) return { label: "Title contender", reason };
  if (pct >= 0.55) return { label: "Playoff regular", reason };
  if (pct >= 0.45 || /Lost in/.test(p)) return { label: "Fighting for a playoff spot", reason };
  if (pct >= 0.35) return { label: "Play-in hopeful", reason };
  return { label: "Rebuilding", reason };
}

/** This season's salary: ESPN's contract, else the Spotrac-based dataset (see salaries.ts), else unknown. */
function salaryOf(a: any, extra: Map<string, number>): Pick<RosterPlayer, "salary" | "salarySource" | "contractYearsLeft"> {
  if (a.contract?.salary) return { salary: a.contract.salary, contractYearsLeft: a.contract.yearsRemaining };
  const salary = extra.get(nameKey(a.displayName));
  return salary ? { salary, salarySource: SALARY_SOURCE } : {};
}

function toRosterPlayer(a: any, seasons: StatLine[], ov: any, salaries: Map<string, number>, currentLabel: string, lastLabel: string): Omit<RosterPlayer, "importance" | "tier"> {
  return {
    id: String(a.id),
    name: a.displayName,
    firstName: a.firstName,
    lastName: a.lastName,
    jersey: a.jersey,
    position: a.position?.abbreviation ?? "",
    positionName: a.position?.displayName ?? "",
    headshot: a.headshot?.href,
    age: a.age,
    height: cm(a.displayHeight),
    weight: kg(a.displayWeight),
    experience: a.experience?.years ?? 0,
    college: a.college?.name,
    ...salaryOf(a, salaries),
    injuryStatus: a.injuries?.[0]?.status,
    honors: honorsSummary(ov?.awards),
    note: ov?.rotowire?.headline,
    current: seasonLine(seasons, currentLabel),
    last: seasonLine(seasons, lastLabel),
  };
}

async function coachFor(c: any, year: number): Promise<Coach | undefined> {
  if (!c) return undefined;
  const id = String(c.id);
  const [bio, reg, post] = await Promise.all([
    espn.coach(id, year).catch(() => null),
    espn.coachRecord(id, 2).catch(() => null),
    espn.coachRecord(id, 3).catch(() => null),
  ]);
  const wl = (r: any) => r?.summary?.replace(/-0$/, "");
  const dob = bio?.dateOfBirth ? new Date(bio.dateOfBirth) : undefined;
  return {
    id,
    name: `${c.firstName} ${c.lastName}`,
    headshot: bio?.headshot?.href,
    age: dob ? Math.floor((Date.now() - dob.getTime()) / (365.25 * 864e5)) : undefined,
    seasonsBefore: num(c.experience),
    record: wl(reg),
    playoffRecord: wl(post),
  };
}

export async function getTeam(teamId: string): Promise<TeamDetail> {
  const [teamRes, roster, news, standingsNow] = await Promise.all([
    espn.team(teamId),
    espn.roster(teamId),
    espn.teamNews(teamId).catch(() => ({ articles: [] })),
    espn.standings().catch(() => null),
  ]);
  const t = teamRes.team;
  const currentYear: number = roster.season?.year ?? standingsNow?.season?.year;
  const currentLabel = seasonLabel(currentYear);
  const lastLabel = seasonLabel(currentYear - 1);

  const athletes: any[] = roster.athletes ?? [];
  const [statsList, overviews] = await Promise.all([
    mapLimit(athletes, 6, (a) =>
      espn.athleteStats(String(a.id)).then(parseStatSeasons).catch(() => ({ seasons: [] as StatLine[] })),
    ),
    mapLimit(athletes, 6, (a) => espn.athleteOverview(String(a.id)).catch(() => null)),
  ]);
  const salaries = await seasonSalaries(currentLabel);
  const players = athletes.map((a, i) => toRosterPlayer(a, statsList[i].seasons, overviews[i], salaries, currentLabel, lastLabel));

  const lastSeason = await lastSeasonFor(teamId, currentYear);
  let conference: string | undefined;
  for (const conf of standingsNow?.children ?? []) {
    if (conf.standings.entries.some((x: any) => String(x.team.id) === teamId)) conference = conf.name;
  }
  const overall = t.record?.items?.find((r: any) => r.type === "total") ?? t.record?.items?.[0];
  const streak = overall?.stats?.find((s: any) => s.name === "streak")?.value;
  // This season's team stats once there's a real sample, last season's before that.
  const gamesPlayed = num(overall?.stats?.find((s: any) => s.name === "gamesPlayed")?.value);
  const stats = await teamStatsFor(teamId, gamesPlayed >= 10 ? currentYear : currentYear - 1);

  return {
    team: teamRef(t, { record: overall?.summary }),
    season: currentLabel,
    standing: t.standingSummary?.replace(/(Conference) Division$/, "$1"),
    conference,
    coach: await coachFor(roster.coach?.[0], currentYear),
    record: overall?.summary,
    streak: streak ? (streak > 0 ? `W${streak}` : `L${-streak}`) : undefined,
    lastSeason,
    outlook: outlookFor(lastSeason),
    lore: (lore as Record<string, Lore>)[t.abbreviation],
    news: newsItems(news.articles),
    stats,
    roster: rankRoster(players),
  };
}

// ---------- players ----------

export async function getPlayer(id: string): Promise<PlayerDetail> {
  const [bio, stats, ov] = await Promise.all([
    espn.athlete(id),
    espn.athleteStats(id).catch(() => null),
    espn.athleteOverview(id).catch(() => ({})),
  ]);
  const a = bio.athlete;
  const { seasons, career } = parseStatSeasons(stats);

  const teamsPath: string[] = [];
  for (const s of seasons) if (s.team && s.team !== "TOT" && teamsPath[teamsPath.length - 1] !== s.team) teamsPath.push(s.team);

  const gl = ov.gameLog;
  const recentGames: GameLogEntry[] = [];
  const glStats = gl?.statistics?.[0];
  if (glStats) {
    const L: string[] = glStats.labels;
    for (const ev of glStats.events ?? []) {
      const meta = gl.events?.[ev.eventId];
      if (!meta) continue;
      const g = (k: string) => ev.stats[L.indexOf(k)] ?? "";
      recentGames.push({
        date: meta.gameDate, opponent: meta.opponent?.abbreviation, atVs: meta.atVs, result: meta.gameResult,
        score: meta.score, min: g("MIN"), pts: g("PTS"), reb: g("REB"), ast: g("AST"),
      });
    }
  }

  return {
    id,
    name: a.displayName,
    headshot: a.headshot?.href,
    jersey: a.jersey,
    position: a.position?.displayName,
    team: a.team ? { abbr: a.team.abbreviation, name: a.team.displayName, color: a.team.color } : undefined,
    age: a.age,
    dob: a.displayDOB,
    birthPlace: a.displayBirthPlace,
    citizenship: a.citizenship,
    height: cm(a.displayHeight),
    weight: kg(a.displayWeight),
    draft: a.displayDraft,
    debutYear: a.debutYear,
    experience: a.displayExperience,
    college: a.college?.name,
    awards: (ov.awards ?? []).map((w: any) => ({ name: w.name, count: w.displayCount, seasons: w.seasons ?? [] })),
    seasons,
    career,
    teamsPath,
    recentGames,
    latestNote: ov.rotowire?.headline ? { headline: ov.rotowire.headline, story: ov.rotowire.story } : undefined,
    news: newsItems(ov.news).slice(0, 5),
  };
}
