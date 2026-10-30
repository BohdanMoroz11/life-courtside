// Shapes returned by our own API (server/ -> web/). ESPN's raw payloads never reach the browser.

export type GameState = "pre" | "in" | "post";

export interface TeamRef {
  id: string;
  abbr: string;
  name: string; // "Celtics"
  location: string; // "Boston"
  displayName: string; // "Boston Celtics"
  logo: string;
  color: string; // hex without '#'
  altColor: string;
  record?: string; // "1-0"
  score?: string;
  winner?: boolean;
}

export interface GameCard {
  id: string;
  date: string; // ISO
  state: GameState;
  statusText: string; // "7:00 PM EDT", "Q3 4:12", "Final"
  period?: number;
  clock?: string;
  venue?: string;
  city?: string;
  odds?: string; // "PHI -2.5"
  away: TeamRef;
  home: TeamRef;
}

export interface Injury {
  athleteId: string;
  name: string;
  status: string; // "Out", "Day-To-Day"
  type?: string; // "Ankle"
  detail?: string; // "Sprain"
  side?: string;
  returnDate?: string;
}

export interface BoxLine {
  min: string;
  pts: string;
  reb: string;
  ast: string;
  fg: string;
  threes: string;
  plusMinus: string;
  starter: boolean;
  didNotPlay: boolean;
}

export interface GameDetail extends GameCard {
  predictor?: { home: number; away: number }; // ESPN win probability before the game, in %
  series?: string; // "Season series 0-0"
  preview?: { headline: string; description?: string; bottomLine?: string; paragraphs: string[] };
  lastFive: Record<string, RecentResult[]>; // by team id, oldest -> newest
  injuries: Record<string, Injury[]>; // by team id
  box: Record<string, BoxLine>; // by athlete id, only when live/final
  overUnder?: number;
}

export interface RecentResult {
  result: string; // "W" / "L"
  opponent: string; // abbreviation
  atVs: string; // "@" / "vs"
  score: string;
  date: string;
}

export interface TeamStatRow {
  key: string;
  label: string;
  value: number;
  display: string;
  rank?: number; // 1 = best in the league for this stat
}

export interface StatLine {
  season: string; // "2025-26"
  team?: string; // team abbreviation
  gp: number;
  gs: number;
  min: number;
  pts: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
  fgPct: number;
  threePct: number;
  ftPct: number;
}

export type Tier = "star" | "starter" | "rotation" | "bench";

export interface RosterPlayer {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
  jersey?: string;
  position: string; // "G", "F", "C"
  positionName: string;
  headshot?: string;
  age?: number;
  height?: string; // metric, "206 cm"
  weight?: string; // "110 kg"
  experience: number; // years in league
  college?: string;
  salary?: number;
  salarySource?: string; // set when ESPN has no contract yet and the salary comes from elsewhere (server/salaries.ts)
  contractYearsLeft?: number;
  injuryStatus?: string; // from roster, e.g. "Out"
  honors?: string; // "4× MVP, 21× All-NBA"
  note?: string; // latest Rotowire one-liner
  current?: StatLine; // this season
  last?: StatLine; // last season (any team)
  importance: number; // 0..100 within team
  tier: Tier;
}

export interface LastSeason {
  season: string; // "2025-26"
  record?: string; // "60-22"
  seed?: number;
  conference?: string;
  playoffs?: string; // "Lost in East 1st Round to PHI (3-4)" / "Missed playoffs"
}

export interface NewsItem {
  headline: string;
  description?: string;
  published?: string;
  url?: string;
  image?: string;
}

export interface Lore {
  founded: number;
  formerly?: string;
  arena: string;
  titles: number[];
  nickname: string; // short vibe line
  identity: string; // paragraph
  legends: string[];
  rivals: string[];
}

export interface Coach {
  id: string;
  name: string;
  headshot?: string;
  age?: number;
  seasonsBefore: number; // completed seasons as an NBA head coach
  record?: string; // career regular season, "258-254"
  playoffRecord?: string;
}

export interface TeamDetail {
  team: TeamRef;
  season: string; // current season label, "2026-27"
  standing?: string; // "3rd in Atlantic Division"
  conference?: string;
  coach?: Coach;
  record?: string;
  streak?: string;
  lastSeason?: LastSeason;
  outlook: { label: string; reason: string };
  lore?: Lore;
  news: NewsItem[];
  stats?: { season: string; rows: TeamStatRow[] }; // team stats with league ranks
  roster: RosterPlayer[]; // sorted by importance desc
}

export interface Award {
  name: string;
  count: string; // "4x"
  seasons: string[];
}

export interface GameLogEntry {
  date: string;
  opponent: string;
  atVs: string; // "@" or "vs"
  result: string; // "W"/"L"
  score: string;
  min: string;
  pts: string;
  reb: string;
  ast: string;
}

export interface PlayerDetail {
  id: string;
  name: string;
  headshot?: string;
  jersey?: string;
  position?: string;
  team?: { abbr: string; name: string; color?: string };
  age?: number;
  dob?: string;
  birthPlace?: string;
  citizenship?: string;
  height?: string; // metric, "206 cm"
  weight?: string; // "110 kg"
  draft?: string; // "2017: Rd 1, Pk 3 (BOS)"
  debutYear?: number;
  experience?: string; // "10th Season"
  college?: string;
  awards: Award[];
  seasons: StatLine[]; // oldest -> newest
  career?: StatLine;
  teamsPath: string[]; // distinct teams in career order
  recentGames: GameLogEntry[];
  latestNote?: { headline: string; story?: string }; // Rotowire blurb
  news: NewsItem[];
}

// ---------- home page ----------

/** One line of "why watch (or skip) this game". */
export interface WatchReason {
  text: string;
  tone: "good" | "bad" | "info";
  term?: string; // glossary key explaining the concept
  detail?: string; // extra hover text specific to this game
}

export interface WatchStar {
  id: string;
  name: string;
  headshot?: string;
  team: string; // abbreviation
  honors?: string; // "2× MVP, 10× All-NBA"
  line?: string; // "28.8 PPG, 3.8 RPG, 3.5 APG"
  status?: string; // injury status when not fully available
}

/** How watchable a game looks before tip-off, with the reasons. See server/watch.ts. */
export interface WatchGuide {
  score: number; // 0..100
  verdict: string; // "Must watch", "Good pick", ...
  parts: { label: string; value: number; max: number }[];
  reasons: WatchReason[];
  stars: WatchStar[];
  note?: string; // "NBA Cup - Group Play"
}

export interface Performer {
  id: string;
  name: string;
  headshot?: string;
  line: string; // "29 PTS, 12 REB"
}

export interface ResultCard extends GameCard {
  recap?: string; // one-line AP recap
  top: Record<string, Performer | undefined>; // best performer by team id
  periods: Record<string, number[]>; // points per quarter (and overtime) by team id
  note?: string;
}

export interface StandingRow {
  team: TeamRef;
  seed: number;
  wins: number;
  losses: number;
  pct: string; // ".800"
  gb: string; // games behind the leader, "-" for the leader
  streak: string; // "W3"
  last10: string;
  diff: number; // average point margin
  strength?: number; // ESPN BPI rank, 1..30
}

export interface Standings {
  season: string;
  conferences: { name: string; rows: StandingRow[] }[];
}

export interface Leader {
  id: string;
  name: string;
  headshot?: string;
  team: string;
  color: string;
  value: string;
}

export interface LeaderCategory {
  key: string; // glossary key
  label: string;
  leaders: Leader[];
}
