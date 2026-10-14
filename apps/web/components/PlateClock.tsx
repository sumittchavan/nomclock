"use client";
import { useEffect, useState } from "react";
import { localHour, mealTotals, type Meal, type Nutrients } from "@nutrisnap/shared";

const C = 200;
const R_KCAL = 148;
const R_MACRO = [126, 112, 98];
const R_PHOTO = 180;

function polar(r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: C + r * Math.cos(rad), y: C + r * Math.sin(rad) };
}
/** Noon at the top, midnight at the bottom, 6 am on the left, 6 pm on the right. */
const hourToDeg = (h: number) => ((h / 24) * 360 + 180) % 360;

function Arc({ r, frac, color, width }: { r: number; frac: number; color: string; width: number }) {
  const circ = 2 * Math.PI * r;
  const f = Math.max(0, Math.min(frac, 1));
  return (
    <>
      <circle cx={C} cy={C} r={r} fill="none" stroke="var(--track)" strokeWidth={width} />
      <circle
        className="arc" cx={C} cy={C} r={r} fill="none" stroke={color} strokeWidth={width} strokeLinecap="round"
        strokeDasharray={`${f * circ} ${circ}`} transform={`rotate(-90 ${C} ${C})`}
      />
    </>
  );
}

export function PlateClock(props: {
  meals: Meal[];
  totals: Nutrients;
  target: Nutrients;
  timeZone: string;
  photoUrls: Record<string, string>;
  showNow: boolean;
  onSelectMeal?: (id: string) => void;
}) {
  const { meals, totals, target, timeZone, photoUrls } = props;
  const [nowH, setNowH] = useState<number | null>(null);
  useEffect(() => {
    if (!props.showNow) return setNowH(null);
    const tick = () => setNowH(localHour(new Date(), timeZone));
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [props.showNow, timeZone]);

  const kcalFrac = totals.kcal / (target.kcal || 1);
  const over = kcalFrac > 1;
  const left = Math.round(target.kcal - totals.kcal);

  // Place photos on the rim by time eaten; push overlapping ones outward.
  const placed: { meal: Meal; deg: number; r: number; kcal: number }[] = [];
  for (const m of [...meals].sort((a, b) => a.eatenAt.localeCompare(b.eatenAt))) {
    const deg = hourToDeg(localHour(m.eatenAt, timeZone));
    const clash = placed.filter((p) => Math.abs(p.deg - deg) < 16).length;
    placed.push({ meal: m, deg, r: R_PHOTO + clash * 30, kcal: Math.round(mealTotals(m).kcal) });
  }

  const macroColors = ["var(--protein)", "var(--carbs-fill)", "var(--fat)"];
  const macroKeys = ["protein", "carbs", "fat"] as const;

  return (
    <div className="plate-wrap">
      <svg viewBox="0 0 400 400" role="img" aria-label={`${Math.round(totals.kcal)} of ${target.kcal} kcal eaten. ${meals.length} meals logged.`}>
        <circle cx={C} cy={C} r={164} fill="var(--surface)" />
        <circle cx={C} cy={C} r={164} fill="none" stroke="var(--line)" strokeWidth={1} />
        {[0, 6, 12, 18].map((h) => {
          const a = polar(166, hourToDeg(h));
          const b = polar(158, hourToDeg(h));
          return <line key={h} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="var(--ink-soft)" strokeWidth={2} />;
        })}
        {[3, 9, 15, 21].map((h) => {
          const a = polar(166, hourToDeg(h));
          const b = polar(162, hourToDeg(h));
          return <line key={h} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="var(--line)" strokeWidth={1.5} />;
        })}
        <Arc r={R_KCAL} frac={Math.min(kcalFrac, 1)} color={over ? "var(--warn)" : "var(--ink)"} width={12} />
        {macroKeys.map((k, i) => (
          <Arc key={k} r={R_MACRO[i]} frac={totals[k] / (target[k] || 1)} color={macroColors[i]} width={8} />
        ))}

        {nowH !== null && (() => {
          const p = polar(R_KCAL, hourToDeg(nowH));
          return <circle cx={p.x} cy={p.y} r={5} fill="var(--porcelain)" stroke="var(--ink)" strokeWidth={2.5}><title>Now</title></circle>;
        })()}

        <defs>
          {placed.map(({ meal }) => (
            <clipPath key={meal.id} id={`clip-${meal.id}`}><circle r={24} cx={0} cy={0} /></clipPath>
          ))}
        </defs>
        {placed.map(({ meal, deg, r, kcal }) => {
          const p = polar(r, deg);
          const anchor = polar(166, deg);
          const url = meal.photoPath ? photoUrls[meal.photoPath] : undefined;
          return (
            <g key={meal.id}>
              <line x1={anchor.x} y1={anchor.y} x2={p.x} y2={p.y} stroke="var(--line)" strokeWidth={1.5} />
              <g
                className="plate-photo" transform={`translate(${p.x} ${p.y})`} tabIndex={0} role="button"
                aria-label={`${meal.slot}, ${kcal} kcal. Show details`}
                onClick={() => props.onSelectMeal?.(meal.id)}
                onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && props.onSelectMeal?.(meal.id)}
              >
                <circle r={26} fill="var(--track)" />
                {url ? (
                  <image href={url} x={-24} y={-24} width={48} height={48} preserveAspectRatio="xMidYMid slice" clipPath={`url(#clip-${meal.id})`} />
                ) : (
                  <text textAnchor="middle" dy="0.35em" fontSize="13" fill="var(--ink-soft)">{meal.slot[0].toUpperCase()}</text>
                )}
                <circle className="ring" r={26} fill="none" stroke="var(--surface)" strokeWidth={3} />
              </g>
            </g>
          );
        })}
      </svg>
      <div className="plate-center">
        <div className="big" style={{ color: over ? "var(--warn)" : undefined }}>{Math.abs(left).toLocaleString()}</div>
        <div className="soft">{over ? "kcal over" : props.showNow ? "kcal left" : "kcal under target"}</div>
        <div className="small soft num" style={{ marginTop: 6 }}>{Math.round(totals.kcal).toLocaleString()} / {target.kcal.toLocaleString()} eaten</div>
      </div>
    </div>
  );
}
