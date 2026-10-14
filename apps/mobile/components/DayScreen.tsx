import { useCallback, useMemo, useRef, useState } from "react";
import { RefreshControl, ScrollView, View, type LayoutChangeEvent } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { localDateKey, localRange, sumMeals, suggestForDay, type MealWithStatus } from "@nomclock/shared";
import { api } from "@/lib/supabase";
import { useSession } from "@/lib/session";
import { useTheme } from "@/lib/theme";
import { PlateClock } from "./PlateClock";
import { Coach, MacroBars, NutrientShelf } from "./Nutrition";
import { MealCard } from "./MealCard";
import { Button, Section, T } from "./ui";

export function DayScreen({ dateKey, title, header }: { dateKey: string; title?: string; header?: React.ReactNode }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { profile, targets } = useSession();
  const [meals, setMeals] = useState<MealWithStatus[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [refreshing, setRefreshing] = useState(false);
  const scroll = useRef<ScrollView>(null);
  const offsets = useRef<Record<string, number>>({});
  const mealsTop = useRef(0);
  const tz = profile?.timezone ?? "UTC";
  const isToday = dateKey === localDateKey(new Date(), tz);

  const load = useCallback(async () => {
    if (!profile) return;
    const [from, to] = localRange(dateKey, dateKey, tz);
    const list = await api.listMeals(from, to);
    setMeals(list);
    setUrls(await api.photoUrls(list.map((m) => m.photoPath).filter(Boolean) as string[]));
  }, [profile, dateKey, tz]);

  // Reload whenever the screen regains focus, e.g. after adding a meal.
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const totals = useMemo(() => sumMeals(meals), [meals]);
  const suggestions = useMemo(
    () => (profile && targets ? suggestForDay({ profile, targets, meals, now: new Date().toISOString(), dayComplete: !isToday }) : []),
    [profile, targets, meals, isToday],
  );
  if (!profile || !targets) return null;

  const heading = title ?? new Date(`${dateKey}T12:00:00`).toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <ScrollView
        ref={scroll}
        contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: 16, paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
      >
        {header}
        <T v="h1">{heading}</T>
        <T soft>{meals.length ? `${meals.length} meal${meals.length > 1 ? "s" : ""} logged` : "No meals logged"}</T>

        <PlateClock
          meals={meals} totals={totals} target={targets.nutrients} timeZone={tz} photoUrls={urls} isToday={isToday}
          onSelectMeal={(id) => scroll.current?.scrollTo({ y: mealsTop.current + (offsets.current[id] ?? 0) - 12, animated: true })}
        />
        <View style={{ flexDirection: "row", justifyContent: "center", gap: 14, marginBottom: 8 }}>
          {[["Calories", t.ink], ["Protein", t.protein], ["Carbs", t.carbs], ["Fat", t.fat]].map(([l, c]) => (
            <View key={l} style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
              <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: c }} />
              <T v="small" soft>{l}</T>
            </View>
          ))}
        </View>

        <Section title={isToday ? "What to do next" : "How the day went"}>
          <Coach suggestions={suggestions} />
        </Section>
        <Section title="Macros"><MacroBars totals={totals} target={targets.nutrients} /></Section>
        <Section title="Vitamins and minerals"><NutrientShelf totals={totals} target={targets.nutrients} /></Section>
        <View onLayout={(e: LayoutChangeEvent) => { mealsTop.current = e.nativeEvent.layout.y; }}>
          <Section title="Meals">
            {meals.length === 0 ? (
              <T soft>Photograph a meal and NomClock fills in the nutrition for you.</T>
            ) : (
              <View>
                {meals.map((m) => (
                  <View key={m.id} onLayout={(e) => { offsets.current[m.id] = e.nativeEvent.layout.y + 40; }}>
                    <MealCard meal={m} photoUrl={m.photoPath ? urls[m.photoPath] : undefined} timeZone={tz} onChanged={load} />
                  </View>
                ))}
              </View>
            )}
          </Section>
        </View>
        <View style={{ marginTop: 28, gap: 8, alignItems: "flex-start" }}>
          <T v="small" soft>Missing something, or something not working?</T>
          <Button small kind="ghost" title="Suggest an idea" onPress={() => router.push({ pathname: "/feedback", params: { area: title === "Today" ? "today" : "history" } })} />
        </View>
      </ScrollView>
      <Button
        title="+ Add meal"
        onPress={() => router.push({ pathname: "/add", params: { date: dateKey } })}
        style={{ position: "absolute", right: 16, bottom: 16, paddingVertical: 15, shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 6 }}
      />
    </View>
  );
}
