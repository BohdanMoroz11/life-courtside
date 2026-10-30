// "Which game should I watch tonight?" — an explainable 0-100 score, not real analytics.
// Four parts: is it expected to be close, are the teams good, are there stars, is there a story.
// Every point comes with a reason, so the card can say why. Tune freely.
import type { WatchGuide, WatchReason, WatchStar } from "../shared/types.ts";

export interface StarIn extends WatchStar {
  ppg: number;
  honorWeight: number; // see honorsWeight() in data.ts
}

export interface SideIn {
  abbr: string;
  name: string; // "Lakers"
  bpi?: number; // expected margin vs an average team
  bpiRank?: number;
  streak: number; // +3 = won 3 straight, -2 = lost 2
  seed?: number;
  conference?: string; // "West"
  gamesPlayed: number;
  stars: StarIn[];
}

export interface GameIn {
  away: SideIn;
  home: SideIn;
  spread?: number; // points, always positive
  favorite?: string; // abbreviation
  overUnder?: number;
  homeWinPct?: number; // ESPN predictor, 0..100
  rivals: boolean;
  note?: string;
}

const clamp = (x: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, x));
const ord = (n: number) => n + (["th", "st", "nd", "rd"][(n % 100 - 20) % 10] || ["th", "st", "nd", "rd"][n % 100] || "th");
const out = (s: StarIn) => !!s.status && /out|suspen/i.test(s.status);

/** 0..1: how much of a draw a player is. Honors say "famous", points say "fun to watch right now". */
export function starPower(s: StarIn) {
  return clamp(s.honorWeight / 4) * 0.65 + clamp((s.ppg - 16) / 14) * 0.35;
}
/** Worth naming on the card: decorated (an MVP, or two All-NBA teams) or scoring like a star right now. */
const isStar = (s: StarIn) => s.honorWeight >= 2 || s.ppg >= 24;

export function scoreGame(g: GameIn): WatchGuide {
  const reasons: WatchReason[] = [];

  // Close game (35): the betting line is the best "will it be close" signal there is.
  let close = 0.5;
  if (g.spread !== undefined) {
    close = clamp(1 - g.spread / 13);
    const line = `${g.favorite} by ${g.spread}`;
    if (g.spread <= 4) reasons.push({ text: `Should be close: ${line}`, tone: "good", term: "odds" });
    else if (g.spread >= 9) reasons.push({ text: `Likely one-sided: ${line}`, tone: "bad", term: "odds" });
  } else if (g.homeWinPct !== undefined) {
    const d = Math.abs(g.homeWinPct - 50);
    close = clamp(1 - d / 35);
    const fav = g.homeWinPct >= 50 ? g.home : g.away;
    const pct = Math.round(Math.max(g.homeWinPct, 100 - g.homeWinPct));
    if (d <= 10) reasons.push({ text: `Even matchup: ${fav.name} ${pct}% to win`, tone: "good", term: "winChance" });
    else if (d >= 25) reasons.push({ text: `Lopsided: ${fav.name} ${pct}% to win`, tone: "bad", term: "winChance" });
  }

  // Team quality (30): both teams good beats one great team and one bad one.
  let quality = 0.5;
  const [a, h] = [g.away, g.home];
  if (a.bpi !== undefined && h.bpi !== undefined) {
    const q = (b: number) => clamp((b + 7) / 15);
    quality = ((q(a.bpi) + q(h.bpi)) / 2) * 0.6 + Math.min(q(a.bpi), q(h.bpi)) * 0.4;
    const ranks = `ESPN ranks them ${ord(a.bpiRank!)} and ${ord(h.bpiRank!)}`;
    if (a.bpiRank! <= 10 && h.bpiRank! <= 10) reasons.push({ text: "Two top-10 teams", tone: "good", term: "bpi", detail: ranks });
    else if (a.bpiRank! >= 21 && h.bpiRank! >= 21) reasons.push({ text: "Two weak teams", tone: "bad", term: "bpi", detail: ranks });
    else {
      const best = a.bpiRank! < h.bpiRank! ? a : h;
      if (best.bpiRank! <= 5) reasons.push({ text: `${best.name} are a top-5 team`, tone: "good", term: "bpi", detail: ranks });
    }
  }

  // Stars (25): the best available player per team, plus a bit for a second star.
  const avail = (side: SideIn) => side.stars.filter((s) => !out(s)).map(starPower).sort((x, y) => y - x);
  const teamStars = (side: SideIn) => {
    const p = avail(side);
    return (p[0] ?? 0) + 0.35 * (p[1] ?? 0);
  };
  const stars = clamp((teamStars(a) + teamStars(h)) / 2.2);
  const shown = [...a.stars, ...h.stars].filter(isStar);
  const playing = shown.filter((s) => !out(s));
  if (playing.length) {
    const names = playing.map((s) => s.name.split(" ").slice(1).join(" ") || s.name).join(", ");
    const detail = playing.map((s) => `${s.name} (${s.team}): ${[s.honors, s.line].filter(Boolean).join(". ")}`).join("\n");
    reasons.push({ text: playing.length > 1 ? `Stars: ${names}` : `Star: ${names}`, tone: stars >= 0.45 ? "good" : "info", detail });
  }
  for (const s of shown.filter(out)) reasons.push({ text: `${s.name} is out`, tone: "bad", detail: `${s.status}. ${s.honors ?? ""}`.trim() });
  for (const s of shown.filter((x) => x.status && !out(x)))
    reasons.push({ text: `${s.name} is ${s.status!.toLowerCase()}`, tone: "info", term: "injuryStatus", detail: s.status });

  // Story (10 points): rivalry, form, a standings fight, fireworks.
  let story = 0;
  if (g.rivals) {
    story += 4;
    reasons.push({ text: "Old rivals", tone: "good", term: "rivals" });
  }
  for (const side of [a, h]) {
    if (side.streak >= 3) {
      story += 2;
      reasons.push({ text: `${side.name} have won ${side.streak} straight`, tone: "good", term: "streak" });
    }
  }
  const settled = a.gamesPlayed >= 10 && h.gamesPlayed >= 10;
  if (settled && a.conference === h.conference && a.seed && h.seed && a.seed <= 6 && h.seed <= 6) {
    story += 2;
    reasons.push({ text: `Top-6 clash in the ${a.conference}: ${ord(Math.min(a.seed, h.seed))} vs ${ord(Math.max(a.seed, h.seed))}`, tone: "good", term: "standing" });
  }
  if (g.overUnder && g.overUnder >= 232) {
    story += 2;
    reasons.push({ text: `High scoring expected (${g.overUnder} total)`, tone: "good", term: "overUnder" });
  }
  story = Math.min(story, 10);
  if (g.note) reasons.push({ text: g.note.replace(/ - /, ": "), tone: "info", term: "nbaCup" });

  const parts = [
    { label: "Close game", value: Math.round(close * 35), max: 35 },
    { label: "Team quality", value: Math.round(quality * 30), max: 30 },
    { label: "Star power", value: Math.round(stars * 25), max: 25 },
    { label: "Story", value: story, max: 10 },
  ];
  const score = parts.reduce((s, p) => s + p.value, 0);
  const verdict = score >= 72 ? "Must watch" : score >= 58 ? "Good pick" : score >= 45 ? "Worth a look" : "Skip unless you're a fan";

  // Good news first, then the catches, then plain info.
  const order = { good: 0, bad: 1, info: 2 };
  reasons.sort((x, y) => order[x.tone] - order[y.tone]);
  const strip = ({ ppg: _p, honorWeight: _h, ...s }: StarIn): WatchStar => s;
  return { score, verdict, parts, reasons, stars: shown.sort((x, y) => starPower(y) - starPower(x)).map(strip), note: g.note };
}
