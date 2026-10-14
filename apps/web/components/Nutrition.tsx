"use client";
import { LIMIT_NUTRIENTS, NUTRIENT_META, type NutrientKey, type Nutrients } from "@nomclock/shared";

const MACROS: { key: NutrientKey; color: string }[] = [
  { key: "protein", color: "var(--protein)" },
  { key: "carbs", color: "var(--carbs-fill)" },
  { key: "fat", color: "var(--fat)" },
  { key: "fiber", color: "var(--good)" },
];

export function MacroBars({ totals, target }: { totals: Nutrients; target: Nutrients }) {
  return (
    <div className="macros">
      {MACROS.map(({ key, color }) => {
        const v = totals[key];
        const t = target[key] || 1;
        const over = v > t * 1.05 && key !== "fiber" && key !== "protein";
        return (
          <div className="bar-row" key={key}>
            <span>{NUTRIENT_META[key].label}</span>
            <div
              className={`bar${over ? " over" : ""}`} role="meter" aria-valuemin={0} aria-valuemax={t} aria-valuenow={Math.round(v)}
              aria-label={`${NUTRIENT_META[key].label}: ${Math.round(v)} of ${t} grams`}
            >
              <span style={{ width: `${Math.min(100, (v / t) * 100)}%`, background: color }} />
            </div>
            <span className="num small"><b>{Math.round(v)}</b><span className="soft"> / {t} g</span></span>
          </div>
        );
      })}
    </div>
  );
}

const SHELF: NutrientKey[] = [
  "vitaminA", "vitaminC", "vitaminD", "vitaminB12", "folate",
  "calcium", "iron", "magnesium", "potassium", "zinc",
  "sugar", "satFat", "sodium",
];

function fmt(v: number) {
  return v >= 100 ? Math.round(v).toLocaleString() : v >= 10 ? v.toFixed(0) : v.toFixed(1);
}

export function NutrientShelf({ totals, target }: { totals: Nutrients; target: Nutrients }) {
  return (
    <div className="shelf">
      {SHELF.map((k) => {
        const meta = NUTRIENT_META[k];
        const isLimit = LIMIT_NUTRIENTS.includes(k);
        const pct = totals[k] / (target[k] || 1);
        const cls = isLimit ? (pct > 1 ? "limit-over" : "") : pct < 0.5 ? "low" : "";
        return (
          <div className="shelf-item" key={k}>
            <div className="small" style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
              <span>{meta.label}</span>
              <span className="num soft">{Math.round(pct * 100)}%</span>
            </div>
            <div className={`meter ${cls}`} role="meter" aria-valuenow={Math.round(pct * 100)} aria-valuemin={0} aria-valuemax={100} aria-label={`${meta.label} ${Math.round(pct * 100)} percent of ${isLimit ? "limit" : "target"}`}>
              <span style={{ width: `${Math.min(100, pct * 100)}%` }} />
            </div>
            <div className="small soft num">{fmt(totals[k])} / {fmt(target[k])} {meta.unit}{isLimit ? " max" : ""}</div>
          </div>
        );
      })}
    </div>
  );
}
