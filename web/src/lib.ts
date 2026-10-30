import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import type {
  GameCard, GameDetail, LeaderCategory, NewsItem, PlayerDetail, ResultCard, Standings, StatLine, TeamDetail, Tier, WatchGuide,
} from "../../shared/types";

// ---------- data ----------

async function get<T>(path: string): Promise<T> {
  const r = await fetch(path);
  if (!r.ok) {
    const body = await r.json().catch(() => ({}));
    throw new Error(body.error ?? `Request failed (${r.status})`);
  }
  return r.json();
}

export const useGames = () =>
  useQuery({
    queryKey: ["games"],
    queryFn: () => get<{ date: string; games: GameCard[]; upcoming?: boolean }>("/api/games"),
    refetchInterval: 30_000,
  });

// Home page. Pre-game facts move slowly; scores come from useGames.
export const useWatch = (date?: string) =>
  useQuery({
    queryKey: ["watch", date],
    queryFn: () => get<Record<string, WatchGuide>>(`/api/watch?date=${date!.replaceAll("-", "")}`),
    enabled: !!date,
    refetchInterval: 5 * 60_000,
  });

export const useResults = () =>
  useQuery({ queryKey: ["results"], queryFn: () => get<{ days: { date: string; games: ResultCard[] }[] }>("/api/results"), refetchInterval: 10 * 60_000 });

export const useStandings = () =>
  useQuery({ queryKey: ["standings"], queryFn: () => get<Standings>("/api/standings"), refetchInterval: 10 * 60_000 });

export const useLeaders = () =>
  useQuery({ queryKey: ["leaders"], queryFn: () => get<{ season: string; categories: LeaderCategory[] }>("/api/leaders"), refetchInterval: 30 * 60_000 });

export const useNews = () =>
  useQuery({ queryKey: ["news"], queryFn: () => get<NewsItem[]>("/api/news"), refetchInterval: 10 * 60_000 });

export const useGame = (id: string) =>
  useQuery({
    queryKey: ["game", id],
    queryFn: () => get<GameDetail>(`/api/game/${id}`),
    refetchInterval: (q) => {
      const g = q.state.data;
      if (g?.state === "in") return 15_000;
      // Around tip-off, check often so the switch to live isn't missed.
      if (g?.state === "pre" && Date.parse(g.date) - Date.now() < 15 * 60_000) return 30_000;
      return 5 * 60_000;
    },
  });

export const useTeam = (id?: string) =>
  useQuery({
    queryKey: ["team", id],
    queryFn: () => get<TeamDetail>(`/api/team/${id}`),
    enabled: !!id,
    staleTime: 30 * 60_000,
  });

export const usePlayer = (id?: string) =>
  useQuery({
    queryKey: ["player", id],
    queryFn: () => get<PlayerDetail>(`/api/player/${id}`),
    enabled: !!id,
    staleTime: 30 * 60_000,
  });

// ---------- routing (hash based, no dependency) ----------
// #/                      home (tonight, results, standings, leaders, news)
// #/p/:playerId, #/t/:teamId  home with a player or team modal open
// #/game/:id              game page
// #/game/:id/p/:playerId  game page with player sheet open

export type Route = { page: "home"; playerId?: string; teamId?: string } | { page: "game"; id: string; playerId?: string };

function parse(hash: string): Route {
  const m = hash.match(/^#\/game\/(\w+)(?:\/p\/(\w+))?/);
  if (m) return { page: "game", id: m[1], playerId: m[2] };
  return { page: "home", playerId: hash.match(/^#\/p\/(\w+)/)?.[1], teamId: hash.match(/^#\/t\/(\w+)/)?.[1] };
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parse(location.hash));
  useEffect(() => {
    const on = () => setRoute(parse(location.hash));
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return route;
}

export const go = (hash: string) => {
  location.hash = hash;
};

// ---------- formatting ----------

export function money(n?: number) {
  if (!n) return undefined;
  return n >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : `$${Math.round(n / 1e3)}K`;
}

export const one = (n?: number) => (n === undefined ? "–" : n.toFixed(1));

export function tipTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function dayLabel(ymd: string) {
  return new Date(`${ymd}T12:00:00`).toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });
}

export function ordinal(n: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/** Which season line to headline: this season once it has a real sample, otherwise last season. */
export function headlineLine(cur?: StatLine, last?: StatLine): StatLine | undefined {
  if (cur && cur.gp >= 8) return cur;
  return last ?? cur;
}

export const tierLabel: Record<Tier, string> = {
  star: "Star",
  starter: "Key player",
  rotation: "Rotation",
  bench: "Bench",
};

// ---------- team colors ----------

function lum(hex: string) {
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** A team color readable as text/strokes on the dark background: lightened toward white until it has ~3:1 contrast. */
export function accent(primary: string, _alt?: string) {
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(primary.slice(i, i + 2), 16));
  for (let t = 0; t <= 0.8; t += 0.05) {
    const hex = [r, g, b].map((c) => Math.round(c + (255 - c) * t).toString(16).padStart(2, "0")).join("");
    if (lum(hex) >= 0.13) return `#${hex}`;
  }
  return "#aab4c3";
}

/** Background tint: the raw primary color, or a lifted slate for near-black teams. */
export function tint(primary: string) {
  return lum(primary) < 0.01 ? "#2a3240" : `#${primary}`;
}

export function injuryTone(status?: string) {
  if (!status) return undefined;
  return /out|injured reserve|suspen/i.test(status) ? "out" : "doubt";
}

/** Which numbers the roster tables show: a season's per-game averages, or this game's box score. */
export type StatMode = "last" | "current" | "tonight";

/** Track an element's size, so panels can pick a layout for the space they actually have. */
export function useSize<T extends HTMLElement>() {
  const [el, ref] = useState<T | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, [el]);
  return [ref, size] as const;
}

export function timeAgo(iso?: string) {
  if (!iso) return "";
  const m = Math.round((Date.now() - Date.parse(iso)) / 60_000);
  if (m < 60) return `${Math.max(m, 1)} min ago`;
  if (m < 48 * 60) return `${Math.round(m / 60)} h ago`;
  return `${Math.round(m / 1440)} days ago`;
}

/** Track an element's height, so layouts can fit content to the viewport instead of scrolling. */
export function useHeight<T extends HTMLElement>() {
  const [el, ref] = useState<T | null>(null);
  const [h, setH] = useState(0);
  useEffect(() => {
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setH(e.contentRect.height));
    ro.observe(el);
    return () => ro.disconnect();
  }, [el]);
  return [ref, h] as const;
}
