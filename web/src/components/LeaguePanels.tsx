import { useState } from "react";
import type { LeaderCategory, NewsItem, StandingRow, Standings } from "../../../shared/types";
import { accent, go, ordinal, timeAgo, useSize } from "../lib";
import { tip } from "../glossary";
import { Headshot, Segmented, Term } from "./ui";

// ---------- standings ----------

const CONF_HEAD = 46; // conference title + column header
const ROW_MIN = 19;

/** Both conferences stacked if they fit, side by side if the panel is wide, else one at a time. */
export function StandingsPanel({ standings, tonight }: { standings: Standings; tonight: Map<string, string> }) {
  const [ref, { w, h }] = useSize<HTMLDivElement>();
  const [conf, setConf] = useState(0);
  const confs = standings.conferences;
  const stackedRow = Math.floor((h - confs.length * CONF_HEAD - 8) / (confs.length * 15));
  const mode = stackedRow >= ROW_MIN ? "stacked" : w >= 600 ? "side" : "one";
  const rowH = Math.min(28, mode === "stacked" ? stackedRow : Math.floor((h - CONF_HEAD - (mode === "one" ? 36 : 0)) / 15));

  return (
    <div ref={ref} className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {mode === "one" && (
        <Segmented className="mb-2 self-start" value={String(conf)} onChange={(v) => setConf(Number(v))} options={confs.map((c, i) => ({ value: String(i), label: c.name }))} />
      )}
      <div className={`grid min-h-0 gap-x-4 gap-y-2 ${mode === "side" ? "grid-cols-2" : ""}`}>
        {confs.map((c, i) =>
          mode === "one" && i !== conf ? null : <Conference key={c.name} name={mode === "one" ? undefined : c.name} rows={c.rows} rowH={Math.max(rowH, ROW_MIN)} tonight={tonight} />,
        )}
      </div>
    </div>
  );
}

const SCOLS = "grid grid-cols-[1.25rem_minmax(0,1fr)_2.75rem_2.25rem] @[19rem]:grid-cols-[1.25rem_minmax(0,1fr)_2.75rem_2.25rem_2.5rem_2.25rem] @[26rem]:grid-cols-[1.25rem_minmax(0,1fr)_2.75rem_2.25rem_2.5rem_2.25rem_2.75rem_2.5rem] items-center gap-x-2";

function Conference({ name, rows, rowH, tonight }: { name?: string; rows: StandingRow[]; rowH: number; tonight: Map<string, string> }) {
  return (
    <section className="@container min-w-0">
      {name && <h4 className="font-display text-lg font-bold leading-6">{name}</h4>}
      <div className={`${SCOLS} h-[22px] border-b border-line text-[11px] text-mute`}>
        <Term k="seed">#</Term>
        <span>Team</span>
        <Term k="winLoss" className="justify-self-end">W-L</Term>
        <Term k="gb" className="justify-self-end">GB</Term>
        <Term k="last10" className="hidden justify-self-end @[19rem]:inline">L10</Term>
        <Term k="streak" className="hidden justify-self-end @[19rem]:inline">Strk</Term>
        <Term k="margin" className="hidden justify-self-end @[26rem]:inline">+/-</Term>
        <Term k="bpi" className="hidden justify-self-end @[26rem]:inline">Str.</Term>
      </div>
      {rows.map((r) => {
        const zone = r.seed <= 6 ? "" : r.seed <= 10 ? "text-doubt" : "text-mute/60";
        const playing = tonight.get(r.team.id);
        return (
          <button
            key={r.team.id}
            onClick={() => go(`#/t/${r.team.id}`)}
            className={`${SCOLS} w-full text-left text-sm hover:bg-panel-2 ${r.seed === 6 || r.seed === 10 ? "border-b border-dashed border-line" : ""}`}
            style={{ height: rowH }}
          >
            <span className={`text-xs tnum ${zone}`} {...tip("seed", r.seed <= 6 ? "In a playoff spot." : r.seed <= 10 ? "In a play-in spot." : "Outside the playoff picture right now.")}>{r.seed}</span>
            <span className="flex min-w-0 items-center gap-1.5">
              <img src={r.team.logo} alt="" className="size-4 shrink-0" />
              <span className="truncate" data-tip={playing}>
                <span className="@[19rem]:hidden">{r.team.abbr}</span>
                <span className="hidden @[19rem]:inline">{r.team.name}</span>
              </span>
            </span>
            <span className="justify-self-end font-semibold tnum">{r.wins}-{r.losses}</span>
            <span className="justify-self-end text-xs text-mute tnum">{r.gb}</span>
            <span className="hidden justify-self-end text-xs text-mute tnum @[19rem]:inline">{r.last10}</span>
            <span className={`hidden justify-self-end text-xs tnum @[19rem]:inline ${r.streak.startsWith("W") ? "text-live" : "text-mute"}`}>{r.streak}</span>
            <span className={`hidden justify-self-end text-xs tnum @[26rem]:inline ${r.diff > 0 ? "text-ink/80" : "text-mute"}`}>{r.diff > 0 ? "+" : ""}{r.diff.toFixed(1)}</span>
            <span className="hidden justify-self-end text-xs text-mute tnum @[26rem]:inline">{r.strength ? ordinal(r.strength) : ""}</span>
          </button>
        );
      })}
    </section>
  );
}

// ---------- league leaders ----------

const CAT_HEAD = 26;
const LEADER_H = 26;

/** As many categories and names per category as the panel holds (at least 3 names each). */
export function LeadersPanel({ categories }: { categories: LeaderCategory[] }) {
  const [ref, { w, h }] = useSize<HTMLDivElement>();
  const cols = w >= 560 ? 2 : 1;
  let shown = categories.length;
  const perCat = (k: number) => Math.floor((h / Math.ceil(k / cols) - CAT_HEAD - 8) / LEADER_H);
  while (shown > 1 && perCat(shown) < 3) shown--;
  const rows = Math.max(1, Math.min(10, perCat(shown)));

  return (
    <div ref={ref} className="grid min-h-0 flex-1 content-start gap-x-5 gap-y-2 overflow-hidden" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
      {categories.slice(0, shown).map((c) => (
        <section key={c.key} className="min-w-0">
          <Term k={c.key} className="block font-display text-base font-bold leading-[26px]">{c.label}</Term>
          <ol>
            {c.leaders.slice(0, rows).map((l, i) => (
              <li key={l.id}>
                <button onClick={() => go(`#/p/${l.id}`)} className="flex w-full items-center gap-2 rounded px-1 text-left text-sm hover:bg-panel-2" style={{ height: LEADER_H }}>
                  <span className="w-4 text-xs text-mute tnum">{i + 1}</span>
                  <Headshot src={l.headshot} name={l.name} className="size-5 shrink-0 rounded-full bg-panel-2" />
                  <span className="min-w-0 flex-1 truncate">{l.name}</span>
                  <span className="text-xs font-semibold" style={{ color: accent(l.color) }}>{l.team}</span>
                  <span className={`w-9 text-right font-display text-base tnum ${i === 0 ? "font-extrabold" : "font-semibold text-ink/85"}`}>{l.value}</span>
                </button>
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}

// ---------- news ----------

const NEWS_H = 70;

export function NewsPanel({ news }: { news: NewsItem[] }) {
  const [ref, { w, h }] = useSize<HTMLDivElement>();
  const count = Math.max(1, Math.floor((h + 8) / (NEWS_H + 8)));
  const images = w >= 340;
  return (
    <div ref={ref} className="min-h-0 flex-1 overflow-hidden">
      <ul className="flex flex-col gap-2">
        {news.slice(0, count).map((n) => (
          <li key={n.headline}>
            <a href={n.url} target="_blank" rel="noreferrer" className="group flex gap-3 overflow-hidden" style={{ height: NEWS_H }}>
              {images && n.image && <img src={n.image} alt="" loading="lazy" className="h-full w-[106px] shrink-0 rounded-md object-cover" />}
              <span className="flex min-w-0 flex-col">
                <span className="line-clamp-2 text-sm font-semibold leading-snug group-hover:underline" data-tip={n.headline} data-tip-overflow>{n.headline}</span>
                {n.description && <span className="line-clamp-1 text-xs text-mute" data-tip={n.description} data-tip-overflow>{n.description}</span>}
                <span className="mt-auto text-[11px] text-mute">{timeAgo(n.published)}</span>
              </span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
