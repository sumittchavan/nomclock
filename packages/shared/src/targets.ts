import type { ActivityLevel, Nutrients, Profile, Targets } from "./types";
import { emptyNutrients } from "./nutrients";

const ACTIVITY_FACTOR: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

export function ageFromBirthDate(birthDate: string, today = new Date()): number {
  const b = new Date(birthDate);
  let age = today.getFullYear() - b.getFullYear();
  const m = today.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < b.getDate())) age--;
  return age;
}

/** Mifflin–St Jeor resting energy, kcal/day. */
export function bmr(p: Pick<Profile, "sex" | "weightKg" | "heightCm" | "birthDate">, today = new Date()): number {
  const age = ageFromBirthDate(p.birthDate, today);
  const base = 10 * p.weightKg + 6.25 * p.heightCm - 5 * age;
  return Math.round(p.sex === "male" ? base + 5 : base - 161);
}

/**
 * Daily targets for adults (18+). Micronutrients follow the US/Canada Dietary
 * Reference Intakes (RDA or AI); sodium, saturated fat and sugar are ceilings.
 * These are general-population guides, not medical advice.
 */
export function computeTargets(p: Profile, today = new Date()): Targets {
  const age = ageFromBirthDate(p.birthDate, today);
  const male = p.sex === "male";
  const restingKcal = bmr(p, today);
  const tdee = Math.round(restingKcal * ACTIVITY_FACTOR[p.activity]);

  const floor = Math.max(restingKcal, male ? 1500 : 1200);
  let kcal = tdee;
  if (p.goal === "lose") kcal = Math.max(floor, tdee - 500);
  if (p.goal === "gain") kcal = tdee + 300;

  const proteinPerKg = p.goal === "maintain" ? 1.2 : 1.6;
  const protein = Math.round(p.weightKg * proteinPerKg);

  let fat: number;
  let carbs: number;
  if (p.diet === "keto") {
    carbs = 25;
    fat = Math.round((kcal - protein * 4 - carbs * 4) / 9);
  } else {
    fat = Math.round((kcal * 0.3) / 9);
    carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4));
  }

  const n: Nutrients = {
    ...emptyNutrients(),
    kcal,
    protein,
    carbs,
    fat,
    fiber: Math.round((kcal / 1000) * 14),
    sugar: Math.round((kcal * 0.1) / 4),
    satFat: Math.round((kcal * 0.1) / 9),
    sodium: 2300,
    potassium: male ? 3400 : 2600,
    calcium: age > 70 || (!male && age > 50) ? 1200 : 1000,
    iron: !male && age <= 50 ? 18 : 8,
    magnesium: male ? (age <= 30 ? 400 : 420) : age <= 30 ? 310 : 320,
    zinc: male ? 11 : 8,
    vitaminA: male ? 900 : 700,
    vitaminC: male ? 90 : 75,
    vitaminD: age > 70 ? 20 : 15,
    vitaminB12: 2.4,
    folate: 400,
  };

  return { nutrients: n, bmr: restingKcal, tdee };
}

/** Share of the day's intake you'd typically expect by a given local hour. */
export function expectedShareByHour(hour: number): number {
  // Simple piecewise curve: breakfast ~25%, lunch ~35%, dinner ~30%, snacks ~10%.
  const points: [number, number][] = [
    [0, 0], [6, 0], [9, 0.25], [12, 0.3], [14, 0.6], [17, 0.65], [20, 0.95], [22, 1], [24, 1],
  ];
  for (let i = 1; i < points.length; i++) {
    const [h1, s1] = points[i];
    const [h0, s0] = points[i - 1];
    if (hour <= h1) return s0 + ((hour - h0) / (h1 - h0)) * (s1 - s0);
  }
  return 1;
}
