import { useCallback, useMemo, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { addDays, isoWeekKey, localDateKey, rollUp, type DailyTotal, type TrendPeriod } from "@nomclock/shared";
import { api } from "@/lib/supabase";
import { useSession } from "@/lib/session";
import { fonts, useTheme } from "@/lib/theme";
import { BarChart, LineChart } from "@/components/BarChart";
import { Section, T } from "@/components/ui";

const SPAN: Record<TrendPeriod, { days: number; label: string }> = {
  day: { days: 14, label: "Last 14 days" },
  week: { days: 84, label: "Last 12 weeks" },
  month: { days: 365, label: "Last 12 months" },
};

function label(key: string, p: TrendPeriod) {
  if (p === "day") return new Date(`${key}T12:00:00`).toLocaleDateString([], { day: "numeric", month: "short" });
  if (p === "week") return key.split("-")[1];
  return new Date(`${key}-15T12:00:00`).toLocaleDateString([], { month: "short" });
}

export default function Trends() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { profile, targets } = useSession();
  const [period, setPeriod] = useState<TrendPeriod>("day");
  const [days, setDays] = useState<DailyTotal[]>([]);
  const [weights, setWeights] = useState<{ day: string; weightKg: number }[]>([]);

  useFocusEffect(useCallback(() => {
    if (!profile) return;
    const to = localDateKey(new Date(), profile.timezone);
    const from = addDays(to, -SPAN[period].days + 1);
    api.dailyTotals(from, to).then(setDays);
    api.weightHistory(from).then(setWeights);
  }, [profile, period]));

  const rows = useMemo(() => rollUp(days, period, isoWeekKey).map((r) => ({ ...r, name: label(r.key, period) })), [days, period]);
  if (!profile || !targets) return null;
  const tg = targets.nutrients;
  const n = days.length || 1;
  const avg = (k: "kcal" | "protein") => Math.round(days.reduce((s, d) => s + d[k], 0) / n);
  const per = period === "day" ? "" : " (daily average)";

  return (
    <ScrollView style={{ backgroundColor: t.bg }} contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: 16, paddingBottom: 48, gap: 6 }}>
      <T v="h1">Trends</T>
      <T soft>{SPAN[period].label}</T>
      <View style={{ flexDirection: "row", borderWidth: 1.5, borderColor: t.line, borderRadius: 999, padding: 3, alignSelf: "flex-start", marginVertical: 12 }} accessibilityRole="tablist">
        {(["day", "week", "month"] as TrendPeriod[]).map((p) => (
          <Pressable key={p} onPress={() => setPeriod(p)} accessibilityRole="tab" accessibilityState={{ selected: p === period }}
            style={{ paddingVertical: 7, paddingHorizontal: 16, borderRadius: 999, backgroundColor: p === period ? t.ink : "transparent" }}>
            <T style={{ color: p === period ? t.onInk : t.inkSoft, fontFamily: fonts.body }}>{p === "day" ? "Daily" : p === "week" ? "Weekly" : "Monthly"}</T>
          </Pressable>
        ))}
      </View>

      {days.length === 0 ? (
        <T soft>Log meals for a few days and your trends will show up here.</T>
      ) : (
        <>
          <View style={{ flexDirection: "row", gap: 28, flexWrap: "wrap" }}>
            <View><T v="h1">{avg("kcal").toLocaleString()}</T><T v="small" soft>Avg kcal a day{"\n"}target {tg.kcal.toLocaleString()}</T></View>
            <View><T v="h1">{avg("protein")} g</T><T v="small" soft>Avg protein{"\n"}target {tg.protein} g</T></View>
          </View>
          <Section title={`Calories${per}`}>
            <BarChart rows={rows} series={[{ key: "kcal", color: t.ink, label: "Calories" }]} target={tg.kcal} unit="kcal" />
          </Section>
          <Section title={`Protein, carbs and fat${per}`}>
            <View style={{ flexDirection: "row", gap: 14 }}>
              {[["Protein", t.protein], ["Carbs", t.carbs], ["Fat", t.fat]].map(([l, c]) => (
                <View key={l} style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                  <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: c }} /><T v="small" soft>{l}</T>
                </View>
              ))}
            </View>
            <BarChart rows={rows} unit="g" series={[
              { key: "protein", color: t.protein, label: "Protein" },
              { key: "carbs", color: t.carbs, label: "Carbs" },
              { key: "fat", color: t.fat, label: "Fat" },
            ]} />
          </Section>
          {weights.length > 1 && (
            <Section title="Weight">
              <LineChart unit="kg" points={weights.map((w) => ({ name: label(w.day, "day"), v: w.weightKg }))} />
              <T v="small" soft>Update your weight on the Profile tab and it's added here.</T>
            </Section>
          )}
        </>
      )}
    </ScrollView>
  );
}
