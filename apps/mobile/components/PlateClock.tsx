import { useEffect, useState } from "react";
import { Pressable, View, useWindowDimensions } from "react-native";
import Svg, { Circle, ClipPath, Defs, G, Image as SvgImage, Line, Text as SvgText } from "react-native-svg";
import { localHour, mealTotals, type Meal, type Nutrients } from "@nomclock/shared";
import { useTheme } from "@/lib/theme";
import { T } from "./ui";

const C = 200;
const R_KCAL = 148;
const R_MACRO = [126, 112, 98];
const R_PHOTO = 180;

function polar(r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: C + r * Math.cos(rad), y: C + r * Math.sin(rad) };
}
/** Noon at the top, midnight at the bottom. */
const hourToDeg = (h: number) => ((h / 24) * 360 + 180) % 360;

export function PlateClock({ meals, totals, target, timeZone, photoUrls, isToday, onSelectMeal }: {
  meals: Meal[]; totals: Nutrients; target: Nutrients; timeZone: string;
  photoUrls: Record<string, string>; isToday: boolean; onSelectMeal?: (id: string) => void;
}) {
  const t = useTheme();
  const { width } = useWindowDimensions();
  const size = Math.min(width - 32, 420);
  const scale = size / 400;
  const k = size / 440; // px per SVG unit (viewBox is 440 wide, offset by 20)
  const [nowH, setNowH] = useState<number | null>(null);

  useEffect(() => {
    if (!isToday) return setNowH(null);
    const tick = () => setNowH(localHour(new Date(), timeZone));
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [isToday, timeZone]);

  const frac = totals.kcal / (target.kcal || 1);
  const over = frac > 1;
  const left = Math.round(target.kcal - totals.kcal);

  const arc = (r: number, f: number, color: string, w: number, key: string) => {
    const circ = 2 * Math.PI * r;
    return (
      <G key={key}>
        <Circle cx={C} cy={C} r={r} fill="none" stroke={t.track} strokeWidth={w} />
        <Circle cx={C} cy={C} r={r} fill="none" stroke={color} strokeWidth={w} strokeLinecap="round"
          strokeDasharray={`${Math.max(0, Math.min(f, 1)) * circ} ${circ}`} rotation={-90} origin={`${C}, ${C}`} />
      </G>
    );
  };

  const placed: { meal: Meal; deg: number; r: number; kcal: number }[] = [];
  for (const m of [...meals].sort((a, b) => a.eatenAt.localeCompare(b.eatenAt))) {
    const deg = hourToDeg(localHour(m.eatenAt, timeZone));
    const clash = placed.filter((p) => Math.abs(p.deg - deg) < 16).length;
    placed.push({ meal: m, deg, r: R_PHOTO + clash * 30, kcal: Math.round(mealTotals(m).kcal) });
  }

  return (
    <View
      style={{ width: size, height: size, alignSelf: "center", marginVertical: 12 }}
      accessible accessibilityLabel={`${Math.round(totals.kcal)} of ${target.kcal} calories eaten. ${meals.length} meals logged.`}
    >
      <Svg width={size} height={size} viewBox="-20 -20 440 440">
        <Circle cx={C} cy={C} r={164} fill={t.surface} stroke={t.line} strokeWidth={1} />
        {[0, 6, 12, 18].map((h) => {
          const a = polar(166, hourToDeg(h)); const b = polar(158, hourToDeg(h));
          return <Line key={h} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={t.inkSoft} strokeWidth={2} />;
        })}
        {arc(R_KCAL, frac, over ? t.warn : t.ink, 12, "kcal")}
        {arc(R_MACRO[0], totals.protein / (target.protein || 1), t.protein, 8, "p")}
        {arc(R_MACRO[1], totals.carbs / (target.carbs || 1), t.carbs, 8, "c")}
        {arc(R_MACRO[2], totals.fat / (target.fat || 1), t.fat, 8, "f")}
        {nowH !== null && (() => { const p = polar(R_KCAL, hourToDeg(nowH)); return <Circle cx={p.x} cy={p.y} r={5} fill={t.bg} stroke={t.ink} strokeWidth={2.5} />; })()}
        <Defs>
          {placed.map(({ meal, deg, r }) => {
            const p = polar(r, deg);
            return <ClipPath key={meal.id} id={`c${meal.id}`}><Circle cx={p.x} cy={p.y} r={24} /></ClipPath>;
          })}
        </Defs>
        {placed.map(({ meal, deg, r }) => {
          const p = polar(r, deg); const a = polar(166, deg);
          const url = meal.photoPath ? photoUrls[meal.photoPath] : undefined;
          return (
            <G key={meal.id}>
              <Line x1={a.x} y1={a.y} x2={p.x} y2={p.y} stroke={t.line} strokeWidth={1.5} />
              <Circle cx={p.x} cy={p.y} r={26} fill={t.track} />
              {url
                ? <SvgImage href={{ uri: url }} x={p.x - 24} y={p.y - 24} width={48} height={48} preserveAspectRatio="xMidYMid slice" clipPath={`url(#c${meal.id})`} />
                : <SvgText x={p.x} y={p.y + 5} fontSize={13} textAnchor="middle" fill={t.inkSoft}>{meal.slot[0].toUpperCase()}</SvgText>}
              <Circle cx={p.x} cy={p.y} r={26} fill="none" stroke={t.surface} strokeWidth={3} />
            </G>
          );
        })}
      </Svg>

      {/* Tap targets laid over the photos (SVG press handling is unreliable on Android). */}
      {placed.map(({ meal, deg, r, kcal }) => {
        const p = polar(r, deg);
        return (
          <Pressable key={meal.id} onPress={() => onSelectMeal?.(meal.id)} accessibilityRole="button"
            accessibilityLabel={`${meal.slot}, ${kcal} calories. Show details`}
            style={{ position: "absolute", left: (p.x + 20 - 28) * k, top: (p.y + 20 - 28) * k, width: 56 * k, height: 56 * k, borderRadius: 999 }} />
        );
      })}

      <View pointerEvents="none" style={{ position: "absolute", inset: 0, alignItems: "center", justifyContent: "center" }}>
        <T v="big" style={{ color: over ? t.warn : t.ink, fontSize: 52 * Math.max(scale, 0.8) }}>{Math.abs(left).toLocaleString()}</T>
        <T soft>{over ? "kcal over" : isToday ? "kcal left" : "kcal under target"}</T>
        <T v="small" soft style={{ marginTop: 4 }}>{Math.round(totals.kcal).toLocaleString()} / {target.kcal.toLocaleString()} eaten</T>
      </View>
    </View>
  );
}
