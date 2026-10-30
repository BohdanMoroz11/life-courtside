import type { GameCard, TeamRef, WatchGuide, WatchReason, WatchStar } from "../../../shared/types";
import { go, injuryTone, tint, tipTime, useSize } from "../lib";
import { GLOSSARY, statusMeaning, tip } from "../glossary";
import { Flash, Headshot, Term } from "./ui";

// Tonight's games ranked by how watchable they look. Top picks get the full card (reasons + stars)
// as far as the height allows; the rest are one-liners. Keep RICH_H / COMPACT_H in sync with the markup.
const RICH_H = 118;
const COMPACT_H = 52;
const GAP = 6;

type Row = { game: GameCard; watch?: WatchGuide };

export function TonightPanel({ games, watch }: { games: GameCard[]; watch?: Record<string, WatchGuide> }) {
  const [ref, { h }] = useSize<HTMLDivElement>();
  // Unfinished games by watch score, finished ones at the bottom.
  const rows: Row[] = games
    .map((game) => ({ game, watch: watch?.[game.id] }))
    .sort((a, b) => Number(a.game.state === "post") - Number(b.game.state === "post") || (b.watch?.score ?? 0) - (a.watch?.score ?? 0));
  const n = rows.length;
  let rich = watch ? n : 0;
  while (rich > 0 && rich * RICH_H + (n - rich) * COMPACT_H + (n - 1) * GAP > h) rich--;
  const bestId = rows.find((r) => r.game.state !== "post" && r.watch)?.game.id;
  // A note every game shares ("NBA Cup - Group Play") goes in the panel header instead.
  const common = sharedNote(watch);

  return (
    <div ref={ref} className="min-h-0 flex-1 overflow-y-auto">
      <ul className="flex flex-col" style={{ gap: GAP }}>
        {rows.map((r, i) => (
          <li key={r.game.id}>
            <GameCardView row={r} rich={i < rich} best={r.game.id === bestId} hideNote={!!common} />
          </li>
        ))}
      </ul>
    </div>
  );
}

const VERDICT_COLOR: Record<string, string> = {
  "Must watch": "var(--color-live)",
  "Good pick": "#a3e635",
  "Worth a look": "var(--color-doubt)",
};
const verdictColor = (v?: string) => (v && VERDICT_COLOR[v]) || "var(--color-mute)";

/** What's happening right now beats the pre-game forecast. */
function liveReason(g: GameCard): WatchReason | undefined {
  if (g.state !== "in" || !g.period) return;
  const margin = Math.abs(Number(g.away.score) - Number(g.home.score));
  if ((g.period >= 4 && margin <= 6) || (g.period === 3 && margin <= 4)) return { text: `Close right now: ${margin} points`, tone: "good" };
  if (g.period >= 3 && margin >= 20) return { text: `Blowout: ${margin} points`, tone: "bad" };
}

function sharedNote(watch?: Record<string, WatchGuide>) {
  const notes = Object.values(watch ?? {}).map((w) => w.note);
  return notes.length > 1 && notes.every((n) => n && n === notes[0]) ? notes[0] : undefined;
}

function GameCardView({ row: { game, watch }, rich, best, hideNote }: { row: Row; rich: boolean; best: boolean; hideNote: boolean }) {
  const color = verdictColor(watch?.verdict);
  const reasons = [liveReason(game), ...(watch?.reasons ?? [])].filter((r): r is WatchReason => !!r && !(hideNote && r.term === "nbaCup"));
  const done = game.state === "post";
  return (
    <button
      onClick={() => go(`#/game/${game.id}`)}
      className={`@container grid w-full grid-cols-[3.25rem_minmax(0,1fr)] gap-x-3 overflow-hidden rounded-xl border bg-panel px-3 text-left transition-colors hover:border-mute/60 ${done ? "opacity-60" : ""}`}
      style={{
        height: rich ? RICH_H : COMPACT_H,
        borderColor: best ? color : undefined,
        backgroundImage: `linear-gradient(90deg, ${tint(game.away.color)}33, transparent 30%, transparent 70%, ${tint(game.home.color)}33)`,
      }}
    >
      <Score watch={watch} color={color} rich={rich} />
      <div className={`flex min-w-0 flex-col ${rich ? "justify-center gap-1.5" : "justify-center"}`}>
        <div className="flex min-w-0 items-center gap-2">
          <Team team={game.away} />
          <span className="text-sm text-mute">@</span>
          <Team team={game.home} />
          <div className="ml-auto shrink-0 text-right">
            <Status game={game} />
          </div>
        </div>
        {rich && watch && (
          <>
            <div className="flex min-w-0 items-baseline gap-2 text-sm">
              <span className="shrink-0 whitespace-nowrap font-semibold" style={{ color }}>{best ? "Best pick tonight" : watch.verdict}</span>
              {/* The stars row below already names the stars. */}
              <Reasons reasons={reasons.filter((r) => !/^Stars?:/.test(r.text))} lines={2} />
            </div>
            <Stars stars={watch.stars} />
          </>
        )}
        {!rich && (
          <div className="flex min-w-0 items-baseline gap-2 text-xs">
            {watch && <span className="shrink-0 font-semibold" style={{ color }}>{best ? "Best pick" : watch.verdict}</span>}
            <Reasons reasons={reasons.filter((r) => r.tone !== "info")} lines={1} />
          </div>
        )}
      </div>
    </button>
  );
}

function Score({ watch, color, rich }: { watch?: WatchGuide; color: string; rich: boolean }) {
  if (!watch) return <div className="self-center text-center font-display text-3xl font-black text-line">–</div>;
  const breakdown = watch.parts.map((p) => `${p.label}: ${p.value} of ${p.max}`).join("\n");
  return (
    <div className="flex flex-col items-center justify-center" data-tip-title={`Watch score ${watch.score}/100`} data-tip={`${breakdown}\n\n${GLOSSARY.watch.body}`}>
      <span className={`font-display font-black leading-none tnum ${rich ? "text-5xl" : "text-3xl"}`} style={{ color }}>{watch.score}</span>
      {rich && (
        // The four parts of the score, each slot sized by its maximum.
        <div className="mt-1.5 flex h-1 w-full gap-px">
          {watch.parts.map((p) => (
            <div key={p.label} className="h-full overflow-hidden rounded-full bg-line" style={{ flex: p.max }}>
              <div className="h-full" style={{ width: `${(p.value / p.max) * 100}%`, background: color }} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Team({ team }: { team: TeamRef }) {
  return (
    <span className="flex min-w-0 items-center gap-1.5">
      <img src={team.logo} alt="" className="size-7 shrink-0" />
      <span className="truncate font-display text-xl font-extrabold leading-none">
        <span className="@[22rem]:hidden">{team.abbr}</span>
        <span className="hidden @[22rem]:inline">{team.name}</span>
      </span>
      <span className="hidden shrink-0 text-xs text-mute tnum @[28rem]:inline">{team.record}</span>
    </span>
  );
}

function Status({ game }: { game: GameCard }) {
  if (game.state === "pre") return <span className="font-display text-xl font-bold tnum">{tipTime(game.date)}</span>;
  return (
    <span className="flex flex-col items-end leading-tight">
      <span className="font-display text-xl font-extrabold tnum">
        <Flash value={game.away.score} scope={game.id} />–<Flash value={game.home.score} scope={game.id} />
      </span>
      <span className="flex items-center gap-1 text-[11px] text-mute">
        {game.state === "in" && <span className="live-dot size-1.5 rounded-full bg-live" />}
        {game.statusText}
      </span>
    </span>
  );
}

const TONE = { good: "text-ink/90", bad: "text-out", info: "text-mute" };
const MARK = { good: "+", bad: "–", info: "" };

function Reasons({ reasons, lines }: { reasons: WatchReason[]; lines: number }) {
  return (
    <span className="flex min-w-0 flex-wrap gap-x-3 overflow-hidden" style={{ maxHeight: `${lines * 1.45}em`, lineHeight: "1.45em" }}>
      {reasons.map((r) => {
        const t = r.term ? tip(r.term, r.detail) : r.detail ? { "data-tip": r.detail } : {};
        return (
          <span key={r.text} {...t} className={`max-w-full truncate ${TONE[r.tone]} ${r.term ? "explain" : ""}`}>
            {MARK[r.tone] && <span className={r.tone === "good" ? "text-live" : ""}>{MARK[r.tone]} </span>}
            {r.text}
          </span>
        );
      })}
    </span>
  );
}

function Stars({ stars }: { stars: WatchStar[] }) {
  if (!stars.length) return <div className="h-7 text-xs leading-7 text-mute">No big names in this one.</div>;
  return (
    <div className="flex h-7 min-w-0 items-center gap-3 overflow-hidden">
      {stars.map((s) => {
        const tone = injuryTone(s.status);
        const body = [s.honors, s.line, s.status && `${s.status}. ${statusMeaning(s.status) ?? ""}`].filter(Boolean).join("\n");
        return (
          <span key={s.id} className="flex shrink-0 items-center gap-1.5" data-tip-title={`${s.name} (${s.team})`} data-tip={body}>
            <Headshot
              src={s.headshot}
              name={s.name}
              className={`size-7 rounded-full bg-panel-2 ring-1 ${tone === "out" ? "opacity-40 grayscale ring-out" : tone ? "ring-doubt" : "ring-line"}`}
            />
            <span className={`text-xs ${tone === "out" ? "text-mute line-through" : "text-ink/85"}`}>{s.name.split(" ").slice(1).join(" ") || s.name}</span>
          </span>
        );
      })}
    </div>
  );
}

export function TonightAside({ games, watch }: { games: GameCard[]; watch?: Record<string, WatchGuide> }) {
  const note = sharedNote(watch);
  const times = games.map((g) => Date.parse(g.date)).sort((a, b) => a - b);
  const range = times.length ? `${tipTime(new Date(times[0]).toISOString())}–${tipTime(new Date(times.at(-1)!).toISOString())}` : "";
  return (
    <span>
      Ranked by <Term k="watch">watch score</Term>{range && `. Tip-offs ${range} your time`}
      {note && <>. All <Term k="nbaCup">{note.split(" - ")[0]}</Term> games</>}
    </span>
  );
}
