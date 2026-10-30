// Salaries ESPN doesn't have yet. ESPN's roster has no current contract for anyone who signed, re-signed or
// was drafted over the summer (~40% of the league in October). This community dataset scrapes Spotrac daily:
// https://github.com/gabriel1200/site_Data (nba_salaries.csv). We only use it to fill ESPN's gaps: where both
// have a number, ESPN's tends to be right (the CSV sometimes holds only the guaranteed part of a deal).
import { getText, TTL } from "./espn.ts";

const CSV = "https://raw.githubusercontent.com/gabriel1200/site_Data/master/nba_salaries.csv";
export const SALARY_SOURCE = "Spotrac, via a community dataset updated daily";

/** "Labaron Philon Jr." and "Labaron Philon", "Nikola Jokić" and "Nikola Jokic" are the same player. */
export const nameKey = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\b(jr|sr|ii|iii|iv)\b/g, "").replace(/[^a-z]/g, "");

/** Player name key -> salary for the given season ("2026-27"). Empty if the dataset is unreachable. */
export async function seasonSalaries(season: string): Promise<Map<string, number>> {
  const text = await getText(CSV, TTL.day).catch(() => "");
  const [head, ...lines] = text.trim().split("\n");
  const cols = head?.split(",") ?? [];
  const col = cols.indexOf(season);
  const out = new Map<string, number>();
  if (col < 0) return out;
  for (const line of lines) {
    const c = line.split(",");
    const salary = parseFloat(c[col]);
    if (salary > 0) out.set(nameKey(c[0]), salary);
  }
  return out;
}
