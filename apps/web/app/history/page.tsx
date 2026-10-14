"use client";
import { useEffect, useMemo, useState } from "react";
import { addDays, localDateKey, type DailyTotal } from "@nomclock/shared";
import { api } from "@/lib/supabase";
import { useSession } from "@/lib/session";
import { DayView } from "@/components/DayView";

function monthDays(month: string) {
  const [y, m] = month.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const count = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const lead = (first.getUTCDay() + 6) % 7; // Monday-first
  return { lead, keys: Array.from({ length: count }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`) };
}

function shiftMonth(month: string, n: number) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.toISOString().slice(0, 7);
}

export default function HistoryPage() {
  const { profile, targets } = useSession();
  const today = profile ? localDateKey(new Date(), profile.timezone) : "";
  const [month, setMonth] = useState("");
  const [selected, setSelected] = useState("");
  const [days, setDays] = useState<Record<string, DailyTotal>>({});

  useEffect(() => {
    if (today && !month) {
      setMonth(today.slice(0, 7));
      setSelected(addDays(today, -1));
    }
  }, [today, month]);

  useEffect(() => {
    if (!profile || !month) return;
    const { keys } = monthDays(month);
    api.dailyTotals(keys[0], keys[keys.length - 1]).then((rows) => setDays(Object.fromEntries(rows.map((r) => [r.day, r]))));
  }, [profile, month]);

  const grid = useMemo(() => (month ? monthDays(month) : { lead: 0, keys: [] }), [month]);
  if (!profile || !targets || !month) return null;
  const target = targets.nutrients.kcal;

  const tint = (kcal: number) => {
    const r = kcal / target;
    if (r > 1.1) return "color-mix(in srgb, var(--warn) 30%, var(--surface))";
    if (r >= 0.85) return "color-mix(in srgb, var(--good) 28%, var(--surface))";
    return "color-mix(in srgb, var(--carbs-fill) 22%, var(--surface))";
  };

  return (
    <div style={{ display: "grid", gap: 32 }}>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 420px)", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <button className="btn ghost small" onClick={() => setMonth(shiftMonth(month, -1))} aria-label="Previous month">‹</button>
          <h2>{new Date(`${month}-15T12:00:00`).toLocaleDateString([], { month: "long", year: "numeric" })}</h2>
          <button className="btn ghost small" onClick={() => setMonth(shiftMonth(month, 1))} disabled={month >= today.slice(0, 7)} aria-label="Next month">›</button>
        </div>
        <div className="cal">
          {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => <span key={i} className="dow" aria-hidden>{d}</span>)}
          {Array.from({ length: grid.lead }, (_, i) => <span key={`l${i}`} />)}
          {grid.keys.map((k) => {
            const d = days[k];
            return (
              <button
                key={k} aria-pressed={selected === k} disabled={k > today}
                style={{ background: d ? tint(d.kcal) : "transparent" }}
                onClick={() => setSelected(k)}
                aria-label={`${k}${d ? `, ${Math.round(d.kcal)} kcal` : ", nothing logged"}`}
              >
                <span className="num">{Number(k.slice(8))}</span>
                {d && <span className="kc num">{Math.round(d.kcal)}</span>}
              </button>
            );
          })}
        </div>
        <div className="legend">
          <span><i style={{ background: "color-mix(in srgb, var(--good) 28%, var(--surface))" }} />Near target</span>
          <span><i style={{ background: "color-mix(in srgb, var(--carbs-fill) 22%, var(--surface))" }} />Under</span>
          <span><i style={{ background: "color-mix(in srgb, var(--warn) 30%, var(--surface))" }} />Over</span>
        </div>
      </div>
      <div className="section" style={{ marginTop: 0 }}>
        <DayView key={selected} dateKey={selected} />
      </div>
    </div>
  );
}
