import { useState } from "react";
import { Alert, TextInput, View } from "react-native";
import { Image } from "expo-image";
import { mealTotals, type FoodItem, type MealWithStatus } from "@nutrisnap/shared";
import { api } from "@/lib/supabase";
import { fonts, useTheme } from "@/lib/theme";
import { Button, T } from "./ui";

const SOURCE: Record<string, string> = { usda: "USDA data", cnf: "Canadian Nutrient File", ai_estimate: "AI estimate", manual: "Manual" };

function ItemRow({ item, onChanged }: { item: FoodItem; onChanged: () => void }) {
  const t = useTheme();
  const [grams, setGrams] = useState(String(item.portionGrams));
  const save = async () => {
    const g = Number(grams);
    if (!Number.isFinite(g) || g < 0 || g === item.portionGrams) return;
    await api.updatePortion(item, g);
    onChanged();
  };
  return (
    <View style={{ gap: 6, paddingVertical: 8 }}>
      <T v="bodyBold">{item.name} <T v="small" soft>{item.portionLabel}</T></T>
      <T v="small" soft>
        {Math.round(item.nutrients.kcal)} kcal, P {Math.round(item.nutrients.protein)} g, C {Math.round(item.nutrients.carbs)} g, F {Math.round(item.nutrients.fat)} g. {SOURCE[item.source] ?? item.source}
      </T>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <TextInput
          value={grams} onChangeText={setGrams} onEndEditing={save} keyboardType="numeric" returnKeyType="done"
          accessibilityLabel={`Portion in grams for ${item.name}`}
          style={{ borderWidth: 1.5, borderColor: t.line, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, minWidth: 76, color: t.ink, fontFamily: fonts.body, fontSize: 15, backgroundColor: t.surface }}
        />
        <T soft>g</T>
        <View style={{ flex: 1 }} />
        <Button small kind="ghost" title="Remove" accessibilityLabel={`Remove ${item.name}`} onPress={async () => { await api.deleteItem(item.id!); onChanged(); }} />
      </View>
    </View>
  );
}

export function MealCard({ meal, photoUrl, timeZone, onChanged }: { meal: MealWithStatus; photoUrl?: string; timeZone: string; onChanged: () => void }) {
  const t = useTheme();
  const [retrying, setRetrying] = useState(false);
  const total = mealTotals(meal);
  const time = new Date(meal.eatenAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", timeZone });

  return (
    <View style={{ paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: t.line, gap: 10 }}>
      <View style={{ flexDirection: "row", gap: 14 }}>
        {photoUrl
          ? <Image source={{ uri: photoUrl }} style={{ width: 84, height: 84, borderRadius: 14, backgroundColor: t.track }} contentFit="cover" accessibilityLabel={`Photo of ${meal.slot}`} />
          : <View style={{ width: 84, height: 84, borderRadius: 14, backgroundColor: t.track }} />}
        <View style={{ flex: 1, gap: 4 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
            <T v="h3" style={{ textTransform: "capitalize" }}>{meal.slot} <T v="small" soft>{time}</T></T>
            <T v="num">{Math.round(total.kcal)}<T v="small" soft> kcal</T></T>
          </View>
          {meal.aiNotes ? <T v="small" soft>{meal.aiNotes}</T> : null}
          {(meal.status === "pending" || meal.status === "processing") && <T v="small" soft>Reading your plate…</T>}
          {meal.status === "failed" && (
            <View style={{ gap: 6, alignItems: "flex-start" }}>
              <T v="small" style={{ color: t.warn }}>{meal.error ?? "Analysis failed."}</T>
              <Button small kind="ghost" title={retrying ? "Analyzing…" : "Analyze again"} busy={retrying}
                onPress={async () => { setRetrying(true); await api.reanalyze(meal.id); setRetrying(false); onChanged(); }} />
            </View>
          )}
        </View>
      </View>
      {meal.items.map((i) => <ItemRow key={i.id} item={i} onChanged={onChanged} />)}
      <Button small kind="ghost" title="Delete meal" style={{ alignSelf: "flex-start" }}
        onPress={() => Alert.alert("Delete this meal?", "The meal and its photo are removed permanently.", [
          { text: "Cancel", style: "cancel" },
          { text: "Delete", style: "destructive", onPress: async () => { await api.deleteMeal(meal); onChanged(); } },
        ])} />
    </View>
  );
}
