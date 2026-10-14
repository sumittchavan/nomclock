import type { SupabaseClient } from "@supabase/supabase-js";
import type { FoodItem, Meal, MealSlot, Nutrients, Profile } from "./types";
import type { ChatTurn, CoachContext, CoachOption } from "./coach";
import { emptyNutrients, scaleNutrients } from "./nutrients";

type Row = Record<string, any>;

export function profileFromRow(r: Row): Profile {
  return {
    id: r.id, displayName: r.display_name, birthDate: r.birth_date, sex: r.sex,
    heightCm: Number(r.height_cm), weightKg: Number(r.weight_kg), activity: r.activity, goal: r.goal,
    diet: r.diet, budget: r.budget, tastes: r.tastes ?? [], avoid: r.avoid ?? [],
    country: r.country, region: r.region ?? undefined, timezone: r.timezone,
  };
}

function profileToRow(p: Profile): Row {
  return {
    id: p.id, display_name: p.displayName, birth_date: p.birthDate, sex: p.sex,
    height_cm: p.heightCm, weight_kg: p.weightKg, activity: p.activity, goal: p.goal,
    diet: p.diet, budget: p.budget, tastes: p.tastes, avoid: p.avoid,
    country: p.country, region: p.region ?? null, timezone: p.timezone,
  };
}

export interface DailyTotal {
  day: string;
  meals: number;
  kcal: number; protein: number; carbs: number; fat: number; fiber: number; sugar: number; sodium: number;
}

export type TrendPeriod = "day" | "week" | "month";

/** Roll daily totals up to weeks or months as averages per logged day. */
export function rollUp(days: DailyTotal[], period: TrendPeriod, weekKey: (d: string) => string) {
  if (period === "day") return days.map((d) => ({ key: d.day, daysLogged: 1, ...d }));
  const groups = new Map<string, DailyTotal[]>();
  for (const d of days) {
    const k = period === "week" ? weekKey(d.day) : d.day.slice(0, 7);
    groups.set(k, [...(groups.get(k) ?? []), d]);
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, ds]) => {
    const avg = (f: keyof Omit<DailyTotal, "day">) => Math.round(ds.reduce((s, d) => s + d[f], 0) / ds.length);
    return {
      key, day: ds[0].day, daysLogged: ds.length, meals: ds.reduce((s, d) => s + d.meals, 0),
      kcal: avg("kcal"), protein: avg("protein"), carbs: avg("carbs"), fat: avg("fat"),
      fiber: avg("fiber"), sugar: avg("sugar"), sodium: avg("sodium"),
    };
  });
}

export interface MealWithStatus extends Meal {
  status: "pending" | "processing" | "done" | "failed" | "manual";
  error?: string | null;
  aiNotes?: string | null;
}

function mealFromRow(r: Row): MealWithStatus {
  return {
    id: r.id, userId: r.user_id, eatenAt: r.eaten_at, slot: r.slot, photoPath: r.photo_path, note: r.note,
    status: r.analysis_status, error: r.analysis_error, aiNotes: r.ai_notes,
    items: (r.meal_items ?? []).map((i: Row): FoodItem => ({
      id: i.id, name: i.name, portionGrams: Number(i.portion_grams), portionLabel: i.portion_label ?? undefined,
      nutrients: { ...emptyNutrients(), ...(i.nutrients ?? {}) }, source: i.source, confidence: i.confidence ?? undefined,
    })),
  };
}

export function slotForHour(h: number): MealSlot {
  if (h >= 5 && h < 11) return "breakfast";
  if (h >= 11 && h < 15.5) return "lunch";
  if (h >= 17 && h < 22) return "dinner";
  return "snack";
}

export function createApi(sb: SupabaseClient) {
  return {
    async getProfile(): Promise<Profile | null> {
      const { data: { user } } = await sb.auth.getUser();
      if (!user) return null;
      const { data } = await sb.from("profiles").select("*").eq("id", user.id).maybeSingle();
      return data ? profileFromRow(data) : null;
    },

    async saveProfile(p: Profile) {
      const { error } = await sb.from("profiles").upsert(profileToRow(p));
      if (error) throw error;
      const today = new Date().toISOString().slice(0, 10);
      await sb.from("weight_logs").upsert({ user_id: p.id, logged_on: today, weight_kg: p.weightKg }, { onConflict: "user_id,logged_on" });
    },

    async weightHistory(fromISO: string) {
      const { data } = await sb.from("weight_logs").select("logged_on, weight_kg").gte("logged_on", fromISO.slice(0, 10)).order("logged_on");
      return (data ?? []).map((r) => ({ day: r.logged_on as string, weightKg: Number(r.weight_kg) }));
    },

    /** Meals with items in [fromISO, toISO). */
    async listMeals(fromISO: string, toISO: string): Promise<MealWithStatus[]> {
      const { data, error } = await sb.from("meals").select("*, meal_items(*)")
        .gte("eaten_at", fromISO).lt("eaten_at", toISO).order("eaten_at");
      if (error) throw error;
      return (data ?? []).map(mealFromRow);
    },

    /**
     * Per-day totals computed in the database (grouped by the user's local
     * date). Use this for trends: one row per day instead of every meal.
     */
    async dailyTotals(fromKey: string, toKey: string): Promise<DailyTotal[]> {
      const { data, error } = await sb.from("daily_totals").select("*").gte("day", fromKey).lte("day", toKey).order("day");
      if (error) throw error;
      return (data ?? []).map((r) => ({
        day: r.day as string, meals: Number(r.meals), kcal: Number(r.kcal), protein: Number(r.protein),
        carbs: Number(r.carbs), fat: Number(r.fat), fiber: Number(r.fiber), sugar: Number(r.sugar), sodium: Number(r.sodium),
      }));
    },

    /**
     * Uploads a photo (already resized and EXIF-stripped on the client),
     * creates the meal and kicks off AI analysis.
     */
    async logPhotoMeal(args: { userId: string; photo: Blob | ArrayBuffer; contentType: string; eatenAt: Date; slot: MealSlot; note?: string }) {
      const id = crypto.randomUUID();
      const ext = args.contentType.split("/")[1] ?? "jpg";
      const path = `${args.userId}/${id}.${ext}`;
      const up = await sb.storage.from("meal-photos").upload(path, args.photo, { contentType: args.contentType, upsert: false });
      if (up.error) throw up.error;
      const { error } = await sb.from("meals").insert({
        id, user_id: args.userId, eaten_at: args.eatenAt.toISOString(), slot: args.slot, photo_path: path, note: args.note ?? null,
      });
      if (error) throw error;
      const res = await sb.functions.invoke("analyze-meal", { body: { mealId: id } });
      return { mealId: id, analysis: res.data, error: res.error };
    },

    async reanalyze(mealId: string) {
      return sb.functions.invoke("analyze-meal", { body: { mealId } });
    },

    async logManualItem(args: { userId: string; mealId?: string; eatenAt: Date; slot: MealSlot; item: FoodItem }) {
      let mealId = args.mealId;
      if (!mealId) {
        const { data, error } = await sb.from("meals").insert({
          user_id: args.userId, eaten_at: args.eatenAt.toISOString(), slot: args.slot, analysis_status: "manual",
        }).select("id").single();
        if (error) throw error;
        mealId = data.id as string;
      }
      const { error } = await sb.from("meal_items").insert({
        meal_id: mealId, user_id: args.userId, name: args.item.name, portion_grams: args.item.portionGrams,
        portion_label: args.item.portionLabel ?? null, nutrients: args.item.nutrients,
        source: args.item.source === "ai_estimate" ? "ai_estimate" : "manual",
      });
      if (error) throw error;
      return mealId;
    },

    /** Change a portion; nutrients scale proportionally. */
    async updatePortion(item: FoodItem, newGrams: number) {
      const factor = item.portionGrams > 0 ? newGrams / item.portionGrams : 0;
      const nutrients: Nutrients = scaleNutrients(item.nutrients, factor);
      const { error } = await sb.from("meal_items").update({ portion_grams: newGrams, nutrients }).eq("id", item.id!);
      if (error) throw error;
      return nutrients;
    },

    async renameItem(itemId: string, name: string) {
      const { error } = await sb.from("meal_items").update({ name }).eq("id", itemId);
      if (error) throw error;
    },

    async deleteItem(itemId: string) {
      const { error } = await sb.from("meal_items").delete().eq("id", itemId);
      if (error) throw error;
    },

    async deleteMeal(meal: Meal) {
      if (meal.photoPath) await sb.storage.from("meal-photos").remove([meal.photoPath]);
      const { error } = await sb.from("meals").delete().eq("id", meal.id);
      if (error) throw error;
    },

    /** Short-lived URLs (10 min) — photos are never publicly addressable. */
    async photoUrls(paths: string[]): Promise<Record<string, string>> {
      if (!paths.length) return {};
      const { data } = await sb.storage.from("meal-photos").createSignedUrls(paths, 600);
      const out: Record<string, string> = {};
      for (const d of data ?? []) if (d.path && d.signedUrl) out[d.path] = d.signedUrl;
      return out;
    },

    /** Everything we hold about the user, as JSON (photos as signed links). */
    async exportMyData() {
      const profile = await this.getProfile();
      const meals = await this.listMeals("1970-01-01T00:00:00Z", "2999-01-01T00:00:00Z");
      const weights = await this.weightHistory("1970-01-01");
      const chat = await this.chatHistory(10000);
      return { exportedAt: new Date().toISOString(), profile, weights, meals, chat };
    },

    /** Recent coach conversation, oldest first. */
    async chatHistory(limit = 40): Promise<ChatTurn[]> {
      const { data, error } = await sb.from("chat_messages").select("*").order("created_at", { ascending: false }).limit(limit);
      if (error) throw error;
      return (data ?? []).reverse().map((r) => ({
        id: r.id, role: r.role, createdAt: r.created_at,
        // Assistant rows keep a text rendering for the model in `content`; the UI shows the original message.
        content: r.payload?.message ?? r.content,
        options: r.payload?.options ?? undefined, tip: r.payload?.tip ?? null,
      }));
    },

    async sendChat(message: string, context: CoachContext): Promise<{ message: string; options: CoachOption[]; tip: string | null }> {
      const { data, error } = await sb.functions.invoke("coach-chat", { body: { message, context } });
      if (error) {
        // Surface the function's own message (e.g. daily limit) when there is one.
        const body = await (error as any).context?.json?.().catch(() => null);
        throw new Error(body?.message ?? "The coach couldn't answer just now. Try again in a moment.");
      }
      return data;
    },

    async clearChat() {
      const { data: { user } } = await sb.auth.getUser();
      if (!user) return;
      const { error } = await sb.from("chat_messages").delete().eq("user_id", user.id);
      if (error) throw error;
    },

    async deleteAccount() {
      const res = await sb.functions.invoke("delete-account", { body: {} });
      if (res.error) throw res.error;
      await sb.auth.signOut();
    },
  };
}

export type Api = ReturnType<typeof createApi>;
