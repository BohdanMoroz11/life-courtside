import type { Performer, ResultCard, TeamRef } from "../../../shared/types";
import { dayLabel, go, tint, useSize } from "../lib";
import { tip } from "../glossary";
import { Headshot, Term } from "./ui";

// Recent finals, newest day first. The latest day gets the densest layout that fits (with scores by
// quarter, then recap + best players, then one line each); older days are added while there's room.
// Keep the heights in sync with the markup.
const H = { full: 136, rich: 92, compact: 44, mini: 26 };
type Mode = keyof typeof H;
const GAP = 6;
const DAY_HEAD = 28;

type Day = { date: string; games: ResultCard[] };

/** Mini rows (older days) sit two per line when the panel is wide enough. */
const miniCols = (w: number) => (w >= 380 ? 2 : 1);

function dayHeight(n: number, m: Mode, w: number) {
  const rows = m === "mini" ? Math.ceil(n / miniCols(w)) : n;
  return DAY_HEAD + rows * H[m] + (rows - 1) * GAP;
}

function plan(days: Day[], w: number, h: number): { day: Day; mode: Mode }[] {
  const out: { day: Day; mode: Mode }[] = [];
  let left = h;
  for (const [i, day] of days.entries()) {
    const modes: Mode[] = i === 0 ? ["full", "rich", "compact", "mini"] : ["rich", "compact", "mini"];
    const mode = modes.find((m) => dayHeight(day.games.length, m, w) <= left);
    if (!mode) {
      if (i === 0) out.push({ day, mode: "mini" }); // never hide the latest results; scroll as a last resort
      break;
    }
    out.push({ day, mode });
    left -= dayHeight(day.games.length, mode, w) + 10;
  }
  return out;
}

function dayTitle(date: string, i: number) {
  const yesterday = new Date(Date.now() - 864e5);
  const isYesterday = date === new Date(yesterday.getTime() - yesterday.getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
  return i === 0 && isYesterday ? `Last night, ${dayLabel(date)}` : dayLabel(date);
}

export function ResultsPanel({ days }: { days: Day[] }) {
  const [ref, { w, h }] = useSize<HTMLDivElement>();
  return (
    <div ref={ref} className="min-h-0 flex-1 overflow-y-auto">
      {h > 0 && plan(days, w, h).map(({ day, mode }, i) => (
        <section key={day.date} className={i ? "mt-2.5" : ""}>
          <h3 className="text-sm font-semibold text-mute" style={{ height: DAY_HEAD, lineHeight: `${DAY_HEAD - 6}px` }}>{dayTitle(day.date, i)}</h3>
          <ul className="grid" style={{ gap: GAP, gridTemplateColumns: `repeat(${mode === "mini" ? miniCols(w) : 1}, minmax(0, 1fr))` }}>
            {day.games.map((g) => (
              <li key={g.id}>
                <Result g={g} mode={mode} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function Result({ g, mode }: { g: ResultCard; mode: Mode }) {
  return (
    <button
      onClick={() => go(`#/game/${g.id}`)}
      className={`flex w-full flex-col justify-center gap-1 overflow-hidden rounded-lg border border-line bg-panel text-left hover:border-mute/60 ${mode === "mini" ? "px-2" : "px-3"}`}
      style={{
        height: H[mode],
        backgroundImage: `linear-gradient(90deg, ${tint(g.away.color)}2a, transparent 35%, transparent 65%, ${tint(g.home.color)}2a)`,
      }}
    >
      <div className="flex items-center gap-2">
        <Side team={g.away} />
        <span className="text-xs text-mute">@</span>
        <Side team={g.home} />
        {mode !== "mini" && <span className="ml-auto shrink-0 text-xs text-mute">{g.statusText}</span>}
      </div>
      {mode === "full" && <Quarters g={g} />}
      {(mode === "full" || mode === "rich") && g.recap && (
        <p className="truncate text-xs text-ink/80" data-tip={g.recap} data-tip-overflow>{g.recap}</p>
      )}
      {(mode === "full" || mode === "rich") && (
        <div className="flex min-w-0 gap-3">
          {[g.away, g.home].map((t) => <Top key={t.id} p={g.top[t.id]} />)}
        </div>
      )}
    </button>
  );
}

/** Points per quarter: shows how the game went (a comeback, a blowout, a tight finish). */
function Quarters({ g }: { g: ResultCard }) {
  const a = g.periods[g.away.id] ?? [];
  const b = g.periods[g.home.id] ?? [];
  if (!a.length) return null;
  const label = (i: number) => (i < 4 ? `Q${i + 1}` : i === 4 ? "OT" : `${i - 3}OT`);
  const cell = "w-7 text-right tnum";
  return (
    <div className="grid w-max grid-flow-col grid-rows-3 gap-x-1 text-[11px] leading-[14px]">
      <Term k="periods" className="text-mute">Qtr</Term>
      <span className="pr-2 text-mute">{g.away.abbr}</span>
      <span className="pr-2 text-mute">{g.home.abbr}</span>
      {a.map((_, i) => [
        <span key={`h${i}`} className={`${cell} text-mute`}>{label(i)}</span>,
        <span key={`a${i}`} className={`${cell} ${a[i] > b[i] ? "font-semibold text-ink" : "text-mute"}`}>{a[i]}</span>,
        <span key={`b${i}`} className={`${cell} ${b[i] > a[i] ? "font-semibold text-ink" : "text-mute"}`}>{b[i]}</span>,
      ])}
    </div>
  );
}

function Side({ team }: { team: TeamRef }) {
  return (
    <span className={`flex min-w-0 items-center gap-1.5 ${team.winner ? "" : "text-mute"}`}>
      <img src={team.logo} alt="" className="size-5 shrink-0" />
      <span className="truncate text-sm font-semibold">{team.abbr}</span>
      <span className={`font-display text-xl leading-none tnum ${team.winner ? "font-extrabold text-ink" : "font-bold"}`}>{team.score}</span>
    </span>
  );
}

function Top({ p }: { p?: Performer }) {
  if (!p) return <span className="flex-1" />;
  return (
    <span className="flex min-w-0 flex-1 items-center gap-1.5 text-xs" {...tip("topPerformer", `${p.name}: ${p.line}`)}>
      <Headshot src={p.headshot} name={p.name} className="size-5 shrink-0 rounded-full bg-panel-2" />
      <span className="truncate">
        <span className="text-ink/90">{p.name.split(" ").slice(1).join(" ") || p.name}</span> <span className="text-mute">{p.line}</span>
      </span>
    </span>
  );
}
