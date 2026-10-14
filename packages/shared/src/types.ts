export type Sex = "male" | "female";
export type ActivityLevel = "sedentary" | "light" | "moderate" | "active" | "very_active";
export type Goal = "lose" | "maintain" | "gain";
export type DietType = "omnivore" | "vegetarian" | "eggetarian" | "vegan" | "pescatarian" | "jain" | "keto";
export type Budget = "low" | "medium" | "high";
export type MealSlot = "breakfast" | "lunch" | "dinner" | "snack";

export interface Profile {
  id: string;
  displayName: string;
  /** ISO date, e.g. 1990-05-21 */
  birthDate: string;
  sex: Sex;
  heightCm: number;
  weightKg: number;
  activity: ActivityLevel;
  goal: Goal;
  diet: DietType;
  budget: Budget;
  /** Free-text cuisine/taste preferences, e.g. ["indian", "spicy"] */
  tastes: string[];
  /** Ingredients to never suggest (dislikes or allergies). */
  avoid: string[];
  /** ISO country code, e.g. "CA" */
  country: string;
  region?: string;
  timezone: string;
}

/** Nutrient amounts. Macros in g, energy in kcal, micros in their usual unit (see MICRO_UNITS). */
export interface Nutrients {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sugar: number;
  satFat: number;
  sodium: number; // mg
  potassium: number; // mg
  calcium: number; // mg
  iron: number; // mg
  magnesium: number; // mg
  zinc: number; // mg
  vitaminA: number; // µg RAE
  vitaminC: number; // mg
  vitaminD: number; // µg
  vitaminB12: number; // µg
  folate: number; // µg DFE
}

export type NutrientKey = keyof Nutrients;

export interface FoodItem {
  id?: string;
  name: string;
  portionGrams: number;
  portionLabel?: string;
  nutrients: Nutrients;
  /** "usda" | "cnf" | "ai_estimate" | "manual" */
  source: string;
  confidence?: number;
}

export interface Meal {
  id: string;
  userId: string;
  eatenAt: string; // ISO timestamp
  slot: MealSlot;
  photoPath?: string | null;
  note?: string | null;
  items: FoodItem[];
}

export interface Targets {
  nutrients: Nutrients;
  bmr: number;
  tdee: number;
}

export type SuggestionKind = "reduce" | "increase" | "swap" | "timing" | "general";
export type Severity = "info" | "warn" | "good";

export interface Suggestion {
  kind: SuggestionKind;
  severity: Severity;
  title: string;
  detail: string;
  /** Item the suggestion is about, if any. */
  itemName?: string;
}
