"use client";
import { useState } from "react";
import { mealTotals, type FoodItem, type MealWithStatus } from "@nomclock/shared";
import { api } from "@/lib/supabase";

const SOURCE_LABEL: Record<string, string> = {
  usda: "USDA data",
  cnf: "Canadian Nutrient File",
  ai_estimate: "AI estimate",
  manual: "Manual",
};

function time(iso: string, tz: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", timeZone: tz });
}

function ItemRow({ item, onChanged }: { item: FoodItem; onChanged: () => void }) {
  const [grams, setGrams] = useState(String(item.portionGrams));
  const [busy, setBusy] = useState(false);
  const save = async () => {
    const g = Number(grams);
    if (!Number.isFinite(g) || g < 0 || g === item.portionGrams) return;
    setBusy(true);
    await api.updatePortion(item, g);
    setBusy(false);
    onChanged();
  };
  return (
    <li className="item">
      <div>
        <div><b>{item.name}</b> <span className="soft small">{item.portionLabel}</span></div>
        <div className="small soft num">
          {Math.round(item.nutrients.kcal)} kcal · P {Math.round(item.nutrients.protein)} · C {Math.round(item.nutrients.carbs)} · F {Math.round(item.nutrients.fat)} g
          {" "}<span className="tag">{SOURCE_LABEL[item.source] ?? item.source}</span>
        </div>
      </div>
      <label className="small" style={{ fontWeight: 400 }}>
        <span className="sr">Portion in grams for {item.name}</span>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <input type="number" inputMode="numeric" min={0} value={grams} disabled={busy}
            onChange={(e) => setGrams(e.target.value)} onBlur={save} onKeyDown={(e) => e.key === "Enter" && save()} />
          g
        </span>
      </label>
      <button className="btn ghost small" aria-label={`Remove ${item.name}`} onClick={async () => { await api.deleteItem(item.id!); onChanged(); }}>Remove</button>
    </li>
  );
}

export function MealList({ meals, photoUrls, timeZone, highlightId, onChanged }: {
  meals: MealWithStatus[];
  photoUrls: Record<string, string>;
  timeZone: string;
  highlightId?: string | null;
  onChanged: () => void;
}) {
  const [retrying, setRetrying] = useState<string | null>(null);
  return (
    <ul className="meals">
      {meals.map((m) => {
        const t = mealTotals(m);
        const url = m.photoPath ? photoUrls[m.photoPath] : undefined;
        return (
          <li key={m.id} id={`meal-${m.id}`} className={`meal${highlightId === m.id ? " highlight" : ""}`}>
            {url ? <img className="meal-photo" src={url} alt={`Photo of ${m.slot}`} /> : <div className="meal-photo" aria-hidden />}
            <div>
              <div className="meal-head">
                <h3 style={{ textTransform: "capitalize" }}>{m.slot} <span className="soft small" style={{ fontWeight: 400 }}>{time(m.eatenAt, timeZone)}</span></h3>
                <span className="num"><b>{Math.round(t.kcal)}</b> <span className="soft small">kcal</span></span>
              </div>
              {m.aiNotes && <p className="small soft">{m.aiNotes}</p>}
              {(m.status === "pending" || m.status === "processing") && <p className="small soft">Reading your plate…</p>}
              {m.status === "failed" && (
                <p className="small">
                  <span className="error">{m.error ?? "Analysis failed."}</span>{" "}
                  <button className="btn ghost small" disabled={retrying === m.id}
                    onClick={async () => { setRetrying(m.id); await api.reanalyze(m.id); setRetrying(null); onChanged(); }}>
                    {retrying === m.id ? "Analyzing…" : "Analyze again"}
                  </button>
                </p>
              )}
              <ul className="items">
                {m.items.map((i) => <ItemRow key={i.id} item={i} onChanged={onChanged} />)}
              </ul>
              <div style={{ marginTop: 10 }}>
                <button className="btn ghost small" onClick={async () => {
                  if (confirm("Delete this meal and its photo?")) { await api.deleteMeal(m); onChanged(); }
                }}>Delete meal</button>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
