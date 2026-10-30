import { useEffect, useState, type ReactNode } from "react";
import type { GameDetail, TeamDetail, TeamRef } from "../../../shared/types";
import { accent, go, tint, tipTime, useGame, useTeam, type StatMode } from "../lib";
import { TeamPanel } from "./TeamPanel";
import { PlayerModal } from "./PlayerModal";
import { MatchupPanel } from "./MatchupPanel";
import { ErrorNote, Flash, Modal, Segmented, Spinner, Term } from "./ui";
import { tip } from "../glossary";

// A fixed-viewport dashboard: nothing on this page scrolls. Detail lives in modals.
export function GamePage({ id, playerId }: { id: string; playerId?: string }) {
  const game = useGame(id);
  const awayTeam = useTeam(game.data?.away.id);
  const homeTeam = useTeam(game.data?.home.id);
  const [side, setSide] = useState<"away" | "home" | "matchup">("away");
  const [matchupOpen, setMatchupOpen] = useState(false);
  const [mode, setMode] = useState<StatMode | null>(null);

  useEffect(() => setMode(null), [id]);

  const g = game.data;
  if (game.isLoading) return <div className="p-6"><Spinner label="Loading the game" /></div>;
  if (game.error || !g) return <div className="p-6"><ErrorNote error={game.error} what="this game" /></div>;

  const statMode = mode ?? defaultMode(g, [awayTeam.data, homeTeam.data]);
  const seasonNow = awayTeam.data?.season ?? homeTeam.data?.season;
  const seasonLast = awayTeam.data?.lastSeason?.season ?? homeTeam.data?.lastSeason?.season;
  const modeOptions: { value: StatMode; label: string }[] = [
    { value: "last", label: seasonLast ?? "Last season" },
    { value: "current", label: seasonNow ?? "This season" },
    ...(g.state !== "pre" ? [{ value: "tonight" as const, label: g.state === "in" ? "Live game" : "This game" }] : []),
  ];

  return (
    <div className="flex h-dvh flex-col overflow-hidden @container">
      <Header game={g} updatedAt={game.dataUpdatedAt} toggle={<Segmented value={statMode} onChange={setMode} options={modeOptions} />} onMatchup={() => setMatchupOpen(true)} />

      <div className="flex shrink-0 flex-wrap items-center gap-2 px-3 py-2 sm:px-4 @4xl:hidden">
        {/* Narrow: one team at a time. */}
        <Segmented
          className="@4xl:hidden"
          value={side}
          onChange={setSide}
          options={[
            ...(["away", "home"] as const).map((s) => ({
              value: s,
              label: (
                <span className="flex items-center gap-1.5">
                  <img src={g[s].logo} alt="" className="size-4" />
                  {g[s].name}
                </span>
              ),
            })),
            { value: "matchup" as const, label: "Matchup" },
          ]}
        />
        <div className="ml-auto">
          <Segmented value={statMode} onChange={setMode} options={modeOptions} />
        </div>
      </div>

      {/* Wide: away | matchup | home. Medium: two teams, matchup in a modal. Narrow: one tab at a time. */}
      <main className="grid min-h-0 flex-1 gap-3 px-3 pb-3 sm:px-4 @4xl:grid-cols-2 @4xl:pt-3 @[100rem]:grid-cols-[minmax(0,1fr)_310px_minmax(0,1fr)]">
        {(["away", "matchup", "home"] as const).map((s) => {
          if (s === "matchup") {
            return (
              <div key={s} className={`min-h-0 flex-col overflow-auto rounded-xl border border-line bg-panel p-3 @[100rem]:overflow-hidden ${side === s ? "flex @4xl:hidden" : "hidden"} @[100rem]:flex`}>
                <MatchupPanel game={g} away={awayTeam.data} home={homeTeam.data} />
              </div>
            );
          }
          const q = s === "away" ? awayTeam : homeTeam;
          return (
            <div key={s} className={`min-h-0 flex-col ${side === s ? "flex" : "hidden @4xl:flex"}`}>
              {q.isLoading && <Spinner label={`Loading ${g[s].displayName}`} />}
              {q.error && <ErrorNote error={q.error} what={g[s].displayName} />}
              {q.data && <TeamPanel team={q.data} game={g} mode={statMode} />}
            </div>
          );
        })}
      </main>

      {matchupOpen && (
        <Modal label="Matchup" onClose={() => setMatchupOpen(false)} className="sm:w-[min(520px,94vw)]">
          <div className="min-h-0 overflow-auto p-5 pt-12">
            <MatchupPanel game={g} away={awayTeam.data} home={homeTeam.data} />
          </div>
        </Modal>
      )}

      {playerId && (
        <PlayerModal playerId={playerId} game={g} teams={[awayTeam.data, homeTeam.data]} onClose={() => go(`#/game/${id}`)} />
      )}
    </div>
  );
}

function defaultMode(g: GameDetail, teams: (TeamDetail | undefined)[]): StatMode {
  if (g.state !== "pre") return "tonight";
  // Early in the season this year's sample is tiny; show last season until teams have ~8 games.
  const gp = Math.max(0, ...teams.flatMap((t) => t?.roster.map((p) => p.current?.gp ?? 0) ?? []));
  return gp >= 8 ? "current" : "last";
}

function Header({ game, updatedAt, toggle, onMatchup }: { game: GameDetail; updatedAt: number; toggle: ReactNode; onMatchup: () => void }) {
  const { away, home, state } = game;
  const ac = accent(away.color, away.altColor);
  const hc = accent(home.color, home.altColor);
  return (
    <header
      className="shrink-0 border-b border-line"
      style={{ background: `linear-gradient(100deg, ${tint(away.color)} 0%, ${tint(away.color)}aa 22%, #18212f 45%, #18212f 55%, ${tint(home.color)}aa 78%, ${tint(home.color)} 100%)` }}
    >
      <div className="flex flex-wrap items-center gap-x-6 gap-y-1 px-3 py-2 sm:px-4">
        <a href="#/" className="text-sm text-ink/80 hover:text-ink" aria-label="Home">‹<span className="hidden @md:inline"> Home</span></a>

        <div className="grid flex-1 grid-cols-[1fr_auto_1fr] items-center gap-3 @4xl:flex-none @4xl:gap-6">
          <HeaderTeam team={away} />
          <div className="text-center leading-none">
            {state === "pre" ? (
              <div className="font-display text-3xl font-black tnum">{tipTime(game.date)}</div>
            ) : (
              <div className="font-display text-3xl font-black tnum">
                <span style={{ ["--team" as string]: ac }}><Flash value={away.score} scope={game.id} className={`px-0.5 ${state === "post" && !away.winner ? "opacity-50" : ""}`} /></span>
                <span className="mx-1 opacity-50">–</span>
                <span style={{ ["--team" as string]: hc }}><Flash value={home.score} scope={game.id} className={`px-0.5 ${state === "post" && !home.winner ? "opacity-50" : ""}`} /></span>
              </div>
            )}
            <div className="mt-0.5 flex items-center justify-center gap-1.5 text-xs text-ink/80">
              {state === "in" && <span className="live-dot size-1.5 rounded-full bg-live" />}
              {state === "pre" ? "tip-off" : game.statusText}
            </div>
            {state === "in" && <UpdatedAgo at={updatedAt} />}
          </div>
          <HeaderTeam team={home} right />
        </div>

        <div className="flex w-full flex-wrap items-center gap-x-5 gap-y-1 text-xs @4xl:ml-auto @4xl:w-auto @4xl:text-sm">
          {game.predictor && <Predictor game={game} />}
          {game.odds && <span><Term k="odds" className="text-ink/60">Favorite</Term> {game.odds}</span>}
          {game.series && game.series !== "0-0" && <span><Term k="series" className="text-ink/60">Series</Term> {game.series}</span>}
          {game.venue && <span className="hidden text-ink/60 @[110rem]:inline">{game.venue}</span>}
          <button onClick={onMatchup} className="hidden rounded-lg border border-white/20 px-2.5 py-1 text-sm font-medium hover:bg-black/20 @4xl:block @[100rem]:hidden">
            Matchup
          </button>
          <span className="hidden items-center gap-2 @4xl:flex">
            <span className="text-xs text-ink/60">Stats from</span>
            {toggle}
          </span>
        </div>
      </div>
    </header>
  );
}

function HeaderTeam({ team, right }: { team: TeamRef; right?: boolean }) {
  return (
    <div className={`flex min-w-0 items-center gap-2 ${right ? "flex-row-reverse text-right" : ""}`}>
      <img src={team.logo} alt="" className="hidden size-9 shrink-0 drop-shadow @md:block" />
      <div className="min-w-0 leading-none">
        <div className="truncate font-display text-2xl font-black uppercase">
          <span className="@xl:hidden">{team.abbr}</span>
          <span className="hidden @xl:inline">{team.name}</span>
        </div>
        <div className="mt-0.5 text-xs text-ink/75 tnum">{team.record}</div>
      </div>
    </div>
  );
}

function Predictor({ game }: { game: GameDetail }) {
  const p = game.predictor!;
  return (
    <div className="flex cursor-help items-center gap-1.5" {...tip("winChance")}>
      <span className="tnum font-semibold">{p.away.toFixed(0)}%</span>
      <div className="flex h-1.5 w-20 overflow-hidden rounded-full @6xl:w-28">
        <div style={{ width: `${p.away}%`, background: accent(game.away.color, game.away.altColor) }} />
        <div style={{ width: `${p.home}%`, background: accent(game.home.color, game.home.altColor) }} />
      </div>
      <span className="tnum font-semibold">{p.home.toFixed(0)}%</span>
      <span className="explain text-ink/60">to win</span>
    </div>
  );
}

/** How fresh the live numbers are. ESPN updates every ~15 s and we poll every 15 s, so this ticks between "just now" and ~30 s. */
function UpdatedAgo({ at }: { at: number }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(t);
  }, []);
  const s = Math.max(0, Math.round((now - at) / 1000));
  return (
    <div className="mt-0.5 text-[10px] text-ink/50 tnum" data-tip="Live stats refresh automatically about every 15 seconds. Changed numbers glow briefly.">
      updated {s < 10 ? "just now" : s < 60 ? `${Math.floor(s / 5) * 5}s ago` : `${Math.floor(s / 60)} min ago`}
    </div>
  );
}
