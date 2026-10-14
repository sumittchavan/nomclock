import { describe, expect, it } from "vitest";
import {
  bmr, computeTargets, localRange, bucketMeals, isoWeekKey, localDateKey, suggestForDay, emptyNutrients,
  type Meal, type Profile,
} from "./index";

const today = new Date("2026-10-14T12:00:00Z");

const profile: Profile = {
  id: "u1", displayName: "Test", birthDate: "1990-01-01", sex: "male",
  heightCm: 175, weightKg: 80, activity: "light", goal: "lose", diet: "vegetarian",
  budget: "low", tastes: ["indian"], avoid: [], country: "CA", timezone: "America/Vancouver",
};

function meal(id: string, eatenAt: string, name: string, n: Partial<ReturnType<typeof emptyNutrients>>): Meal {
  return { id, userId: "u1", eatenAt, slot: "lunch", items: [{ name, portionGrams: 300, source: "manual", nutrients: { ...emptyNutrients(), ...n } }] };
}

describe("targets", () => {
  it("computes Mifflin-St Jeor BMR", () => {
    // 10*80 + 6.25*175 - 5*36 + 5 = 1718.75
    expect(bmr(profile, today)).toBe(1719);
  });
  it("applies a 500 kcal deficit for weight loss and sane macros", () => {
    const t = computeTargets(profile, today);
    expect(t.tdee).toBe(Math.round(1719 * 1.375));
    expect(t.nutrients.kcal).toBe(t.tdee - 500);
    expect(t.nutrients.protein).toBe(128);
    const kcalFromMacros = t.nutrients.protein * 4 + t.nutrients.carbs * 4 + t.nutrients.fat * 9;
    expect(Math.abs(kcalFromMacros - t.nutrients.kcal)).toBeLessThan(15);
    expect(t.nutrients.iron).toBe(8);
  });
  it("never goes below BMR", () => {
    const t = computeTargets({ ...profile, sex: "female", weightKg: 50, heightCm: 155, activity: "sedentary" }, today);
    expect(t.nutrients.kcal).toBeGreaterThanOrEqual(t.bmr);
  });
});

describe("aggregation", () => {
  it("keys dates in the user's timezone", () => {
    // 2026-10-15 05:00 UTC is still Oct 14 in Vancouver
    expect(localDateKey("2026-10-15T05:00:00Z", "America/Vancouver")).toBe("2026-10-14");
  });
  it("finds local midnight in UTC, including across DST", () => {
    expect(localRange("2026-10-14", "2026-10-14", "America/Vancouver")).toEqual(["2026-10-14T07:00:00.000Z", "2026-10-15T07:00:00.000Z"]);
    // DST ends 2026-11-01 in Vancouver
    expect(localRange("2026-11-01", "2026-11-01", "America/Vancouver")).toEqual(["2026-11-01T07:00:00.000Z", "2026-11-02T08:00:00.000Z"]);
    expect(localRange("2026-10-14", "2026-10-14", "Asia/Kolkata")[0]).toBe("2026-10-13T18:30:00.000Z");
  });
  it("computes ISO weeks", () => {
    expect(isoWeekKey("2026-10-14")).toBe("2026-W42");
    expect(isoWeekKey("2027-01-01")).toBe("2026-W53");
  });
  it("averages over logged days for weekly buckets", () => {
    const meals = [
      meal("a", "2026-10-12T19:00:00Z", "dal", { kcal: 1000 }),
      meal("b", "2026-10-13T19:00:00Z", "dal", { kcal: 2000 }),
    ];
    const [w] = bucketMeals(meals, "week", "America/Vancouver");
    expect(w.daysLogged).toBe(2);
    expect(w.total.kcal).toBe(3000);
    expect(w.dailyAverage.kcal).toBe(1500);
  });
});

describe("suggestions", () => {
  it("suggests diet-appropriate protein, portion cuts and swaps", () => {
    const t = computeTargets(profile, today);
    const meals = [meal("a", "2026-10-14T20:00:00Z", "butter naan", { kcal: 900, protein: 10, carbs: 120, fat: 35 })];
    const s = suggestForDay({ profile, targets: t, meals, now: "2026-10-14T21:00:00Z" });
    const text = JSON.stringify(s);
    expect(s.some((x) => x.kind === "reduce" && x.itemName === "butter naan")).toBe(true);
    expect(s.some((x) => x.kind === "swap" && x.detail.includes("roti"))).toBe(true);
    expect(text).not.toMatch(/chicken|tuna|salmon|eggs/i); // vegetarian
  });
  it("flags late heavy meals", () => {
    const t = computeTargets(profile, today);
    // 22:30 Vancouver time
    const meals = [meal("a", "2026-10-15T05:30:00Z", "pizza", { kcal: 800 })];
    const s = suggestForDay({ profile, targets: t, meals, now: "2026-10-15T06:00:00Z" });
    expect(s.some((x) => x.kind === "timing" && x.title.includes("Late"))).toBe(true);
  });
});
