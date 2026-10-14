import type { Budget, DietType, NutrientKey } from "./types";

/** Ingredient flags used to filter by diet. */
export type Flag = "meat" | "fish" | "egg" | "dairy" | "root" | "highcarb";

export interface FoodIdea {
  name: string;
  flags: Flag[];
  cost: Budget;
  tastes?: string[];
}

const BLOCKED: Record<DietType, Flag[]> = {
  omnivore: [],
  pescatarian: ["meat"],
  eggetarian: ["meat", "fish"],
  vegetarian: ["meat", "fish", "egg"],
  vegan: ["meat", "fish", "egg", "dairy"],
  jain: ["meat", "fish", "egg", "root"],
  keto: ["highcarb"],
};

const COST_RANK: Record<Budget, number> = { low: 0, medium: 1, high: 2 };

export function fitsDiet(f: FoodIdea, diet: DietType): boolean {
  return !f.flags.some((fl) => BLOCKED[diet].includes(fl));
}

export function pickIdeas(
  ideas: FoodIdea[],
  opts: { diet: DietType; budget: Budget; tastes: string[]; avoid: string[] },
  limit = 3,
): FoodIdea[] {
  const avoid = opts.avoid.map((a) => a.toLowerCase());
  const tastes = opts.tastes.map((t) => t.toLowerCase());
  return ideas
    .filter((f) => fitsDiet(f, opts.diet))
    .filter((f) => !avoid.some((a) => f.name.toLowerCase().includes(a)))
    .map((f) => {
      let score = 0;
      if (COST_RANK[f.cost] <= COST_RANK[opts.budget]) score += 2;
      else score -= 2;
      if (f.tastes?.some((t) => tastes.includes(t))) score += 1;
      if (opts.budget === "low" && f.cost === "low") score += 1;
      return { f, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.f);
}

/** Foods that are good sources of a nutrient. */
export const SOURCES: Partial<Record<NutrientKey, FoodIdea[]>> = {
  protein: [
    { name: "eggs", flags: ["egg"], cost: "low" },
    { name: "lentils / dal", flags: ["highcarb"], cost: "low", tastes: ["indian"] },
    { name: "canned chickpeas", flags: ["highcarb"], cost: "low", tastes: ["indian", "mediterranean"] },
    { name: "Greek yogurt", flags: ["dairy"], cost: "medium" },
    { name: "paneer", flags: ["dairy"], cost: "medium", tastes: ["indian"] },
    { name: "firm tofu", flags: [], cost: "low", tastes: ["asian"] },
    { name: "tempeh", flags: [], cost: "medium", tastes: ["asian"] },
    { name: "chicken breast", flags: ["meat"], cost: "medium" },
    { name: "canned tuna", flags: ["fish"], cost: "low" },
    { name: "salmon", flags: ["fish"], cost: "high" },
    { name: "cottage cheese", flags: ["dairy"], cost: "medium" },
    { name: "roasted chana", flags: ["highcarb"], cost: "low", tastes: ["indian"] },
  ],
  fiber: [
    { name: "oats", flags: ["highcarb"], cost: "low" },
    { name: "chia seeds", flags: [], cost: "medium" },
    { name: "rajma / kidney beans", flags: ["highcarb"], cost: "low", tastes: ["indian"] },
    { name: "broccoli", flags: [], cost: "low" },
    { name: "raspberries", flags: [], cost: "high" },
    { name: "flaxseed", flags: [], cost: "low" },
  ],
  iron: [
    { name: "spinach / palak", flags: [], cost: "low", tastes: ["indian"] },
    { name: "lentils", flags: ["highcarb"], cost: "low" },
    { name: "pumpkin seeds", flags: [], cost: "medium" },
    { name: "lean beef", flags: ["meat"], cost: "high" },
    { name: "fortified breakfast cereal", flags: ["highcarb"], cost: "low" },
  ],
  calcium: [
    { name: "milk or fortified soy milk", flags: [], cost: "low" },
    { name: "yogurt / dahi", flags: ["dairy"], cost: "low", tastes: ["indian"] },
    { name: "calcium-set tofu", flags: [], cost: "low" },
    { name: "ragi", flags: ["highcarb"], cost: "low", tastes: ["indian"] },
    { name: "canned sardines", flags: ["fish"], cost: "medium" },
  ],
  vitaminD: [
    { name: "fortified milk or plant milk", flags: [], cost: "low" },
    { name: "salmon", flags: ["fish"], cost: "high" },
    { name: "egg yolks", flags: ["egg"], cost: "low" },
    { name: "UV-exposed mushrooms", flags: ["root"], cost: "medium" },
  ],
  vitaminC: [
    { name: "an orange", flags: [], cost: "low" },
    { name: "bell peppers", flags: [], cost: "medium" },
    { name: "amla / guava", flags: [], cost: "low", tastes: ["indian"] },
    { name: "kiwi", flags: [], cost: "medium" },
  ],
  potassium: [
    { name: "a banana", flags: ["highcarb"], cost: "low" },
    { name: "avocado", flags: [], cost: "medium" },
    { name: "white beans", flags: ["highcarb"], cost: "low" },
    { name: "plain yogurt", flags: ["dairy"], cost: "low" },
  ],
  magnesium: [
    { name: "almonds", flags: [], cost: "medium" },
    { name: "pumpkin seeds", flags: [], cost: "medium" },
    { name: "black beans", flags: ["highcarb"], cost: "low" },
    { name: "dark chocolate (70%+, small square)", flags: [], cost: "medium" },
  ],
  vitaminB12: [
    { name: "fortified plant milk or nutritional yeast", flags: [], cost: "low" },
    { name: "eggs", flags: ["egg"], cost: "low" },
    { name: "milk / curd", flags: ["dairy"], cost: "low" },
    { name: "canned tuna", flags: ["fish"], cost: "low" },
  ],
  folate: [
    { name: "lentils", flags: ["highcarb"], cost: "low" },
    { name: "spinach", flags: [], cost: "low" },
    { name: "asparagus", flags: [], cost: "high" },
  ],
  zinc: [
    { name: "pumpkin seeds", flags: [], cost: "medium" },
    { name: "chickpeas", flags: ["highcarb"], cost: "low" },
    { name: "cashews", flags: [], cost: "medium" },
  ],
  vitaminA: [
    { name: "carrots", flags: ["root"], cost: "low" },
    { name: "sweet potato", flags: ["root", "highcarb"], cost: "low" },
    { name: "spinach", flags: [], cost: "low" },
  ],
};

export interface SwapRule {
  /** Lower-case keywords matched against the logged item name. */
  match: string[];
  alternatives: FoodIdea[];
  why: string;
}

export const SWAPS: SwapRule[] = [
  { match: ["white rice", "jeera rice", "fried rice"], why: "more fibre, steadier blood sugar", alternatives: [
    { name: "brown rice", flags: ["highcarb"], cost: "low" },
    { name: "half rice + half cauliflower rice", flags: [], cost: "low" },
    { name: "millet / quinoa", flags: ["highcarb"], cost: "medium", tastes: ["indian"] },
  ] },
  { match: ["naan", "garlic naan", "butter naan", "kulcha"], why: "about half the calories and less refined flour", alternatives: [
    { name: "whole-wheat roti / phulka", flags: ["highcarb"], cost: "low", tastes: ["indian"] },
    { name: "jowar or bajra roti", flags: ["highcarb"], cost: "low", tastes: ["indian"] },
  ] },
  { match: ["soda", "cola", "pop", "soft drink", "energy drink"], why: "cuts sugar to zero", alternatives: [
    { name: "sparkling water with lime", flags: [], cost: "low" },
    { name: "unsweetened iced tea", flags: [], cost: "low" },
  ] },
  { match: ["juice"], why: "whole fruit keeps the fibre and fills you up", alternatives: [
    { name: "whole fruit", flags: [], cost: "low" },
  ] },
  { match: ["fries", "french fries", "chips", "wafers"], why: "far less oil", alternatives: [
    { name: "air-fried potato wedges", flags: ["root", "highcarb"], cost: "low" },
    { name: "roasted chana / makhana", flags: [], cost: "low", tastes: ["indian"] },
    { name: "air-popped popcorn", flags: ["highcarb"], cost: "low" },
  ] },
  { match: ["butter chicken", "chicken makhani", "chicken korma"], why: "same flavours without the cream and butter", alternatives: [
    { name: "tandoori chicken", flags: ["meat"], cost: "medium", tastes: ["indian", "spicy"] },
    { name: "chicken tikka", flags: ["meat"], cost: "medium", tastes: ["indian", "spicy"] },
  ] },
  { match: ["paneer butter masala", "shahi paneer", "paneer makhani", "malai kofta"], why: "less cream and fat", alternatives: [
    { name: "paneer tikka", flags: ["dairy"], cost: "medium", tastes: ["indian", "spicy"] },
    { name: "palak paneer (light on cream)", flags: ["dairy"], cost: "medium", tastes: ["indian"] },
    { name: "tofu tikka", flags: [], cost: "low", tastes: ["indian"] },
  ] },
  { match: ["samosa", "pakora", "bhajji", "vada"], why: "steamed or baked instead of deep-fried", alternatives: [
    { name: "dhokla", flags: [], cost: "low", tastes: ["indian"] },
    { name: "baked samosa", flags: ["root", "highcarb"], cost: "low", tastes: ["indian"] },
    { name: "sprouts chaat", flags: [], cost: "low", tastes: ["indian", "spicy"] },
  ] },
  { match: ["pizza"], why: "fewer calories per slice, more vegetables", alternatives: [
    { name: "thin-crust veggie pizza", flags: ["dairy", "highcarb"], cost: "medium" },
    { name: "whole-wheat pita pizza at home", flags: ["dairy", "highcarb"], cost: "low" },
  ] },
  { match: ["ice cream", "kulfi"], why: "more protein, less sugar", alternatives: [
    { name: "Greek yogurt with berries", flags: ["dairy"], cost: "medium" },
    { name: "frozen banana 'nice cream'", flags: ["highcarb"], cost: "low" },
  ] },
  { match: ["white bread", "bun", "pav"], why: "more fibre", alternatives: [
    { name: "whole-grain bread", flags: ["highcarb"], cost: "low" },
    { name: "sourdough", flags: ["highcarb"], cost: "medium" },
  ] },
  { match: ["cream pasta", "alfredo", "mac and cheese", "carbonara"], why: "less saturated fat", alternatives: [
    { name: "whole-wheat pasta in tomato sauce", flags: ["highcarb"], cost: "low", tastes: ["italian"] },
    { name: "zucchini noodles with pesto", flags: ["dairy"], cost: "medium" },
  ] },
  { match: ["donut", "doughnut", "pastry", "croissant", "muffin", "cake"], why: "less sugar and refined flour", alternatives: [
    { name: "overnight oats with fruit", flags: ["highcarb"], cost: "low" },
    { name: "a handful of nuts and a fruit", flags: [], cost: "medium" },
  ] },
  { match: ["latte", "frappuccino", "mocha", "chai latte", "sweet tea", "chai with sugar", "sweet chai", "tea with sugar", "coffee with sugar"], why: "skip the syrup and sugar", alternatives: [
    { name: "unsweetened latte or chai with less sugar", flags: ["dairy"], cost: "low" },
    { name: "black coffee or green tea", flags: [], cost: "low" },
  ] },
  { match: ["biryani", "pulao"], why: "keeps the dish, trims the rice-heavy portion", alternatives: [
    { name: "a smaller biryani portion with raita and salad", flags: ["dairy"], cost: "low", tastes: ["indian"] },
    { name: "chicken or veg tikka with salad", flags: [], cost: "medium", tastes: ["indian"] },
  ] },
  { match: ["burger"], why: "less saturated fat and sodium", alternatives: [
    { name: "grilled chicken sandwich", flags: ["meat", "highcarb"], cost: "medium" },
    { name: "bean or lentil burger, lettuce wrap", flags: [], cost: "medium" },
  ] },
];
