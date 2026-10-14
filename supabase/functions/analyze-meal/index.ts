// Supabase Edge Function: analyze a meal photo.
//   POST { mealId }  (Authorization: Bearer <user JWT>)
// 1. Loads the meal as the calling user, so RLS guarantees ownership.
// 2. Sends the photo to Claude vision, which identifies the foods and estimates portions.
// 3. Looks each food up in USDA FoodData Central and scales it to the portion.
//    If there is no good match (common for mixed regional dishes), falls back to Claude's estimate.
// 4. Writes meal_items and marks the meal done.
import { cors, userFromRequest } from "../_shared/env.ts";

const ANTHROPIC_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;
const MODEL = Deno.env.get("ANTHROPIC_MODEL") ?? "claude-sonnet-5-5";
const USDA_KEY = Deno.env.get("USDA_API_KEY") ?? "DEMO_KEY";

const NUTRIENT_KEYS = [
  "kcal", "protein", "carbs", "fat", "fiber", "sugar", "satFat", "sodium", "potassium", "calcium",
  "iron", "magnesium", "zinc", "vitaminA", "vitaminC", "vitaminD", "vitaminB12", "folate",
] as const;
type Key = typeof NUTRIENT_KEYS[number];
type Nutrients = Record<Key, number>;

const USDA_MAP: Record<string, Key> = {
  "208": "kcal", "203": "protein", "205": "carbs", "204": "fat", "291": "fiber", "269": "sugar",
  "606": "satFat", "307": "sodium", "306": "potassium", "301": "calcium", "303": "iron",
  "304": "magnesium", "309": "zinc", "320": "vitaminA", "401": "vitaminC", "328": "vitaminD",
  "418": "vitaminB12", "435": "folate",
};

const nutrientSchema = {
  type: "object",
  properties: Object.fromEntries(NUTRIENT_KEYS.map((k) => [k, { type: "number" }])),
  required: [...NUTRIENT_KEYS],
};

const tool = {
  name: "record_foods",
  description: "Record every distinct food or drink visible in the photo.",
  input_schema: {
    type: "object",
    properties: {
      is_food: { type: "boolean", description: "False if the photo contains no food or drink." },
      notes: { type: "string", description: "One short sentence about the meal overall." },
      items: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string", description: "Common name, specific, e.g. 'butter chicken', 'garlic naan'." },
            usda_query: { type: "string", description: "Plain generic search term for USDA FoodData Central, e.g. 'naan bread'." },
            portion_grams: { type: "number", description: "Estimated edible weight in grams." },
            portion_label: { type: "string", description: "Human portion, e.g. '1 piece', '1 cup', '2 rotis'." },
            confidence: { type: "number", description: "0–1 confidence in identification and portion." },
            estimate: { ...nutrientSchema, description: "Your best estimate of nutrients for THIS portion (kcal, g, mg, µg as usual)." },
          },
          required: ["name", "usda_query", "portion_grams", "portion_label", "confidence", "estimate"],
        },
      },
    },
    required: ["is_food", "items"],
  },
};

function encodeBase64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

async function identify(imageB64: string, mediaType: string, hint: string | null, country: string) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 2048,
      tools: [tool],
      tool_choice: { type: "tool", name: "record_foods" },
      system:
        "You are a nutrition analyst. Identify each food in the photo, estimate realistic portions using plate, " +
        "cutlery and hands for scale, and estimate nutrients for that portion. Recognise regional dishes " +
        "(Indian, Chinese, Mexican, etc.) by name. Account for visible oil, butter, ghee and sauces. Never invent foods you can't see.",
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType, data: imageB64 } },
          { type: "text", text: `User is in ${country}.${hint ? ` User's note: "${hint}".` : ""} Record the foods.` },
        ],
      }],
    }),
  });
  if (!res.ok) throw new Error(`Claude API ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const call = data.content.find((c: { type: string }) => c.type === "tool_use");
  if (!call) throw new Error("No structured result from model");
  return call.input as {
    is_food: boolean; notes?: string;
    items: { name: string; usda_query: string; portion_grams: number; portion_label: string; confidence: number; estimate: Nutrients }[];
  };
}

async function usdaPer100g(query: string): Promise<{ nutrients: Nutrients; ref: string } | null> {
  const url = new URL("https://api.nal.usda.gov/fdc/v1/foods/search");
  url.searchParams.set("api_key", USDA_KEY);
  url.searchParams.set("query", query);
  url.searchParams.set("pageSize", "3");
  url.searchParams.set("dataType", "Survey (FNDDS),Foundation,SR Legacy");
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  const food = data.foods?.[0];
  if (!food) return null;
  const n = Object.fromEntries(NUTRIENT_KEYS.map((k) => [k, 0])) as Nutrients;
  for (const fn of food.foodNutrients ?? []) {
    const key = USDA_MAP[String(fn.nutrientNumber)];
    if (key) n[key] = Number(fn.value) || 0;
  }
  if (!n.kcal) return null;
  return { nutrients: n, ref: `fdc:${food.fdcId}:${food.description}` };
}

function scale(n: Nutrients, f: number): Nutrients {
  return Object.fromEntries(NUTRIENT_KEYS.map((k) => [k, Math.round((n[k] ?? 0) * f * 10) / 10])) as Nutrients;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const caller = await userFromRequest(req);
  if (!caller) return json({ error: "unauthorized" }, 401);
  const supabase = caller.client;

  const { mealId } = await req.json().catch(() => ({}));
  if (!mealId) return json({ error: "mealId required" }, 400);

  const { data: meal, error } = await supabase.from("meals").select("id, user_id, photo_path, note").eq("id", mealId).single();
  if (error || !meal) return json({ error: "meal not found" }, 404);
  if (!meal.photo_path) return json({ error: "meal has no photo" }, 400);

  const { data: profile } = await supabase.from("profiles").select("country").eq("id", meal.user_id).single();
  await supabase.from("meals").update({ analysis_status: "processing", analysis_error: null }).eq("id", mealId);

  try {
    const { data: blob, error: dlErr } = await supabase.storage.from("meal-photos").download(meal.photo_path);
    if (dlErr || !blob) throw new Error("photo download failed");
    const b64 = encodeBase64(new Uint8Array(await blob.arrayBuffer()));
    const mediaType = blob.type && blob.type !== "application/octet-stream" ? blob.type : "image/jpeg";

    const result = await identify(b64, mediaType, meal.note, profile?.country ?? "CA");
    if (!result.is_food || !result.items.length) {
      await supabase.from("meals").update({ analysis_status: "failed", analysis_error: "No food found in photo" }).eq("id", mealId);
      return json({ status: "failed", reason: "no_food" });
    }

    const rows = await Promise.all(result.items.map(async (it) => {
      const est = scale(it.estimate, 1);
      const usda = await usdaPer100g(it.usda_query).catch(() => null);
      let nutrients = est;
      let source = "ai_estimate";
      let source_ref: string | null = null;
      if (usda) {
        const scaled = scale(usda.nutrients, it.portion_grams / 100);
        // Reject database matches that disagree wildly with what's on the plate
        // (e.g. "curry" matching a dry spice powder).
        const ratio = scaled.kcal / Math.max(est.kcal, 1);
        if (ratio > 0.5 && ratio < 2) {
          nutrients = scaled;
          source = "usda";
          source_ref = usda.ref;
        }
      }
      return {
        meal_id: mealId,
        user_id: meal.user_id,
        name: it.name,
        portion_grams: Math.round(it.portion_grams),
        portion_label: it.portion_label,
        nutrients,
        source,
        source_ref,
        confidence: Math.max(0, Math.min(1, it.confidence)),
      };
    }));

    await supabase.from("meal_items").delete().eq("meal_id", mealId).neq("source", "manual");
    const { error: insErr } = await supabase.from("meal_items").insert(rows);
    if (insErr) throw insErr;
    await supabase.from("meals").update({ analysis_status: "done", ai_notes: result.notes ?? null }).eq("id", mealId);
    return json({ status: "done", items: rows });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(msg);
    await supabase.from("meals").update({ analysis_status: "failed", analysis_error: "Analysis failed, please try again" }).eq("id", mealId);
    return json({ status: "failed" }, 500);
  }
});
