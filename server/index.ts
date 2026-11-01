import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getGame, getGames, getPlayer, getTeam } from "./data.ts";
import { getLeaders, getNews, getResults, getStandings, getWatch } from "./home.ts";
import { cacheStats } from "./espn.ts";

const PORT = Number(process.env.PORT ?? 5180);
const HOST = process.env.HOST ?? "127.0.0.1"; // local default; the container sets HOST and PORT
const root = path.dirname(fileURLToPath(import.meta.url));

const app = express();

const route = (fn: (req: express.Request) => Promise<unknown>): express.RequestHandler => async (req, res) => {
  try {
    res.json(await fn(req));
  } catch (err) {
    console.error(err);
    res.status(502).json({ error: (err as Error).message });
  }
};

app.get("/api/health", (_req, res) => res.json({ ok: true, ...cacheStats() }));
app.get("/api/games", route((req) => getGames(typeof req.query.date === "string" ? req.query.date : undefined)));
app.get("/api/watch", route((req) => getWatch(typeof req.query.date === "string" ? req.query.date : undefined)));
app.get("/api/results", route(() => getResults()));
app.get("/api/standings", route(() => getStandings()));
app.get("/api/leaders", route(() => getLeaders()));
app.get("/api/news", route(() => getNews()));
app.get("/api/game/:id", route((req) => getGame(req.params.id)));
app.get("/api/team/:id", route((req) => getTeam(req.params.id)));
app.get("/api/player/:id", route((req) => getPlayer(req.params.id)));

// In production mode serve the built frontend.
const dist = path.join(root, "../dist");
app.use(express.static(dist));
app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(path.join(dist, "index.html")));

app.listen(PORT, HOST, () => console.log(`nba-tracker on http://${HOST}:${PORT}`));
