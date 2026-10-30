import { useState } from "react";
import type { BoxLine, GameDetail, Injury, RosterPlayer, StatLine, TeamDetail, Tier } from "../../../shared/types";
import { accent, injuryTone, money, one, ordinal, tint, useHeight, type StatMode } from "../lib";
import { TeamModal } from "./TeamModal";
import { Flash, Headshot, InjuryPill, Modal, Term } from "./ui";
import { statusMeaning, tip } from "../glossary";

interface Props {
  team: TeamDetail;
  game: GameDetail;
  mode: StatMode;
}

export function TeamPanel({ team, game, mode }: Props) {
  const color = accent(team.team.color, team.team.altColor);
  const bg = tint(team.team.color);
  const [about, setAbout] = useState(false);
  const injuries = game.injuries[team.team.id] ?? [];
  const ls = team.lastSeason;
  const form = game.lastFive[team.team.id] ?? [];

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-line bg-panel @container" style={{ ["--team" as string]: color }}>
      <div className="flex shrink-0 items-center gap-3 border-b border-line px-3 py-2" style={{ background: `linear-gradient(90deg, ${bg}66, transparent 70%)` }}>
        <img src={team.team.logo} alt="" className="size-10 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <h2 className="truncate font-display text-2xl font-black leading-tight">{team.team.displayName}</h2>
            <span className="hidden shrink-0 rounded-full px-2 py-px text-xs font-semibold text-court @md:inline" style={{ background: color }} {...tip("outlook", team.outlook.reason)}>
              {team.outlook.label}
            </span>
          </div>
          <p className="truncate text-xs text-mute" data-tip={stripText(team)} data-tip-overflow>
            <Term k="record" className="text-ink">{team.record}</Term>
            {team.standing && <>, <Term k="standing">{team.standing.replace(" Division", "")}</Term></>}
            {team.coach && (
              <>
                <span className="text-ink/40"> | </span>coach <Term k="coach" extra={coachText(team.coach)} className="text-ink">{team.coach.name}</Term>
              </>
            )}
            {ls?.record && (
              <>
                <span className="text-ink/40"> | </span>
                last season <span className="text-ink">{ls.record}</span>, {ls.playoffs?.replace(/^Lost in /, "out in ")}
              </>
            )}
          </p>
        </div>
        {form.length > 0 && (
          <div className="hidden shrink-0 items-center gap-1 @2xl:flex" aria-label="Last 5 games">
            <Term k="last5" className="mr-1 text-xs text-mute">Last 5</Term>
            {form.map((g) => (
              <span
                key={g.date}
                data-tip={`${g.result === "W" ? "Won" : "Lost"} ${g.atVs} ${g.opponent} ${g.score}, ${new Date(g.date).toLocaleDateString([], { month: "short", day: "numeric" })}`}
                className={`grid size-5 place-items-center rounded text-[11px] font-bold ${g.result === "W" ? "bg-live/20 text-live" : "bg-out/20 text-out"}`}
              >
                {g.result}
              </span>
            ))}
          </div>
        )}
        <button onClick={() => setAbout(true)} className="shrink-0 rounded-lg border border-line px-2.5 py-1 text-sm font-medium hover:bg-panel-2">
          About
        </button>
      </div>

      <RosterTable team={team} game={game} mode={mode} injuries={injuries} color={color} bg={bg} />

      {about && <TeamModal team={team} injuries={injuries} onClose={() => setAbout(false)} />}
    </section>
  );
}

function coachText(c: NonNullable<TeamDetail["coach"]>) {
  return [
    `${c.name}${c.age ? `, ${c.age}` : ""}.`,
    c.seasonsBefore ? `${ordinal(c.seasonsBefore + 1)} season as an NBA head coach.` : "First season as an NBA head coach.",
    c.record && `Career record ${c.record}${c.playoffRecord && c.playoffRecord !== "0-0" ? `, ${c.playoffRecord} in the playoffs` : ""}.`,
  ].filter(Boolean).join(" ");
}

function stripText(team: TeamDetail) {
  const ls = team.lastSeason;
  return [
    `${team.record}${team.standing ? `, ${team.standing}` : ""}.`,
    team.coach && `Coach ${team.coach.name}.`,
    ls?.record && `Last season ${ls.record}, ${ls.playoffs ?? ""}.`,
  ].filter(Boolean).join("\n");
}

// ---------- roster that fits its box ----------

// Two density levels. "Rich" adds a meta line and the latest Rotowire note to stars and key players;
// it's used whenever the whole roster fits that way, otherwise rows fall back to compact.
const ROW_H: Record<"rich" | "compact", Record<Tier, number>> = {
  rich: { star: 80, starter: 46, rotation: 30, bench: 30 },
  compact: { star: 48, starter: 34, rotation: 29, bench: 29 },
};
const GROUP_H = 18;
const HEAD_H = 22;
const MORE_H = 30;
const GROUPS: [Tier, string][] = [
  ["star", "Stars"],
  ["starter", "Key players"],
  ["rotation", "Rotation"],
  ["bench", "Bench"],
];

type Density = keyof typeof ROW_H;

/** Greedily keep the most important players that fit; the rest go behind a "more" button. */
function fit(roster: RosterPlayer[], height: number, density: Density) {
  const rowH = ROW_H[density];
  const budget = height - HEAD_H;
  const visible: RosterPlayer[] = [];
  let used = 0;
  let lastTier: Tier | undefined;
  for (let i = 0; i < roster.length; i++) {
    const p = roster[i];
    const cost = rowH[p.tier] + (p.tier !== lastTier ? GROUP_H : 0);
    const reserve = i < roster.length - 1 ? MORE_H : 0;
    if (used + cost + reserve > budget) break;
    visible.push(p);
    used += cost;
    lastTier = p.tier;
  }
  const hidden = roster.slice(visible.length);
  // Spare room: let rows breathe a little instead of leaving a gap at the bottom.
  const scale = hidden.length ? 1 : Math.min(1.25, Math.max(1, budget / Math.max(used, 1)));
  return { visible, hidden, scale, density };
}

function layout(roster: RosterPlayer[], height: number) {
  const rich = fit(roster, height, "rich");
  return rich.hidden.length ? fit(roster, height, "compact") : rich;
}

interface TableProps {
  team: TeamDetail;
  game: GameDetail;
  mode: StatMode;
  injuries: Injury[];
  color: string;
  bg: string;
}

// Columns appear as the panel gets wider: MIN at @md, salary at @xl, GP/FG%/3P% at @2xl, STL/BLK at @3xl.
const GRID = [
  "grid items-center gap-x-2 @2xl:gap-x-1.5",
  "grid-cols-[1.75rem_2rem_minmax(0,1fr)_repeat(3,2.2rem)]",
  "@md:grid-cols-[2.25rem_2.5rem_minmax(0,1fr)_repeat(4,2.4rem)]",
  "@xl:grid-cols-[2.5rem_2.5rem_minmax(0,1fr)_repeat(4,2.6rem)_3.75rem]",
  "@2xl:grid-cols-[2.25rem_2.5rem_minmax(0,1fr)_repeat(7,2.3rem)_3.5rem]",
  "@3xl:grid-cols-[2.25rem_2.5rem_minmax(0,1fr)_repeat(9,2.3rem)_3.5rem]",
].join(" ");

// Keys double as glossary keys for the header explainers.
const COLS: { key: string; label: string; show: string }[] = [
  { key: "gp", label: "GP", show: "hidden @2xl:block" },
  { key: "min", label: "MIN", show: "hidden @md:block" },
  { key: "pts", label: "PTS", show: "" },
  { key: "reb", label: "REB", show: "" },
  { key: "ast", label: "AST", show: "" },
  { key: "stl", label: "STL", show: "hidden @3xl:block" },
  { key: "blk", label: "BLK", show: "hidden @3xl:block" },
  { key: "fg", label: "FG%", show: "hidden @2xl:block" },
  { key: "3p", label: "3P%", show: "hidden @2xl:block" },
];

const MODE_NOTE: Record<StatMode, string> = {
  last: "Showing per-game averages from last season.",
  current: "Showing per-game averages from this season.",
  tonight: "Showing this game's totals.",
};

function RosterTable({ team, game, mode, injuries, color, bg }: TableProps) {
  const [ref, height] = useHeight<HTMLDivElement>();
  const [showMore, setShowMore] = useState(false);
  const { visible, hidden, scale, density } = layout(team.roster, height);
  const injuryOf = (id: string) => injuries.find((i) => i.athleteId === id);
  const row = (p: RosterPlayer, s: number, d: Density) => (
    <PlayerRow key={p.id} p={p} game={game} mode={mode} injury={injuryOf(p.id)} color={color} bg={bg} height={ROW_H[d][p.tier] * s} rich={d === "rich"} />
  );

  return (
    <div ref={ref} className="min-h-0 flex-1 overflow-hidden px-1">
      {height > 0 && (
        <>
          <div className={`${GRID} px-2 text-[11px] text-mute`} style={{ height: HEAD_H }}>
            <span className="text-right"><Term k="jersey">#</Term></span>
            <span />
            <span>Player</span>
            {COLS.map((c) => (
              <span key={c.key} className={`text-right ${c.show}`}>
                <Term k={c.key} extra={c.key === "gp" || c.key === "salary" ? undefined : MODE_NOTE[mode]}>{c.label}</Term>
              </span>
            ))}
            <span className="hidden text-right @xl:block"><Term k="salary">Salary</Term></span>
          </div>
          {GROUPS.map(([tier, label]) => {
            const ps = visible.filter((p) => p.tier === tier);
            if (!ps.length) return null;
            return (
              <div key={tier}>
                <div className="flex items-end border-t border-line px-2 pb-0.5 text-[11px] font-semibold text-mute" style={{ height: GROUP_H }}>
                  <Term k={tier}>{label}</Term>
                </div>
                {ps.map((p) => row(p, scale, density))}
              </div>
            );
          })}
          {hidden.length > 0 && (
            <button
              onClick={() => setShowMore(true)}
              className="w-full truncate rounded-md border-t border-line px-2 text-left text-sm text-mute hover:bg-panel-2 hover:text-ink"
              style={{ height: MORE_H }}
            >
              + {hidden.length} more {hidden.length === 1 ? "player" : "players"} ({hidden.map((p) => p.lastName).join(", ")})
            </button>
          )}
        </>
      )}
      {showMore && (
        <Modal label={`More ${team.team.name} players`} onClose={() => setShowMore(false)} className="@container sm:w-[min(900px,94vw)]">
          <div className="p-4 pt-12">
            <h2 className="mb-2 font-display text-2xl font-black">More {team.team.name} players</h2>
            <div onClick={() => setShowMore(false)}>{hidden.map((p) => row(p, 1, "compact"))}</div>
          </div>
        </Modal>
      )}
    </div>
  );
}

type Cells = { [col: string]: string | undefined; note?: string };

function statCells(mode: StatMode, p: RosterPlayer, box?: BoxLine): Cells {
  const empty: Cells = { gp: "", min: "", pts: "–", reb: "", ast: "", stl: "", blk: "", fg: "", "3p": "" };
  if (mode === "tonight") {
    if (!box) return empty;
    if (box.didNotPlay) return { ...empty, pts: "", note: "Didn't play" };
    const pct = (made: string) => {
      const [m, a] = made.split("-").map(Number);
      return a ? `${Math.round((m / a) * 100)}` : "";
    };
    return { ...empty, min: box.min, pts: box.pts, reb: box.reb, ast: box.ast, fg: pct(box.fg), "3p": pct(box.threes) };
  }
  const s: StatLine | undefined = mode === "current" ? p.current : p.last;
  if (!s) return { ...empty, note: mode === "last" && p.experience <= 1 ? "Rookie" : undefined };
  return {
    gp: String(s.gp), min: one(s.min), pts: one(s.pts), reb: one(s.reb), ast: one(s.ast),
    stl: one(s.stl), blk: one(s.blk), fg: one(s.fgPct), "3p": one(s.threePct),
  };
}

interface RowProps {
  p: RosterPlayer;
  game: GameDetail;
  mode: StatMode;
  injury?: Injury;
  color: string;
  bg: string;
  height: number;
  rich: boolean;
}

function PlayerRow({ p, game, mode, injury, color, bg, height, rich }: RowProps) {
  const star = p.tier === "star";
  const key = p.tier === "starter";
  const c = statCells(mode, p, game.box[p.id]);
  const status = injury?.status ?? p.injuryStatus;
  const injuryText = injury && [injury.status, [injury.side, injury.type, injury.detail?.toLowerCase()].filter(Boolean).join(" ")].filter(Boolean).join(": ");
  const main = new Set(["pts", "reb", "ast"]);
  const big = star ? "font-display text-lg font-bold @md:text-xl" : "text-sm";
  const meta = [p.positionName, p.age && `age ${p.age}`, p.height, p.experience ? `${p.experience} yrs pro` : "rookie"].filter(Boolean).join(", ");

  return (
    <a
      href={`#/game/${game.id}/p/${p.id}`}
      className={`${GRID} rounded-md px-2 hover:bg-panel-2`}
      style={{ height, background: star ? `linear-gradient(90deg, ${bg}55, transparent 75%)` : undefined }}
    >
      <span className={`text-right font-display font-black leading-none ${star ? "text-3xl" : "text-xl"}`} style={{ color }}>
        {p.jersey}
      </span>
      <Headshot src={p.headshot} name={p.name} className={star ? "size-10 rounded-md bg-panel-2" : "size-8 rounded-full bg-panel-2"} />
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className={`truncate @md:shrink-0 ${star ? "font-display text-xl font-extrabold" : "font-medium"}`}>
            <span className="@md:hidden">{p.firstName?.[0]}. {p.lastName}</span>
            <span className="hidden @md:inline">{p.name}</span>
          </span>
          {!star && <span className="hidden shrink-0 text-xs text-mute @lg:inline">{p.position}</span>}
          {status && (
            <span className="shrink-0" data-tip-title={status} data-tip={[injuryText && injuryText !== status ? injuryText.replace(`${status}: `, "") : "", statusMeaning(status)].filter(Boolean).join("\n\n") || status}>
              <span className="hidden @lg:inline"><InjuryPill status={status} small /></span>
              <span className={`inline-block size-2 rounded-full @lg:hidden ${injuryTone(status) === "out" ? "bg-out" : "bg-doubt"}`} aria-label={status} />
            </span>
          )}
          {c.note && (c.note === "Rookie" ? <Term k="rookie" className="shrink-0 text-xs text-mute">{c.note}</Term> : <span className="shrink-0 text-xs text-mute">{c.note}</span>)}
          {!star && p.honors && <span className="hidden min-w-0 truncate text-xs text-doubt/90 @lg:inline" data-tip-title="Honors" data-tip={p.honors} data-tip-overflow>{p.honors}</span>}
        </div>
        {star && (
          <div className="truncate text-xs text-ink/70" data-tip={`${meta}${p.honors ? `\n${p.honors}` : ""}`} data-tip-overflow>
            {meta}
            {p.honors && <span className="text-doubt/90">, {p.honors}</span>}
          </div>
        )}
        {rich && (star || key) && p.note && (
          <div className={`text-xs italic text-mute ${star ? "line-clamp-2" : "truncate"}`} data-tip-title="Latest note" data-tip={p.note} data-tip-overflow>
            {p.note}
          </div>
        )}
      </div>
      {COLS.map((col) => (
        <Flash
          key={col.key}
          value={c[col.key]}
          scope={mode}
          className={`text-right tnum ${col.show} ${main.has(col.key) ? big : "text-sm text-mute"} ${col.key === "pts" ? "font-semibold" : ""}`}
        />
      ))}
      {p.salarySeason ? (
        <span
          className="hidden text-right text-xs italic tnum text-mute/60 @xl:block"
          data-tip-title={`${money(p.salary)} was his ${p.salarySeason} salary`}
          data-tip="ESPN hasn't published his contract for this season yet (common after a summer signing or trade), so this is last season's pay. The new deal may differ."
        >
          {money(p.salary)}*
        </span>
      ) : (
        <span className="hidden text-right text-xs tnum text-mute @xl:block">{money(p.salary) ?? ""}</span>
      )}
    </a>
  );
}
