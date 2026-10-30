import { useState, type ReactNode } from "react";
import { dayLabel, go, tipTime, useGames, useLeaders, useNews, useResults, useSize, useStandings, useTeam, useWatch } from "../lib";
import { TonightAside, TonightPanel } from "./TonightPanel";
import { ResultsPanel } from "./ResultsPanel";
import { LeadersPanel, NewsPanel, StandingsPanel } from "./LeaguePanels";
import { PlayerModal } from "./PlayerModal";
import { TeamModal } from "./TeamModal";
import { ErrorNote, Modal, Segmented, Spinner, Term } from "./ui";

// The home page is a fixed-viewport dashboard like the game page: no page scroll.
// Panels in priority order; the wider the window, the more of them get their own column,
// and whatever is left shares the last column behind tabs.
type Key = "tonight" | "results" | "standings" | "leaders" | "news";

const COLUMNS: [number, number][] = [[1880, 5], [1500, 4], [1100, 3], [720, 2], [0, 1]];
const WIDTHS: Record<number, string> = {
  1: "1fr",
  2: "minmax(0,1.25fr) minmax(0,1fr)",
  3: "minmax(0,1.3fr) minmax(0,1fr) minmax(0,1fr)",
  4: "minmax(0,1.35fr) minmax(0,1fr) minmax(0,1.05fr) minmax(0,1fr)",
  5: "minmax(0,1.4fr) minmax(0,1fr) minmax(0,1.05fr) minmax(0,1fr) minmax(0,0.9fr)",
};

export function HomePage({ playerId, teamId }: { playerId?: string; teamId?: string }) {
  const games = useGames();
  const watch = useWatch(games.data?.date);
  const results = useResults();
  const standings = useStandings();
  const leaders = useLeaders();
  const news = useNews();
  const [ref, { w }] = useSize<HTMLElement>();
  const [tab, setTab] = useState<Key | null>(null);

  const g = games.data;
  const tonight = new Map<string, string>();
  for (const x of g?.games ?? []) {
    tonight.set(x.away.id, `Plays tonight at ${x.home.name}, ${tipTime(x.date)}`);
    tonight.set(x.home.id, `Plays tonight vs ${x.away.name}, ${tipTime(x.date)}`);
  }

  const panels: Record<Key, { title: string; aside?: ReactNode; body: ReactNode }> = {
    tonight: {
      title: g?.upcoming ? `Next games: ${dayLabel(g.date)}` : "Tonight",
      aside: g?.games.length ? <TonightAside games={g.games} watch={watch.data} /> : undefined,
      body: <Load q={games} what="the schedule">{(d) => d.games.length ? <TonightPanel games={d.games} watch={watch.data} /> : <Empty>No NBA games in the next 10 days. It's probably the offseason.</Empty>}</Load>,
    },
    results: {
      title: "Results",
      aside: <Term k="topPerformer">Best player per team</Term>,
      body: <Load q={results} what="results">{(d) => d.days.length ? <ResultsPanel days={d.days} /> : <Empty>No recent results.</Empty>}</Load>,
    },
    standings: {
      title: "Standings",
      aside: <Term k="seed">Top 6 in, 7-10 play-in</Term>,
      body: <Load q={standings} what="standings">{(d) => <StandingsPanel standings={d} tonight={tonight} />}</Load>,
    },
    leaders: {
      title: "League leaders",
      aside: <Term k="leaders">Per game, {leaders.data?.season}</Term>,
      body: <Load q={leaders} what="league leaders">{(d) => <LeadersPanel categories={d.categories} />}</Load>,
    },
    news: {
      title: "News",
      aside: "From ESPN",
      body: <Load q={news} what="news">{(d) => <NewsPanel news={d} />}</Load>,
    },
  };

  const order: Key[] = ["tonight", "results", "standings", "leaders", "news"];
  const cols = w ? COLUMNS.find(([min]) => w >= min)![1] : 1;
  const own = order.slice(0, cols - 1);
  const shared = order.slice(cols - 1);
  const active = tab && shared.includes(tab) ? tab : shared[0];

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <header className="flex shrink-0 items-baseline gap-4 px-3 pb-2 pt-3 sm:px-4">
        <span className="font-display text-2xl font-extrabold tracking-wide">Courtside</span>
        {g && <span className="truncate text-sm text-mute">{dayLabel(g.date)}, US time. All times are yours.</span>}
      </header>
      <main ref={ref} className="grid min-h-0 flex-1 gap-3 px-3 pb-3 sm:px-4" style={{ gridTemplateColumns: WIDTHS[cols] }}>
        {own.map((k) => (
          <Panel key={k} title={panels[k].title} aside={panels[k].aside}>{panels[k].body}</Panel>
        ))}
        <Panel
          title={shared.length === 1 ? panels[active].title : undefined}
          aside={panels[active].aside}
          tabs={shared.length > 1 ? (
            <Segmented value={active} onChange={setTab} options={shared.map((k) => ({ value: k, label: TAB_LABEL[k] }))} />
          ) : undefined}
        >
          {panels[active].body}
        </Panel>
      </main>
      {playerId && <PlayerModal playerId={playerId} onClose={() => go("#/")} />}
      {teamId && <TeamLoader id={teamId} />}
    </div>
  );
}

const TAB_LABEL: Record<Key, string> = { tonight: "Tonight", results: "Results", standings: "Standings", leaders: "Leaders", news: "News" };

function Panel({ title, aside, tabs, children }: { title?: string; aside?: ReactNode; tabs?: ReactNode; children: ReactNode }) {
  return (
    <section className="flex min-h-0 min-w-0 flex-col rounded-xl border border-line bg-court/40 p-3">
      <div className="mb-2 flex shrink-0 flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-line pb-2">
        {tabs ? tabs : <h2 className="font-display text-2xl font-bold leading-none tracking-wide">{title}</h2>}
        {aside && <div className="text-xs text-mute">{aside}</div>}
      </div>
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </section>
  );
}

function Load<T>({ q, what, children }: { q: { data?: T; isLoading: boolean; error: unknown }; what: string; children: (d: T) => ReactNode }) {
  if (q.data) return <>{children(q.data)}</>;
  if (q.error) return <ErrorNote error={q.error} what={what} />;
  return <Spinner label={`Loading ${what}`} />;
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="py-6 text-sm text-mute">{children}</p>;
}

/** Team "About" modal from the standings: needs the full team, which takes a moment the first time. */
function TeamLoader({ id }: { id: string }) {
  const q = useTeam(id);
  const close = () => go("#/");
  if (q.data) return <TeamModal team={q.data} injuries={[]} onClose={close} />;
  return (
    <Modal label="Team" onClose={close} className="sm:w-[min(420px,94vw)]">
      <div className="p-6">{q.error ? <ErrorNote error={q.error} what="this team" /> : <Spinner label="Loading the team (first time takes a few seconds)" />}</div>
    </Modal>
  );
}
