import { useRoute } from "./lib";
import { HomePage } from "./components/HomePage";
import { GamePage } from "./components/GamePage";
import { Tooltips } from "./components/ui";

export function App() {
  const route = useRoute();
  // Both pages are fixed-viewport dashboards: nothing scrolls, detail lives in modals.
  return (
    <div className="@container">
      {route.page === "game" ? <GamePage id={route.id} playerId={route.playerId} /> : <HomePage playerId={route.playerId} teamId={route.teamId} />}
      <Tooltips />
    </div>
  );
}
