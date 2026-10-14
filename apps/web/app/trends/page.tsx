"use client";
import { useEffect, useMemo, useState } from "react";
import {
  Bar, BarChart, CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { addDays, isoWeekKey, localDateKey, rollUp, type DailyTotal, type TrendPeriod } from "@nomclock/shared";
import { api } from "@/lib/supabase";
import { useSession } from "@/lib/session";

const SPAN: Record<TrendPeriod, { days: number; label: string }> = {
  day: { days: 14, label: "Last 14 days" },
  week: { days: 7 * 12, label: "Last 12 weeks" },
  month: { days: 365, label: "Last 12 months" },
};

function label(key: string, period: TrendPeriod) {
  if (period === "day") return new Date(`${key}T12:00:00`).toLocaleDateString([], { month: "short", day: "numeric" });
  if (period === "week") return key.split("-")[1];
  return new Date(`${key}-15T12:00:00`).toLocaleDateString([], { month: "short" });
}

const tooltipStyle = { background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 8, color: "var(--ink)" };
const axis = { stroke: "var(--ink-soft)", fontSize: 12, tickLine: false, axisLine: false } as const;

export default function TrendsPage() {
  const { profile, targets } = useSession();
  const [period, setPeriod] = useState<TrendPeriod>("day");
  const [days, setDays] = useState<DailyTotal[]>([]);
  const [weights, setWeights] = useState<{ day: string; weightKg: number }[]>([]);

  useEffect(() => {
    if (!profile) return;
    const to = localDateKey(new Date(), profile.timezone);
    const from = addDays(to, -SPAN[period].days + 1);
    api.dailyTotals(from, to).then(setDays);
    api.weightHistory(from).then(setWeights);
  }, [profile, period]);

  const rows = useMemo(() => rollUp(days, period, isoWeekKey).map((r) => ({ ...r, name: label(r.key, period) })), [days, period]);

  if (!profile || !targets) return null;
  const t = targets.nutrients;
  const n = days.length || 1;
  const avg = (k: "kcal" | "protein" | "fiber") => Math.round(days.reduce((s, d) => s + d[k], 0) / n);
  const onTarget = days.filter((d) => d.kcal >= t.kcal * 0.85 && d.kcal <= t.kcal * 1.1).length;
  const perDay = period === "day" ? "" : " (daily average)";

  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div className="day-head">
        <div>
          <h1>Trends</h1>
          <p className="soft">{SPAN[period].label}</p>
        </div>
        <div className="seg" role="group" aria-label="Group by">
          {(["day", "week", "month"] as TrendPeriod[]).map((p) => (
            <button key={p} aria-pressed={period === p} onClick={() => setPeriod(p)}>{p === "day" ? "Daily" : p === "week" ? "Weekly" : "Monthly"}</button>
          ))}
        </div>
      </div>

      {days.length === 0 ? (
        <div className="empty"><p className="soft">Log meals for a few days and your trends will show up here.</p></div>
      ) : (
        <>
          <div style={{ display: "flex", gap: 40, flexWrap: "wrap" }}>
            <div><div className="num" style={{ fontSize: "2rem", fontWeight: 800 }}>{avg("kcal").toLocaleString()}</div><div className="soft small">Average kcal a day, target {t.kcal.toLocaleString()}</div></div>
            <div><div className="num" style={{ fontSize: "2rem", fontWeight: 800 }}>{avg("protein")} g</div><div className="soft small">Average protein, target {t.protein} g</div></div>
            <div><div className="num" style={{ fontSize: "2rem", fontWeight: 800 }}>{onTarget}/{days.length}</div><div className="soft small">Days within range of your calorie target</div></div>
          </div>

          <section className="section">
            <h2>Calories{perDay}</h2>
            <div className="chart-box">
              <ResponsiveContainer>
                <BarChart data={rows} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="2 4" />
                  <XAxis dataKey="name" {...axis} />
                  <YAxis {...axis} />
                  <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--track)" }} formatter={(v: number) => [`${v.toLocaleString()} kcal`, "Calories"]} />
                  <ReferenceLine y={t.kcal} stroke="var(--ink)" strokeDasharray="6 4" label={{ value: "Target", position: "insideTopRight", fill: "var(--ink-soft)", fontSize: 12 }} />
                  <Bar dataKey="kcal" fill="var(--ink)" radius={[6, 6, 0, 0]} maxBarSize={36} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="section">
            <h2>Protein, carbs and fat{perDay}</h2>
            <div className="legend" style={{ marginBottom: 8 }}>
              <span><i style={{ background: "var(--protein)" }} />Protein</span>
              <span><i style={{ background: "var(--carbs-fill)" }} />Carbs</span>
              <span><i style={{ background: "var(--fat)" }} />Fat</span>
            </div>
            <div className="chart-box">
              <ResponsiveContainer>
                <BarChart data={rows} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="2 4" />
                  <XAxis dataKey="name" {...axis} />
                  <YAxis {...axis} unit=" g" />
                  <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--track)" }} formatter={(v: number, n: string) => [`${v} g`, n]} />
                  <Bar dataKey="protein" name="Protein" stackId="m" fill="var(--protein)" maxBarSize={36} />
                  <Bar dataKey="carbs" name="Carbs" stackId="m" fill="var(--carbs-fill)" maxBarSize={36} />
                  <Bar dataKey="fat" name="Fat" stackId="m" fill="var(--fat)" radius={[6, 6, 0, 0]} maxBarSize={36} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          {weights.length > 1 && (
            <section className="section">
              <h2>Weight</h2>
              <div className="chart-box">
                <ResponsiveContainer>
                  <LineChart data={weights.map((w) => ({ ...w, name: label(w.day, "day") }))} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="2 4" />
                    <XAxis dataKey="name" {...axis} />
                    <YAxis {...axis} domain={[(min: number) => Math.floor(min - 1), (max: number) => Math.ceil(max + 1)]} allowDecimals={false} unit=" kg" />
                    <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`${v} kg`, "Weight"]} />
                    <Line type="monotone" dataKey="weightKg" stroke="var(--ink)" strokeWidth={2.5} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <p className="small soft">Update your weight on the Profile page and it's added here.</p>
            </section>
          )}
        </>
      )}
    </div>
  );
}
