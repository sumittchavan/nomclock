import type { FoodItem, Meal, NutrientKey, Profile, Suggestion, Targets } from "./types";
import { NUTRIENT_META } from "./nutrients";
import { mealTotals, sumMeals, localHour } from "./aggregate";
import { expectedShareByHour } from "./targets";
import { SOURCES, SWAPS, pickIdeas } from "./foods";

const MICRO_CHECK: NutrientKey[] = [
  "fiber", "calcium", "iron", "vitaminD", "vitaminC", "potassium", "magnesium", "vitaminB12", "folate", "zinc", "vitaminA",
];

const RANK = { warn: 0, info: 1, good: 2 } as const;

function list(names: string[]): string {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} or ${names[names.length - 1]}`;
}

/**
 * Rule-based coaching for one day of eating. Runs on device and server, so the
 * app can show advice instantly after each photo; the server may add an
 * AI-written summary on top.
 */
export function suggestForDay(args: {
  profile: Profile;
  targets: Targets;
  meals: Meal[];
  /** "Now" in ISO; used to pro-rate how much should have been eaten so far. */
  now: string;
  /** True when looking at a finished past day. */
  dayComplete?: boolean;
}): Suggestion[] {
  const { profile, targets, meals } = args;
  const tz = profile.timezone;
  const t = targets.nutrients;
  const totals = sumMeals(meals);
  const hour = args.dayComplete ? 24 : localHour(args.now, tz);
  const share = expectedShareByHour(hour);
  const prefs = { diet: profile.diet, budget: profile.budget, tastes: profile.tastes, avoid: profile.avoid };
  const out: Suggestion[] = [];

  // 1. Calorie pacing
  const kcalLeft = Math.round(t.kcal - totals.kcal);
  if (totals.kcal > t.kcal * 1.05) {
    out.push({
      kind: "general", severity: "warn",
      title: `${Math.round(totals.kcal - t.kcal)} kcal over today's target`,
      detail: "Keep the rest of today light: vegetables, a clear soup, or plain yogurt. One high day won't undo a good week.",
    });
  } else if (share > 0.2 && totals.kcal > t.kcal * share * 1.2 && !args.dayComplete) {
    out.push({
      kind: "general", severity: "warn",
      title: "Ahead of pace for this time of day",
      detail: `You have ${kcalLeft} kcal left. Plan a lighter next meal that's heavy on vegetables and protein.`,
    });
  } else if (meals.length > 0) {
    out.push({
      kind: "general", severity: "good",
      title: args.dayComplete ? `Finished ${kcalLeft} kcal under target` : `${kcalLeft} kcal left today`,
      detail: `Protein ${Math.round(totals.protein)}/${t.protein} g · Carbs ${Math.round(totals.carbs)}/${t.carbs} g · Fat ${Math.round(totals.fat)}/${t.fat} g`,
    });
  }

  // 2. Portion reductions: the biggest calorie contributor, if it dominates the day.
  const items: FoodItem[] = meals.flatMap((m) => m.items);
  const top = [...items].sort((a, b) => b.nutrients.kcal - a.nutrients.kcal)[0];
  if (top && totals.kcal > 0 && top.nutrients.kcal / Math.max(totals.kcal, t.kcal * share) > 0.35 && top.nutrients.kcal > 350) {
    const saved = Math.round(top.nutrients.kcal / 3);
    out.push({
      kind: "reduce", severity: "warn", itemName: top.name,
      title: `Cut the ${top.name} portion by a third`,
      detail: `It's ${Math.round(top.nutrients.kcal)} kcal on its own. Two-thirds of the portion saves about ${saved} kcal. Fill the gap with salad or vegetables.`,
    });
  }

  // 2b. Carbs well over target: trim the biggest carb source.
  if (profile.diet !== "keto" && totals.carbs > t.carbs * 1.1) {
    const carbTop = [...items].sort((a, b) => b.nutrients.carbs - a.nutrients.carbs)[0];
    if (carbTop && carbTop.name !== top?.name) {
      out.push({
        kind: "reduce", severity: "warn", itemName: carbTop.name,
        title: `Carbs are at ${Math.round((totals.carbs / t.carbs) * 100)}% of target`,
        detail: `The ${carbTop.name} added ${Math.round(carbTop.nutrients.carbs)} g. Next time, try half the portion and make up the rest with dal, vegetables or a protein.`,
      });
    }
  }

  // 3. Protein — the most common gap, and the one that helps most with satiety.
  if (totals.protein < t.protein * share * 0.75) {
    const ideas = pickIdeas(SOURCES.protein!, prefs).map((f) => f.name);
    out.push({
      kind: "increase", severity: "warn",
      title: args.dayComplete
        ? `Protein was ${Math.round(t.protein - totals.protein)} g short`
        : `Add protein: ${Math.round(t.protein - totals.protein)} g to go`,
      detail: `${args.dayComplete ? "Build meals" : "Build your next meal"} around ${list(ideas)}. Protein keeps you full longer and protects muscle while you're in a calorie deficit.`,
    });
  }

  // 4. Swaps for specific logged items
  const seen = new Set<string>();
  for (const item of items) {
    const name = item.name.toLowerCase();
    const rule = SWAPS.find((r) => r.match.some((k) => name.includes(k)));
    if (!rule || seen.has(rule.why)) continue;
    const alts = pickIdeas(rule.alternatives, prefs, 2).map((f) => f.name);
    if (!alts.length) continue;
    seen.add(rule.why);
    out.push({
      kind: "swap", severity: "info", itemName: item.name,
      title: `Next time, swap ${item.name}`,
      detail: `Try ${list(alts)}: ${rule.why}.`,
    });
  }

  // 5. Limits (sodium, sugar, saturated fat)
  for (const k of ["sodium", "sugar", "satFat"] as NutrientKey[]) {
    if (totals[k] <= t[k]) continue;
    const culprit = [...items].sort((a, b) => b.nutrients[k] - a.nutrients[k])[0];
    const meta = NUTRIENT_META[k];
    out.push({
      kind: "reduce", severity: "warn", itemName: culprit?.name,
      title: `${meta.label} is over the daily limit`,
      detail: `${Math.round(totals[k]).toLocaleString("en-CA")} ${meta.unit} so far, against a ${t[k].toLocaleString("en-CA")} ${meta.unit} limit${culprit ? `. The biggest source was ${culprit.name}` : ""}.`,
    });
  }

  // 6. Micronutrient gaps — only once most of the day's eating is done.
  if (hour >= 18) {
    const gaps = MICRO_CHECK
      .map((k) => ({ k, pct: totals[k] / (t[k] || 1) }))
      .filter((g) => g.pct < 0.5)
      .sort((a, b) => a.pct - b.pct)
      .slice(0, 2);
    for (const g of gaps) {
      const ideas = pickIdeas(SOURCES[g.k] ?? [], prefs).map((f) => f.name);
      if (!ideas.length) continue;
      const meta = NUTRIENT_META[g.k];
      let extra = "";
      if (g.k === "vitaminD" && ["CA", "GB", "IE", "NO", "SE", "FI", "DK", "DE", "NL"].includes(profile.country))
        extra = " At northern latitudes the sun is too weak to make much vitamin D from October to March, so ask your doctor whether a supplement makes sense for you.";
      if (g.k === "vitaminB12" && profile.diet === "vegan")
        extra = " Vegans almost always need a B12 supplement or fortified foods.";
      out.push({
        kind: "increase", severity: "info",
        title: `Low on ${meta.label.startsWith("Vitamin") ? meta.label : meta.label.toLowerCase()} (${Math.round(g.pct * 100)}% of target)`,
        detail: `Good sources: ${list(ideas)}.${extra}`,
      });
    }
  }

  out.push(...timingAdvice(meals, tz, t.kcal));

  if (meals.length === 0) {
    out.push({
      kind: "general", severity: "info",
      title: "Nothing logged yet",
      detail: "Snap a photo of your first meal to start today's tally.",
    });
  }

  return out.sort((a, b) => RANK[a.severity] - RANK[b.severity]).slice(0, 8);
}

/** Good and bad times to eat, based on when meals were actually logged. */
export function timingAdvice(meals: Meal[], timeZone: string, kcalTarget: number): Suggestion[] {
  const out: Suggestion[] = [];
  if (!meals.length) return out;
  const timed = meals
    .map((m) => ({ m, h: localHour(m.eatenAt, timeZone), kcal: mealTotals(m).kcal }))
    .sort((a, b) => a.h - b.h);

  const late = timed.filter((x) => x.h >= 21.5 && x.kcal > 250);
  if (late.length) {
    out.push({
      kind: "timing", severity: "warn",
      title: "Late, heavy eating",
      detail: "Big meals within 2–3 hours of bed tend to hurt sleep and digestion. Aim to finish dinner by about 8 pm, and keep anything later small and protein-based, such as yogurt or a handful of nuts.",
    });
  }

  const dinner = timed.filter((x) => x.h >= 17);
  const dinnerKcal = dinner.reduce((s, x) => s + x.kcal, 0);
  if (dinnerKcal > kcalTarget * 0.45) {
    out.push({
      kind: "timing", severity: "info",
      title: "Most of today's calories came after 5 pm",
      detail: "Moving some of those calories to breakfast and lunch usually means steadier energy and fewer evening cravings.",
    });
  }

  for (let i = 1; i < timed.length; i++) {
    const gap = timed[i].h - timed[i - 1].h;
    if (gap > 6 && timed[i - 1].h < 20) {
      out.push({
        kind: "timing", severity: "info",
        title: `${Math.round(gap)}-hour gap between meals`,
        detail: "Long gaps often lead to overeating at the next meal. A small mid-afternoon snack, like fruit with nuts or roasted chana, helps.",
      });
      break;
    }
  }

  const first = timed[0];
  if (first.h >= 6 && first.h <= 10 && first.kcal >= 250 && !late.length) {
    out.push({
      kind: "timing", severity: "good",
      title: "Good meal timing",
      detail: "A solid breakfast and an earlier eating window line up well with your body's natural rhythm.",
    });
  }
  return out;
}
