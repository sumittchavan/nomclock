import type { Meal, NutrientKey, Profile, Targets, FoodItem } from "./types";
import { LIMIT_NUTRIENTS, NUTRIENT_META, emptyNutrients } from "./nutrients";
import { localHour, mealTotals, sumMeals } from "./aggregate";
import { suggestForDay } from "./suggestions";

export type OptionKind = "original" | "smarter" | "swap" | "healthy";

export interface CoachOption {
  name: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  sugar?: number;
  satFat?: number;
  sodium?: number;
  fiber?: number;
  portion_grams?: number;
  why: string;
  kind: OptionKind;
}

export interface ChatTurn {
  id: string;
  role: "user" | "assistant";
  content: string;
  options?: CoachOption[];
  tip?: string | null;
  createdAt: string;
  pending?: boolean;
  error?: boolean;
}

/** Starter prompts shown on an empty chat. */
export const COACH_STARTERS = [
  "I feel like a cappuccino",
  "I'm getting cookies from Tim Hortons",
  "What should I have for dinner?",
  "I want something sweet",
];

/**
 * A compact summary of today for the coach: what's been eaten, what's left, and the
 * gaps the rule engine already spotted. These are the same numbers the user sees.
 */
export function buildCoachContext(profile: Profile, targets: Targets, meals: Meal[], now = new Date()) {
  const t = targets.nutrients;
  const totals = sumMeals(meals);
  const hour = localHour(now, profile.timezone);
  const r = (n: number) => Math.round(n);
  const pct = (k: NutrientKey) => r((totals[k] / (t[k] || 1)) * 100);
  const lowMicros = (["fiber", "calcium", "iron", "vitaminD", "vitaminC", "potassium", "vitaminB12"] as NutrientKey[])
    .filter((k) => pct(k) < 50).map((k) => `${NUTRIENT_META[k].label} ${pct(k)}%`);
  const overLimits = LIMIT_NUTRIENTS.filter((k) => totals[k] > t[k]).map((k) => NUTRIENT_META[k].label);

  return {
    localTime: `${String(Math.floor(hour)).padStart(2, "0")}:${String(Math.floor((hour % 1) * 60)).padStart(2, "0")}`,
    kcal: { eaten: r(totals.kcal), target: t.kcal, remaining: r(t.kcal - totals.kcal) },
    protein_g: { eaten: r(totals.protein), target: t.protein },
    carbs_g: { eaten: r(totals.carbs), target: t.carbs },
    fat_g: { eaten: r(totals.fat), target: t.fat },
    sugar_g: { eaten: r(totals.sugar), limit: t.sugar },
    lowSoFar: lowMicros,
    overLimit: overLimits,
    mealsToday: meals.map((m) => ({
      slot: m.slot,
      at: `${String(Math.floor(localHour(m.eatenAt, profile.timezone))).padStart(2, "0")}h`,
      kcal: r(mealTotals(m).kcal),
      items: m.items.map((i) => i.name),
    })),
    appNotes: suggestForDay({ profile, targets, meals, now: now.toISOString() })
      .filter((s) => s.severity !== "good").slice(0, 4).map((s) => s.title),
  };
}

export type CoachContext = ReturnType<typeof buildCoachContext>;

/** Turn a coach option into a loggable food item. */
export function optionToItem(o: CoachOption): FoodItem {
  return {
    name: o.name,
    portionGrams: Math.round(o.portion_grams ?? 0),
    nutrients: {
      ...emptyNutrients(),
      kcal: o.kcal, protein: o.protein, carbs: o.carbs, fat: o.fat,
      sugar: o.sugar ?? 0, satFat: o.satFat ?? 0, sodium: o.sodium ?? 0, fiber: o.fiber ?? 0,
    },
    source: "ai_estimate",
  };
}
