// Plain-language explainers shown on hover, for someone learning basketball stats as they watch.
// Use with tip(): <span {...tip("pts")}>PTS</span>. Keep them short, say what counts as good.

type Entry = { title: string; body: string };

export const GLOSSARY: Record<string, Entry> = {
  // Player stats
  jersey: { title: "Jersey number", body: "The number on the player's shirt. Handy for spotting him on TV." },
  gp: { title: "Games played", body: "Games he appeared in. A full regular season is 82 games, so a low number usually means injury or a small role." },
  min: { title: "Minutes", body: "Time on court. A game is 48 minutes (four 12-minute quarters). Stars play 32-38, regular bench players 15-25, under 15 is a small role." },
  pts: { title: "Points", body: "Baskets count 2, shots from behind the 3-point arc count 3, free throws 1. Per game: 20+ is a top scorer, 25+ is star level, 30+ leads the league." },
  reb: { title: "Rebounds", body: "Catching the ball after a missed shot, at either end. Tall players (centers, forwards) lead here. 10+ per game is excellent." },
  ast: { title: "Assists", body: "A pass that leads straight to a made basket: the main playmaking stat. Point guards lead here. 7+ per game is elite." },
  stl: { title: "Steals", body: "Taking the ball off an opponent. A defensive stat: 1.5+ per game is excellent." },
  blk: { title: "Blocks", body: "Knocking away an opponent's shot. Mostly tall players near the basket. 1.5+ per game is excellent." },
  fg: { title: "Field goal %", body: "Share of his shots that go in (every shot except free throws). League average is about 47%. Big men who shoot close to the rim often hit 55%+; guards who shoot from far are usually around 45%." },
  "3p": { title: "3-point %", body: "Share of shots from behind the 3-point arc that go in. League average is about 36%; 40%+ is a great shooter." },
  salary: { title: "Salary this season", body: "In US dollars. Teams have a payroll limit, so pay roughly shows how much a team values a player. Stars on max deals earn $45-60M; minimum deals are $1-3M." },
  plusMinus: { title: "Plus/minus (+/-)", body: "The score difference while he was on court. +8 means his team outscored the opponent by 8 during his minutes." },
  madeAttempted: { title: "Made-attempted", body: "\"7-15\" means 7 shots made out of 15 tried." },
  rookie: { title: "Rookie", body: "First season in the NBA, so there are no stats from last season." },
  importance: { title: "Importance", body: "Our own 0-100 estimate of how much this player matters to the team: minutes, production, starting role and salary. Not an official number." },
  draft: { title: "Draft", body: "Every summer teams take turns picking young players: 2 rounds of 30 picks. Worse teams pick first, so \"Rd 1, Pk 1\" is the most hyped prospect of the year." },
  experience: { title: "Experience", body: "Seasons in the NBA. Players usually peak around 25-30." },

  // Roster groups (our estimate)
  star: { title: "Stars", body: "The team's most important players, by minutes, production and salary. Watch these. Our estimate, not an official label." },
  starter: { title: "Key players", body: "Core players who play big minutes. The five on court at tip-off usually come from the stars and key players." },
  rotation: { title: "Rotation", body: "Regular bench players who come in during most games." },
  bench: { title: "Bench", body: "Reserves who play little, often only when the result is already decided." },

  // Team
  record: { title: "Record", body: "Wins-losses this season. Teams play 82 regular season games, from late October to mid April." },
  standing: { title: "Standing", body: "The 30 teams are split into East and West (15 each). The top 6 in each go straight to the playoffs; 7th-10th play a mini-tournament (the play-in) for the last 2 spots." },
  outlook: { title: "Outlook", body: "Our rough guess at what the team is aiming for this season, from last season's record and playoff run." },
  last5: { title: "Last 5 games", body: "W = win, L = loss, oldest to newest. Hover a game for the score." },
  coach: { title: "Head coach", body: "Picks who plays, the tactics and the timeouts." },

  // Team stat comparison (keys match TeamStatRow.key, prefixed with "team.")
  "team.ppg": { title: "Points scored", body: "Average points per game. How good the offense is." },
  "team.papg": { title: "Points allowed", body: "Average points the opponent scores per game. Lower is better: the sign of a good defense." },
  "team.diff": { title: "Point margin", body: "How many points per game they win (or lose) by on average. The best single measure of team strength: +5 or better is contender level, below -5 is a bad team." },
  "team.pace": { title: "Pace", body: "Possessions per 48 minutes, so how fast they play. More possessions mean more shots and more points for both teams. A style, not good or bad." },
  "team.fg": { title: "Field goal %", body: "Share of the team's shots that go in. League average is about 47%." },
  "team.3p": { title: "3-point %", body: "Share of the team's 3-point shots that go in. League average is about 36%." },
  "team.ast": { title: "Assists", body: "Passes that lead to baskets, per game. High means the ball moves and players set each other up." },
  "team.reb": { title: "Rebound share", body: "Share of all missed shots in their games that they grab. Over 50% means they win the battle under the basket." },
  "team.stl": { title: "Steals", body: "Times per game they take the ball off the opponent." },
  "team.blk": { title: "Blocks", body: "Opponent shots knocked away per game." },
  "team.tov": { title: "Turnovers", body: "Losing the ball without getting a shot off (bad pass, stepping out of bounds, getting stripped). Lower is better." },
  bpi: { title: "Team strength (ESPN BPI)", body: "ESPN's Basketball Power Index: how many points better or worse than an average team they'd be on a neutral court. +8 is title-favorite level, around 0 is average, -8 is one of the worst. Early in the season it leans on last year and the roster." },
  rank: { title: "League rank", body: "Out of 30 teams, 1st is best. Green is top 5, red is bottom 5." },

  // Home page
  watch: { title: "Watch score", body: "Our own 0-100 guess at how fun a game will be, made from four things:\nClose game (35): the betting line. A small spread means a tight game is expected.\nTeam quality (30): ESPN's team strength for both teams.\nStar power (25): famous or high-scoring players who are actually playing.\nStory (10): rivalries, winning streaks, a fight for the top of the standings, a high-scoring forecast.\n\nNot an official number." },
  seed: { title: "Position", body: "Place in the conference, by win percentage. Top 6 go straight to the playoffs, 7-10 play a mini-tournament (the play-in) for the last two spots, 11-15 are out. The season is long (82 games), so early positions move a lot." },
  winLoss: { title: "Wins-losses", body: "There are no draws in basketball (ties go to 5-minute overtime). Teams are ranked by win percentage, not points." },
  gb: { title: "Games behind", body: "How far behind the conference leader. 1 game behind = one more win and one fewer loss would make them level. \"-\" is the leader." },
  last10: { title: "Last 10 games", body: "Wins-losses over the 10 most recent games: current form." },
  margin: { title: "Point margin", body: "Points scored minus points allowed, per game. Often a better sign of real strength than the record: +5 or better is a contender, below -5 is a bad team." },
  "3pm": { title: "3-pointers made", body: "Shots made from behind the 3-point arc, per game. 3+ per game is a high-volume shooter; the very best make 4-5." },
  leaders: { title: "League leaders", body: "The best per-game averages in the league this season. Players need to have played enough games to qualify. Early in the season the list jumps around a lot." },
  periods: { title: "Quarters", body: "A game is four 12-minute quarters. If it's tied after four, they play 5-minute overtime periods (OT) until someone wins. The bold number won that quarter." },
  topPerformer: { title: "Best player in the game", body: "ESPN's pick for the most productive player on each team in this game, from points, rebounds, assists and the rest." },

  // Game
  winChance: { title: "Win chance", body: "ESPN's computer model's estimate, made before the game, from team strength, home court, rest and injuries." },
  odds: { title: "Betting line", body: "The point spread bookmakers set. \"CLE -6.5\" means Cleveland is expected to win by about 6 or 7 points. The bigger the number, the more lopsided the game is expected to be." },
  overUnder: { title: "Expected total points", body: "Bookmakers' estimate of both teams' points added together (the \"over/under\"). 220-235 is typical; higher means a fast, high-scoring game is expected." },
  rivals: { title: "Rivals", body: "Teams with a long history against each other: old playoff battles, the same city or region, or a famous feud. Players and fans care more, so these games tend to be intense." },
  streak: { title: "Streak", body: "Wins (W) or losses (L) in a row. W5 = won the last 5 games. A team on a streak is in form, or in trouble." },
  injuryStatus: { title: "Injury report", body: "Teams must report who might miss a game. Out = won't play. Day-to-day or questionable = a coin flip, usually decided shortly before tip-off." },
  nbaCup: { title: "NBA Cup", body: "A tournament inside the regular season, in November and December (since 2023). Group games also count as normal league games; the top teams play a knockout round in December for the trophy and prize money." },
  series: { title: "Season series", body: "Head-to-head wins between these two teams this regular season. They usually meet 2 to 4 times." },
};

// Injury report statuses, explained.
const STATUS: [RegExp, string][] = [
  [/out|injured reserve/i, "Will not play."],
  [/day-to-day/i, "A minor problem. He may or may not play; it's usually decided close to tip-off."],
  [/questionable/i, "Roughly a 50/50 chance to play."],
  [/doubtful/i, "Unlikely to play (about 25%)."],
  [/probable/i, "Likely to play."],
  [/suspen/i, "Suspended by the league, will not play."],
];

export function statusMeaning(status: string) {
  return STATUS.find(([re]) => re.test(status))?.[1];
}

/** Tooltip props for a glossary term. */
export function tip(key: string, extra?: string) {
  const e = GLOSSARY[key];
  if (!e) return {};
  return { "data-tip": extra ? `${e.body}\n\n${extra}` : e.body, "data-tip-title": e.title };
}
