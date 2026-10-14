"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  localDateKey, localRange, sumMeals, suggestForDay, zonedMidnight, type MealWithStatus,
} from "@nomclock/shared";
import { api } from "@/lib/supabase";
import { useSession } from "@/lib/session";
import { PlateClock } from "./PlateClock";
import { MacroBars, NutrientShelf } from "./Nutrition";
import { Coach } from "./Coach";
import { MealList } from "./MealList";
import { AddMealSheet } from "./AddMealSheet";

export function DayView({ dateKey, title }: { dateKey: string; title?: string }) {
  const { profile, targets } = useSession();
  const [meals, setMeals] = useState<MealWithStatus[]>([]);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [highlight, setHighlight] = useState<string | null>(null);
  const tz = profile?.timezone ?? "UTC";
  const isToday = dateKey === localDateKey(new Date(), tz);

  const load = useCallback(async () => {
    if (!profile) return;
    const [from, to] = localRange(dateKey, dateKey, tz);
    const list = await api.listMeals(from, to);
    setMeals(list);
    const paths = list.map((m) => m.photoPath).filter(Boolean) as string[];
    setPhotoUrls(await api.photoUrls(paths));
    setLoading(false);
  }, [profile, dateKey, tz]);

  useEffect(() => { setLoading(true); load(); }, [load]);

  const totals = useMemo(() => sumMeals(meals), [meals]);
  const suggestions = useMemo(() => {
    if (!profile || !targets) return [];
    return suggestForDay({ profile, targets, meals, now: new Date().toISOString(), dayComplete: !isToday });
  }, [profile, targets, meals, isToday]);

  if (!profile || !targets) return null;

  const heading = title ?? new Date(`${dateKey}T12:00:00`).toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });
  const defaultTime = isToday ? new Date() : new Date(zonedMidnight(dateKey, tz).getTime() + 12 * 3600_000);

  const select = (id: string) => {
    setHighlight(id);
    document.getElementById(`meal-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => setHighlight(null), 1500);
  };

  return (
    <>
      <div className="day-head">
        <div>
          <h1>{heading}</h1>
          <p className="soft">{meals.length ? `${meals.length} meal${meals.length > 1 ? "s" : ""} logged` : loading ? "Loading…" : "No meals logged"}</p>
        </div>
        <button className="btn add-inline" onClick={() => setAdding(true)}>+ Add meal</button>
      </div>

      <div className="day-grid">
        <div>
          <PlateClock meals={meals} totals={totals} target={targets.nutrients} timeZone={tz} photoUrls={photoUrls} showNow={isToday} onSelectMeal={select} />
          <div className="legend" style={{ justifyContent: "center", marginTop: 12 }}>
            <span><i style={{ background: "var(--ink)" }} />Calories</span>
            <span><i style={{ background: "var(--protein)" }} />Protein</span>
            <span><i style={{ background: "var(--carbs-fill)" }} />Carbs</span>
            <span><i style={{ background: "var(--fat)" }} />Fat</span>
          </div>
        </div>
        <div>
          <h2 style={{ marginBottom: 14 }}>{isToday ? "What to do next" : "How the day went"}</h2>
          <Coach suggestions={suggestions} />
        </div>
      </div>

      <section className="section">
        <h2>Macros</h2>
        <MacroBars totals={totals} target={targets.nutrients} />
      </section>

      <section className="section">
        <h2>Vitamins and minerals</h2>
        <NutrientShelf totals={totals} target={targets.nutrients} />
      </section>

      <section className="section">
        <h2>Meals</h2>
        {meals.length ? (
          <MealList meals={meals} photoUrls={photoUrls} timeZone={tz} highlightId={highlight} onChanged={load} />
        ) : !loading && (
          <div className="empty">
            <p className="soft">Photograph a meal and NomClock fills in the nutrition for you.</p>
            <button className="btn" onClick={() => setAdding(true)}>Add a meal</button>
          </div>
        )}
      </section>

      <button className="btn fab" onClick={() => setAdding(true)} aria-label="Add a meal">+ Add meal</button>
      {adding && (
        <AddMealSheet
          defaultTime={defaultTime}
          onClose={() => setAdding(false)}
          onLogged={async (id) => { setAdding(false); await load(); select(id); }}
        />
      )}
    </>
  );
}
