// Supabase Edge Function: nutrition coach chat.
//   POST { message, context }   (Authorization: Bearer <user JWT>)
// `context` is today's intake summary computed on the client by buildCoachContext()
// (the same numbers the user sees on screen). Diet, budget, tastes and foods to
// avoid are read from the database here, so they can't be spoofed.
import { createClient } from "npm:@supabase/supabase-js@2";

const ANTHROPIC_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;
const MODEL = Deno.env.get("COACH_MODEL") ?? Deno.env.get("ANTHROPIC_MODEL") ?? "claude-sonnet-5-5";
const DAILY_LIMIT = Number(Deno.env.get("COACH_DAILY_LIMIT") ?? 60);
const HISTORY_TURNS = 16;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const DIET_LABEL: Record<string, string> = {
  omnivore: "eats everything", vegetarian: "vegetarian (no meat, fish or eggs)", eggetarian: "vegetarian but eats eggs",
  vegan: "vegan", pescatarian: "pescatarian", jain: "Jain (no meat, fish, eggs, onion, garlic or root vegetables)",
  keto: "keto (very low carb)",
};

const SYSTEM = `You are NutriSnap's food coach, chatting inside a calorie-tracking app.

How to help:
- Be practical and specific. When someone has a craving or is about to order, give 2–4 concrete options that still
  satisfy it, from "have it, smarter" to "a lighter swap": smaller size, a different milk, fewer pumps of syrup,
  half the sugar, skip the cream or whip, share it, pair it with protein.
- For chain restaurants and cafés (Tim Hortons, Starbucks, McDonald's and so on), name real menu items and sizes, and give
  approximate calories. Say they're approximate and that recipes vary by country; suggest the chain's own nutrition info if exactness matters.
- Fit suggestions to the user's remaining calories and macros today, their diet, budget and tastes. Never suggest
  anything on their avoid list or outside their diet.
- Add one short tip for handling the same craving next time (planning it in, keeping a better option at home,
  eating enough protein earlier, not arriving starving).
- Never shame. Enjoying food is fine; the aim is good choices most of the time.
- Keep the message short: 2–5 sentences of plain text, no markdown headings or tables. Put the specifics in options.

Safety:
- You give general nutrition guidance, not medical advice. For medical conditions, pregnancy, medications or
  allergies, suggest checking with a doctor or registered dietitian.
- Never encourage eating below the user's daily target by a large margin, skipping meals to "make up" for food,
  purging, or compensatory exercise. If someone describes restricting, bingeing, purging or distress about eating,
  respond with care, don't give numbers or diet tactics, and suggest talking to a doctor or an eating-disorder helpline
  (in Canada, NEDIC: 1-866-633-4220).
- Stay on food, nutrition, eating habits and the app. Politely decline unrelated requests.

Always answer by calling the reply tool.`;

const optionSchema = {
  type: "object",
  properties: {
    name: { type: "string", description: "What to order or eat, specific, e.g. 'Small cappuccino with skim milk, no sugar'." },
    kcal: { type: "number" }, protein: { type: "number" }, carbs: { type: "number" }, fat: { type: "number" },
    sugar: { type: "number" }, satFat: { type: "number" }, sodium: { type: "number", description: "mg" },
    fiber: { type: "number" },
    portion_grams: { type: "number", description: "Approximate weight or volume in g/ml." },
    why: { type: "string", description: "One short line: why this is a good pick." },
    kind: { type: "string", enum: ["original", "smarter", "swap", "healthy"], description: "original = what they asked for, as-is, for comparison." },
  },
  required: ["name", "kcal", "protein", "carbs", "fat", "why", "kind"],
};

const replyTool = {
  name: "reply",
  description: "Send the reply to the user.",
  input_schema: {
    type: "object",
    properties: {
      message: { type: "string", description: "2–5 sentences, plain text." },
      options: { type: "array", items: optionSchema, maxItems: 5, description: "Concrete choices with approximate nutrition. Empty when not relevant." },
      tip: { type: "string", description: "One sentence for handling this craving or situation next time. Optional." },
    },
    required: ["message"],
  },
};

function profileText(p: Record<string, any>) {
  const age = Math.floor((Date.now() - new Date(p.birth_date).getTime()) / (365.25 * 864e5));
  return [
    `Age ${age}, ${p.sex}, ${p.height_cm} cm, ${p.weight_kg} kg. Goal: ${p.goal} weight. Activity: ${p.activity}.`,
    `Diet: ${DIET_LABEL[p.diet] ?? p.diet}. Food budget: ${p.budget}.`,
    p.tastes?.length ? `Likes: ${p.tastes.join(", ")}.` : "",
    p.avoid?.length ? `Never suggest: ${p.avoid.join(", ")}.` : "",
    `Location: ${p.region ? `${p.region}, ` : ""}${p.country}.`,
  ].filter(Boolean).join(" ");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const auth = req.headers.get("Authorization");
  if (!auth) return json({ error: "unauthorized" }, 401);

  const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: auth } },
  });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return json({ error: "unauthorized" }, 401);
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const body = await req.json().catch(() => ({}));
  const message = String(body.message ?? "").trim().slice(0, 1500);
  if (!message) return json({ error: "message required" }, 400);
  const context = JSON.stringify(body.context ?? {}).slice(0, 4000);

  // Cost control: cap messages per user per day.
  const since = new Date(Date.now() - 864e5).toISOString();
  const { count } = await userClient.from("chat_messages").select("id", { count: "exact", head: true })
    .eq("role", "user").gte("created_at", since);
  if ((count ?? 0) >= DAILY_LIMIT) {
    return json({ error: "limit", message: `You've reached today's limit of ${DAILY_LIMIT} coach messages. It resets within 24 hours.` }, 429);
  }

  const { data: profile } = await userClient.from("profiles").select("*").eq("id", user.id).single();
  if (!profile) return json({ error: "profile required" }, 400);

  const { data: past } = await userClient.from("chat_messages").select("role, content")
    .order("created_at", { ascending: false }).limit(HISTORY_TURNS);
  const history = (past ?? []).reverse().map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));
  // The API requires alternating turns starting with the user.
  while (history.length && history[0].role !== "user") history.shift();

  const messages = [
    ...history,
    {
      role: "user" as const,
      content: `<today>${context}</today>\n\n${message}`,
    },
  ];

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": ANTHROPIC_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1500,
      system: `${SYSTEM}\n\nAbout this user: ${profileText(profile)}\nThe <today> block in their latest message is their intake so far today (local time), calculated by the app.`,
      tools: [replyTool],
      tool_choice: { type: "tool", name: "reply" },
      messages,
    }),
  });
  if (!res.ok) {
    console.error("Claude API", res.status, await res.text());
    return json({ error: "upstream", message: "The coach couldn't answer just now. Try again in a moment." }, 502);
  }
  const data = await res.json();
  const call = data.content?.find((c: { type: string }) => c.type === "tool_use");
  const reply = call?.input ?? { message: "Sorry, I couldn't put an answer together. Could you rephrase that?" };
  const payload = { message: reply.message, options: reply.options ?? [], tip: reply.tip ?? null };

  // History stores the plain user message (without the context block) and a text
  // rendering of the reply, so later turns stay coherent without bloating tokens.
  const optionsText = payload.options.map((o: any) => `- ${o.name} (~${Math.round(o.kcal)} kcal)`).join("\n");
  const { error } = await admin.from("chat_messages").insert([
    { user_id: user.id, role: "user", content: message },
    {
      user_id: user.id, role: "assistant", payload,
      content: [reply.message, optionsText, payload.tip ? `Tip: ${payload.tip}` : ""].filter(Boolean).join("\n").slice(0, 4000),
    },
  ]);
  if (error) console.error("save chat", error.message);

  return json({ message: reply.message, options: payload.options, tip: payload.tip });
});
