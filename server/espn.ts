// Thin client over ESPN's public (unofficial, keyless) JSON API with an in-memory TTL cache.
// NBA.com's own API blocks datacenter IPs, so ESPN is the only source.

const SITE = "https://site.api.espn.com/apis/site/v2/sports/basketball/nba";
const STANDINGS = "https://site.api.espn.com/apis/v2/sports/basketball/nba/standings";
const CORE = "https://sports.core.api.espn.com/v2/sports/basketball/leagues/nba";
const ATHLETE = "https://site.web.api.espn.com/apis/common/v3/sports/basketball/nba/athletes";
const LEADERS = "https://site.web.api.espn.com/apis/site/v3/sports/basketball/nba/leaders";

export const TTL = {
  live: 15_000,
  short: 5 * 60_000,
  medium: 30 * 60_000,
  long: 6 * 3600_000,
  day: 24 * 3600_000,
};

type Entry = { at: number; ttl: number; value: Promise<any> };
const cache = new Map<string, Entry>();

export async function getJson<T = any>(url: string, ttl: number): Promise<T> {
  const hit = cache.get(url);
  // The caller's TTL counts too: the same URL can be wanted fresher than it was first cached for.
  if (hit && Date.now() - hit.at < Math.min(hit.ttl, ttl)) return hit.value;
  const load = () =>
    fetch(url, { headers: { "User-Agent": "nba-tracker (personal project)" } }).then(async (r) => {
      if (!r.ok) throw new Error(`ESPN ${r.status} for ${url}`);
      return r.json();
    });
  // ESPN now and then answers 200 with an empty or cut-off body; one retry usually fixes it.
  const value = load()
    .catch(() => new Promise((ok) => setTimeout(ok, 400)).then(load))
    .catch((err) => {
      console.warn(`ESPN fetch failed: ${url}: ${err.message}`);
      throw err;
    });
  cache.set(url, { at: Date.now(), ttl, value });
  // Don't keep failures around.
  value.catch(() => cache.delete(url));
  return value;
}

export function cacheStats() {
  return { entries: cache.size };
}

/** Run async fn over items with limited concurrency, so a roster load doesn't fire 20 requests at once. */
export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx]);
    }
  });
  await Promise.all(workers);
  return out;
}

export const espn = {
  scoreboard: (date?: string) => getJson(`${SITE}/scoreboard${date ? `?dates=${date}` : ""}`, TTL.live),
  // Always short: the browser decides how often to ask (fast while live, slow otherwise).
  summary: (eventId: string, ttl = TTL.live) => getJson(`${SITE}/summary?event=${eventId}`, ttl),
  teams: () => getJson(`${SITE}/teams`, TTL.day),
  team: (teamId: string) => getJson(`${SITE}/teams/${teamId}`, TTL.medium),
  roster: (teamId: string) => getJson(`${SITE}/teams/${teamId}/roster`, TTL.long),
  teamNews: (teamId: string) => getJson(`${SITE}/news?team=${teamId}&limit=8`, TTL.medium),
  leagueNews: () => getJson(`${SITE}/news?limit=25`, TTL.short),
  leaders: (seasonYear: number) => getJson(`${LEADERS}?season=${seasonYear}`, TTL.medium),
  // ESPN's Basketball Power Index: team strength as expected point margin vs an average team, plus projections.
  powerIndex: (seasonYear: number) => getJson(`${CORE}/seasons/${seasonYear}/powerindex?limit=40`, TTL.medium),
  postseason: (teamId: string, seasonYear: number) =>
    getJson(`${SITE}/teams/${teamId}/schedule?season=${seasonYear}&seasontype=3`, TTL.day),
  standings: (seasonYear?: number) =>
    getJson(`${STANDINGS}${seasonYear ? `?season=${seasonYear}` : ""}`, seasonYear ? TTL.day : TTL.medium),
  athlete: (id: string) => getJson(`${ATHLETE}/${id}`, TTL.long),
  athleteStats: (id: string) => getJson(`${ATHLETE}/${id}/stats`, TTL.long),
  athleteOverview: (id: string) => getJson(`${ATHLETE}/${id}/overview`, TTL.medium),
  coach: (coachId: string, seasonYear: number) => getJson(`${CORE}/seasons/${seasonYear}/coaches/${coachId}`, TTL.day),
  // Career records: 2 = regular season, 3 = playoffs.
  coachRecord: (coachId: string, type: 2 | 3) => getJson(`${CORE}/coaches/${coachId}/record/${type}`, TTL.day),
  teamStats: (teamId: string, seasonYear: number) =>
    getJson(`${CORE}/seasons/${seasonYear}/types/2/teams/${teamId}/statistics`, TTL.long),
};
