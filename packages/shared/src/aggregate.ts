import type { Meal, Nutrients } from "./types";
import { addNutrients, emptyNutrients, roundNutrients } from "./nutrients";

export function mealTotals(meal: Meal): Nutrients {
  return meal.items.reduce((acc, i) => addNutrients(acc, i.nutrients), emptyNutrients());
}

export function sumMeals(meals: Meal[]): Nutrients {
  return roundNutrients(meals.reduce((acc, m) => addNutrients(acc, mealTotals(m)), emptyNutrients()));
}

/** YYYY-MM-DD in the given IANA timezone. */
export function localDateKey(iso: string | Date, timeZone: string): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

export function localHour(iso: string | Date, timeZone: string): number {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", minute: "numeric", hourCycle: "h23" }).formatToParts(d);
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return h + m / 60;
}

function tzOffsetMs(utcMs: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(new Date(utcMs));
  const g = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUTC = Date.UTC(g("year"), g("month") - 1, g("day"), g("hour"), g("minute"), g("second"));
  return asUTC - utcMs;
}

/** UTC instant of local midnight for a YYYY-MM-DD in the given timezone. */
export function zonedMidnight(dateKey: string, timeZone: string): Date {
  const [y, m, d] = dateKey.split("-").map(Number);
  const guess = Date.UTC(y, m - 1, d);
  let t = guess - tzOffsetMs(guess, timeZone);
  t = guess - tzOffsetMs(t, timeZone); // second pass handles DST edges
  return new Date(t);
}

export function addDays(dateKey: string, n: number): string {
  const d = new Date(`${dateKey}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** [start, end) in UTC ISO strings covering local dates fromKey..toKey inclusive. */
export function localRange(fromKey: string, toKey: string, timeZone: string): [string, string] {
  return [zonedMidnight(fromKey, timeZone).toISOString(), zonedMidnight(addDays(toKey, 1), timeZone).toISOString()];
}

/** ISO week key, e.g. 2026-W42, from a YYYY-MM-DD local date. */
export function isoWeekKey(dateKey: string): string {
  const d = new Date(`${dateKey}T00:00:00Z`);
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day + 3);
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((d.getTime() - firstThursday.getTime()) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

export type Period = "day" | "week" | "month";

export interface Bucket {
  key: string;
  /** Number of distinct days with at least one meal logged. */
  daysLogged: number;
  total: Nutrients;
  /** total / daysLogged — what the charts show for week and month views. */
  dailyAverage: Nutrients;
}

export function bucketMeals(meals: Meal[], period: Period, timeZone: string): Bucket[] {
  const groups = new Map<string, { days: Set<string>; meals: Meal[] }>();
  for (const m of meals) {
    const day = localDateKey(m.eatenAt, timeZone);
    const key = period === "day" ? day : period === "week" ? isoWeekKey(day) : day.slice(0, 7);
    const g = groups.get(key) ?? { days: new Set(), meals: [] };
    g.days.add(day);
    g.meals.push(m);
    groups.set(key, g);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, g]) => {
      const total = sumMeals(g.meals);
      const n = g.days.size || 1;
      const avg = emptyNutrients();
      for (const k of Object.keys(total) as (keyof Nutrients)[]) avg[k] = total[k] / n;
      return { key, daysLogged: g.days.size, total, dailyAverage: roundNutrients(avg) };
    });
}
