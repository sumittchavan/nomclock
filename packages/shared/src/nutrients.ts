import type { NutrientKey, Nutrients } from "./types";

export const NUTRIENT_KEYS: NutrientKey[] = [
  "kcal", "protein", "carbs", "fat", "fiber", "sugar", "satFat",
  "sodium", "potassium", "calcium", "iron", "magnesium", "zinc",
  "vitaminA", "vitaminC", "vitaminD", "vitaminB12", "folate",
];

export const NUTRIENT_META: Record<NutrientKey, { label: string; unit: string; group: "energy" | "macro" | "limit" | "mineral" | "vitamin" }> = {
  kcal: { label: "Calories", unit: "kcal", group: "energy" },
  protein: { label: "Protein", unit: "g", group: "macro" },
  carbs: { label: "Carbs", unit: "g", group: "macro" },
  fat: { label: "Fat", unit: "g", group: "macro" },
  fiber: { label: "Fiber", unit: "g", group: "macro" },
  sugar: { label: "Sugar", unit: "g", group: "limit" },
  satFat: { label: "Saturated fat", unit: "g", group: "limit" },
  sodium: { label: "Sodium", unit: "mg", group: "limit" },
  potassium: { label: "Potassium", unit: "mg", group: "mineral" },
  calcium: { label: "Calcium", unit: "mg", group: "mineral" },
  iron: { label: "Iron", unit: "mg", group: "mineral" },
  magnesium: { label: "Magnesium", unit: "mg", group: "mineral" },
  zinc: { label: "Zinc", unit: "mg", group: "mineral" },
  vitaminA: { label: "Vitamin A", unit: "µg", group: "vitamin" },
  vitaminC: { label: "Vitamin C", unit: "mg", group: "vitamin" },
  vitaminD: { label: "Vitamin D", unit: "µg", group: "vitamin" },
  vitaminB12: { label: "Vitamin B12", unit: "µg", group: "vitamin" },
  folate: { label: "Folate", unit: "µg", group: "vitamin" },
};

/** Nutrients where the target is a ceiling, not a floor. */
export const LIMIT_NUTRIENTS: NutrientKey[] = ["sugar", "satFat", "sodium"];

/** USDA FoodData Central nutrient numbers → our keys. */
export const USDA_NUTRIENT_NUMBERS: Record<string, NutrientKey> = {
  "208": "kcal",
  "203": "protein",
  "205": "carbs",
  "204": "fat",
  "291": "fiber",
  "269": "sugar",
  "606": "satFat",
  "307": "sodium",
  "306": "potassium",
  "301": "calcium",
  "303": "iron",
  "304": "magnesium",
  "309": "zinc",
  "320": "vitaminA",
  "401": "vitaminC",
  "328": "vitaminD",
  "418": "vitaminB12",
  "435": "folate",
};

export function emptyNutrients(): Nutrients {
  return Object.fromEntries(NUTRIENT_KEYS.map((k) => [k, 0])) as unknown as Nutrients;
}

export function addNutrients(a: Nutrients, b: Partial<Nutrients>): Nutrients {
  const out = { ...a };
  for (const k of NUTRIENT_KEYS) out[k] = (a[k] ?? 0) + (b[k] ?? 0);
  return out;
}

export function scaleNutrients(n: Partial<Nutrients>, factor: number): Nutrients {
  const out = emptyNutrients();
  for (const k of NUTRIENT_KEYS) out[k] = (n[k] ?? 0) * factor;
  return out;
}

export function roundNutrients(n: Nutrients): Nutrients {
  const out = { ...n };
  for (const k of NUTRIENT_KEYS) out[k] = Math.round(n[k] * 10) / 10;
  return out;
}
