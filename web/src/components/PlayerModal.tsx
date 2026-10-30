import { useState } from "react";
import type { GameDetail, Injury, PlayerDetail, RosterPlayer, StatLine, TeamDetail } from "../../../shared/types";
import { accent, money, one, tierLabel, tint, usePlayer } from "../lib";
import { ErrorNote, Headshot, InjuryPill, Modal, Segmented, Spinner, Term } from "./ui";
import { tip } from "../glossary";

interface Props {
  playerId: string;
  game?: GameDetail; // absent when opened from the home page
  teams?: (TeamDetail | undefined)[];
  onClose: () => void;
}

type Tab = "overview" | "stats" | "games" | "news";

export function PlayerModal({ playerId, game, teams = [], onClose }: Props) {
  const { data: p, isLoading, error } = usePlayer(playerId);
  const [tab, setTab] = useState<Tab>("overview");

  // Roster entry (contract, importance) and game injury detail come from data we already have.
  const team = teams.find((t) => t?.roster.some((r) => r.id === playerId));
  const rp = team?.roster.find((r) => r.id === playerId);
  const injury = Object.values(game?.injuries ?? {}).flat().find((i) => i.athleteId === playerId);
  // From the home page there's no roster at hand; the player's own team still gives the colors.
  const teamColor = team?.team.color ?? p?.team?.color;
  const color = teamColor ? accent(teamColor) : "#aab4c3";
  const bg = teamColor ? tint(teamColor) : "#2a3240";

  const tabs: { value: Tab; label: string }[] = [
    { value: "overview", label: "Overview" },
    { value: "stats", label: "Seasons" },
    ...(p?.recentGames.length ? [{ value: "games" as const, label: "Recent games" }] : []),
    ...(p?.news.length ? [{ value: "news" as const, label: "News" }] : []),
  ];

  return (
    <Modal label={p?.name ?? "Player"} onClose={onClose} className="@container sm:h-[min(640px,90dvh)] sm:w-[min(940px,94vw)]">
      {isLoading && <div className="p-6"><Spinner label="Loading player" /></div>}
      {error && <div className="p-6"><ErrorNote error={error} what="this player" /></div>}
      {p && (
        <div className="flex min-h-0 flex-1 flex-col @2xl:flex-row" style={{ ["--team" as string]: color }}>
          {/* Identity column */}
          <aside className="flex shrink-0 flex-col @2xl:w-[300px] @2xl:border-r @2xl:border-line">
            <div className="relative h-[150px] shrink-0 overflow-hidden @2xl:h-[230px]" style={{ background: `linear-gradient(160deg, ${bg}, ${bg}66 60%, #0f1622)` }}>
              {p.jersey && (
                <span className="jersey-ghost absolute -left-2 -top-5 text-[10rem] @2xl:text-[14rem]" style={{ ["--team" as string]: "#fff" }} aria-hidden>
                  {p.jersey}
                </span>
              )}
              <Headshot src={p.headshot} name={p.name} className="absolute bottom-0 right-0 h-full w-auto max-w-[60%] object-contain object-bottom @2xl:h-[85%] @2xl:max-w-[62%]" />
              <div className="absolute bottom-0 left-0 max-w-[60%] p-4">
                <h2 className="font-display text-3xl font-black uppercase leading-[0.9] drop-shadow @2xl:text-4xl">
                  {p.name.split(" ").map((w, i) => <span key={i} className="block">{w}</span>)}
                </h2>
                <div className="mt-1 text-xs text-ink/85 drop-shadow">#{p.jersey} {p.position}, {p.team?.abbr}</div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 px-4 pt-3">
              {rp && <span className="rounded-full px-2 py-px text-xs font-semibold text-court" style={{ background: color }}>{tierLabel[rp.tier]}</span>}
              {rp && <Term k="importance" className="text-xs text-mute">importance {rp.importance}/100</Term>}
              <InjuryPill status={injury?.status ?? rp?.injuryStatus} small />
            </div>
            <div className="hidden px-4 py-3 @2xl:block">
              <Facts p={p} rp={rp} />
            </div>
          </aside>

          {/* Detail column */}
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="shrink-0 px-4 pb-2 pt-3 @2xl:pr-20">
              <Segmented value={tab} onChange={setTab} options={tabs} />
            </div>
            <div className="min-h-0 flex-1 overflow-auto px-4 pb-4">
              {tab === "overview" && <Overview p={p} rp={rp} injury={injury} game={game} />}
              {tab === "stats" && <SeasonTable seasons={p.seasons} career={p.career} />}
              {tab === "games" && <RecentGames p={p} />}
              {tab === "news" && (
                <ul className="space-y-3">
                  {p.news.map((n) => (
                    <li key={n.headline}>
                      <a href={n.url} target="_blank" rel="noreferrer" className="font-medium hover:underline">{n.headline}</a>
                      {n.description && <div className="line-clamp-1 text-sm text-mute" data-tip={n.description} data-tip-overflow>{n.description}</div>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}

function Overview({ p, rp, injury, game }: { p: PlayerDetail; rp?: RosterPlayer; injury?: Injury; game?: GameDetail }) {
  const box = game && game.state !== "pre" ? game.box[p.id] : undefined;
  const label = "mb-1.5 font-display text-lg font-bold";
  return (
    <div className="space-y-4">
      <div className="@2xl:hidden">
        <Facts p={p} rp={rp} />
      </div>

      {injury && <InjuryDetail injury={injury} />}

      {box && (
        <div className="rounded-lg border border-live/40 bg-live/10 p-3 text-sm tnum">
          {box.didNotPlay ? "Didn't play in this game." : (
            <>
              <b className="text-live">{game?.state === "in" ? "Live" : "This game"}</b> {box.pts} pts, {box.reb} reb, {box.ast} ast,{" "}
              <Term k="madeAttempted">FG {box.fg}, 3PT {box.threes}</Term>, {box.min} min, <Term k="plusMinus">{box.plusMinus} +/-</Term>
              {box.starter ? ", started" : ", off the bench"}
            </>
          )}
        </div>
      )}

      {p.latestNote && (
        <div>
          <h3 className={label}>Latest</h3>
          <p className="font-medium">{p.latestNote.headline}</p>
          {p.latestNote.story && <p className="mt-1 line-clamp-4 text-sm leading-relaxed text-ink/80" data-tip={p.latestNote.story} data-tip-overflow>{p.latestNote.story}</p>}
        </div>
      )}

      {p.awards.length > 0 && (
        <div>
          <h3 className={label}>Honors</h3>
          <ul className="flex flex-wrap gap-1.5">
            {p.awards.map((a) => (
              <li key={a.name} className="rounded-md border border-line bg-panel px-2 py-0.5 text-sm" data-tip-title={a.name} data-tip={a.seasons.length ? `Seasons: ${a.seasons.join(", ")}` : undefined}>
                <b className="tnum">{a.count}</b> {a.name}
              </li>
            ))}
          </ul>
        </div>
      )}

      {p.teamsPath.length > 0 && (
        <div>
          <h3 className={label}>Career path</h3>
          <ol className="flex flex-wrap items-center gap-1.5 text-sm">
            {p.teamsPath.map((t, i) => (
              <li key={`${t}-${i}`} className="flex items-center gap-1.5">
                {i > 0 && <span className="text-mute" aria-hidden>›</span>}
                <span className="rounded bg-panel px-2 py-0.5 font-semibold">{t.toUpperCase()}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

function InjuryDetail({ injury }: { injury: Injury }) {
  const what = [injury.side, injury.type, injury.detail?.toLowerCase()].filter(Boolean).join(" ");
  return (
    <div className="rounded-lg border border-out/30 bg-out/10 p-3 text-sm">
      <b>{injury.status}</b>
      {what && `: ${what}`}
      {injury.returnDate && `. Expected back around ${new Date(injury.returnDate).toLocaleDateString([], { month: "long", day: "numeric" })}.`}
    </div>
  );
}

function Facts({ p, rp }: { p: PlayerDetail; rp?: RosterPlayer }) {
  const contract = rp?.salary
    ? `${money(rp.salary)} this season${rp.contractYearsLeft ? `, ${rp.contractYearsLeft} more yr${rp.contractYearsLeft > 1 ? "s" : ""} after` : ""}`
    : undefined;
  const items: [string, string | number | undefined, string?][] = [
    ["Age", p.age && `${p.age}${p.dob ? ` (born ${p.dob})` : ""}`],
    ["Size", [p.height, p.weight].filter(Boolean).join(", ")],
    ["From", [p.birthPlace, p.citizenship && p.citizenship !== "USA" && !p.birthPlace?.includes(p.citizenship) ? p.citizenship : undefined].filter(Boolean).join(", ")],
    ["College", p.college],
    ["Draft", p.draft ?? "Undrafted", "draft"],
    ["Experience", p.experience, "experience"],
    ["Contract", contract],
  ];
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm @2xl:grid-cols-1">
      {items.filter(([, v]) => v).map(([k, v, t]) => (
        <div key={k} className="min-w-0 @2xl:grid @2xl:grid-cols-[80px_1fr] @2xl:gap-2">
          <dt className="text-xs text-mute @2xl:pt-0.5">{t ? <Term k={t}>{k}</Term> : k}</dt>
          <dd className="font-medium leading-snug">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function SeasonTable({ seasons, career }: { seasons: StatLine[]; career?: StatLine }) {
  const [all, setAll] = useState(false);
  const rows = [...seasons].reverse();
  const shown = all ? rows : rows.slice(0, 9);
  const cols: [string, (s: StatLine) => string, string][] = [
    ["GP", (s) => String(s.gp), "gp"],
    ["MIN", (s) => one(s.min), "min"],
    ["PTS", (s) => one(s.pts), "pts"],
    ["REB", (s) => one(s.reb), "reb"],
    ["AST", (s) => one(s.ast), "ast"],
    ["FG%", (s) => one(s.fgPct), "fg"],
    ["3P%", (s) => one(s.threePct), "3p"],
  ];
  if (!seasons.length) return <p className="text-mute">No NBA games yet.</p>;
  return (
    <div>
      <table className="w-full text-sm tnum">
        <thead className="text-xs text-mute">
          <tr>
            <th className="py-1 text-left font-normal">Season, per game</th>
            {cols.map(([c, , t]) => <th key={c} className="text-right font-normal"><Term k={t}>{c}</Term></th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {shown.map((s, i) => (
            <tr key={`${s.season}-${s.team}-${i}`}>
              <td className="py-1">{s.season} <span className="text-xs text-mute">{s.team?.toUpperCase()}</span></td>
              {cols.map(([c, f]) => <td key={c} className={`text-right ${c === "PTS" ? "font-semibold" : ""}`}>{f(s)}</td>)}
            </tr>
          ))}
          {career && (
            <tr className="border-t-2 border-line font-semibold">
              <td className="py-1">Career</td>
              {cols.map(([c, f]) => <td key={c} className="text-right">{f(career)}</td>)}
            </tr>
          )}
        </tbody>
      </table>
      {rows.length > shown.length && (
        <button onClick={() => setAll(true)} className="mt-2 text-sm text-mute hover:text-ink">
          Show {rows.length - shown.length} earlier seasons
        </button>
      )}
    </div>
  );
}

function RecentGames({ p }: { p: PlayerDetail }) {
  return (
    <table className="w-full text-sm tnum">
      <thead className="text-xs text-mute">
        <tr className="text-left">
          <th className="py-1 font-normal">Date</th><th className="font-normal">Opp</th><th className="font-normal">Result</th>
          {(["min", "pts", "reb", "ast"] as const).map((k) => (
            <th key={k} className="text-right font-normal"><span className="explain" {...tip(k)}>{k.toUpperCase()}</span></th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-line">
        {p.recentGames.map((g) => (
          <tr key={g.date}>
            <td className="py-1">{new Date(g.date).toLocaleDateString([], { month: "short", day: "numeric" })}</td>
            <td>{g.atVs} {g.opponent}</td>
            <td className={g.result === "W" ? "text-live" : "text-out"}>{g.result} {g.score}</td>
            <td className="text-right">{g.min}</td><td className="text-right font-semibold">{g.pts}</td><td className="text-right">{g.reb}</td><td className="text-right">{g.ast}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
