import { View } from "react-native";
import { LIMIT_NUTRIENTS, NUTRIENT_META, type NutrientKey, type Nutrients, type Suggestion } from "@nomclock/shared";
import { useTheme } from "@/lib/theme";
import { T } from "./ui";

export function MacroBars({ totals, target }: { totals: Nutrients; target: Nutrients }) {
  const t = useTheme();
  const rows: [NutrientKey, string][] = [["protein", t.protein], ["carbs", t.carbs], ["fat", t.fat], ["fiber", t.good]];
  return (
    <View style={{ gap: 14 }}>
      {rows.map(([k, color]) => {
        const v = totals[k]; const goal = target[k] || 1;
        return (
          <View key={k} style={{ gap: 6 }} accessible accessibilityLabel={`${NUTRIENT_META[k].label} ${Math.round(v)} of ${goal} grams`}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <T>{NUTRIENT_META[k].label}</T>
              <T v="num">{Math.round(v)}<T v="small" soft> / {goal} g</T></T>
            </View>
            <View style={{ height: 10, borderRadius: 999, backgroundColor: t.track, overflow: "hidden" }}>
              <View style={{ width: `${Math.min(100, (v / goal) * 100)}%`, height: "100%", backgroundColor: color, borderRadius: 999 }} />
            </View>
          </View>
        );
      })}
    </View>
  );
}

const SHELF: NutrientKey[] = ["vitaminA", "vitaminC", "vitaminD", "vitaminB12", "folate", "calcium", "iron", "magnesium", "potassium", "zinc", "sugar", "satFat", "sodium"];
const fmt = (v: number) => (v >= 100 ? Math.round(v).toLocaleString() : v >= 10 ? v.toFixed(0) : v.toFixed(1));

export function NutrientShelf({ totals, target }: { totals: Nutrients; target: Nutrients }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", rowGap: 16, columnGap: 18 }}>
      {SHELF.map((k) => {
        const meta = NUTRIENT_META[k];
        const limit = LIMIT_NUTRIENTS.includes(k);
        const pct = totals[k] / (target[k] || 1);
        const color = limit ? (pct > 1 ? t.warn : t.ink) : pct < 0.5 ? t.inkSoft : t.ink;
        return (
          <View key={k} style={{ width: "46%", gap: 4 }} accessible accessibilityLabel={`${meta.label}, ${Math.round(pct * 100)} percent of ${limit ? "limit" : "target"}`}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <T v="small">{meta.label}</T>
              <T v="small" soft>{Math.round(pct * 100)}%</T>
            </View>
            <View style={{ height: 6, borderRadius: 999, backgroundColor: t.track }}>
              <View style={{ width: `${Math.min(100, pct * 100)}%`, height: "100%", borderRadius: 999, backgroundColor: color }} />
            </View>
            <T v="small" soft>{fmt(totals[k])} / {fmt(target[k])} {meta.unit}{limit ? " max" : ""}</T>
          </View>
        );
      })}
    </View>
  );
}

export function Coach({ suggestions }: { suggestions: Suggestion[] }) {
  const t = useTheme();
  if (!suggestions.length) return <T soft>Log a meal to get suggestions.</T>;
  const dot = { warn: t.warn, info: t.info, good: t.good };
  return (
    <View>
      {suggestions.map((s, i) => (
        <View key={i} style={{ flexDirection: "row", gap: 12, paddingVertical: 12, borderBottomWidth: i < suggestions.length - 1 ? 1 : 0, borderBottomColor: t.line }}>
          <View style={{ width: 9, height: 9, borderRadius: 9, backgroundColor: dot[s.severity], marginTop: 7 }} />
          <View style={{ flex: 1, gap: 2 }}>
            <T v="h3">{s.title}</T>
            <T soft>{s.detail}</T>
          </View>
        </View>
      ))}
    </View>
  );
}
