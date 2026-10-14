import { useState } from "react";
import { View } from "react-native";
import { computeTargets, type Profile } from "@nomclock/shared";
import { useTheme } from "@/lib/theme";
import { Button, Chips, Field, Section, T } from "./ui";

const csv = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);
const deviceTz = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

export function ProfileForm({ initial, userId, submitLabel, onSave }: {
  initial: Profile | null; userId: string; submitLabel: string; onSave: (p: Profile) => Promise<void>;
}) {
  const t = useTheme();
  const [p, setP] = useState<Profile>(initial ?? {
    id: userId, displayName: "", birthDate: "", sex: "female", heightCm: 165, weightKg: 65, activity: "light", goal: "maintain",
    diet: "omnivore", budget: "medium", tastes: [], avoid: [], country: "CA", timezone: deviceTz(),
  });
  const [height, setHeight] = useState(String(p.heightCm));
  const [weight, setWeight] = useState(String(p.weightKg));
  const [tastes, setTastes] = useState(p.tastes.join(", "));
  const [avoid, setAvoid] = useState(p.avoid.join(", "));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = <K extends keyof Profile>(k: K, v: Profile[K]) => setP((x) => ({ ...x, [k]: v }));

  const full: Profile = { ...p, heightCm: Number(height), weightKg: Number(weight), tastes: csv(tastes), avoid: csv(avoid) };
  const validDate = /^\d{4}-\d{2}-\d{2}$/.test(p.birthDate);
  const preview = validDate && full.heightCm > 0 && full.weightKg > 0 ? computeTargets(full) : null;

  const save = async () => {
    if (!validDate) return setErr("Enter your date of birth as YYYY-MM-DD.");
    setBusy(true); setErr(null);
    try { await onSave(full); }
    catch (e: any) { setErr(e?.message?.includes("adult") ? "NomClock is for adults 18 and over." : e?.message ?? "Couldn't save your profile."); }
    setBusy(false);
  };

  return (
    <View style={{ gap: 18 }}>
      <Section title="About you" first>
        <Field label="Name" value={p.displayName} onChangeText={(v) => set("displayName", v)} autoComplete="name" />
        <Field label="Date of birth" hint="YYYY-MM-DD" value={p.birthDate} onChangeText={(v) => set("birthDate", v)} keyboardType="numbers-and-punctuation" placeholder="1990-05-21" />
        <Chips label="Sex (for energy and nutrient targets)" value={p.sex} onChange={(v) => set("sex", v)} options={[["female", "Female"], ["male", "Male"]]} />
        <View style={{ flexDirection: "row", gap: 12 }}>
          <View style={{ flex: 1 }}><Field label="Height (cm)" value={height} onChangeText={setHeight} keyboardType="decimal-pad" /></View>
          <View style={{ flex: 1 }}><Field label="Weight (kg)" value={weight} onChangeText={setWeight} keyboardType="decimal-pad" /></View>
        </View>
        <Chips label="Country" value={p.country} onChange={(v) => set("country", v)}
          options={[["CA", "Canada"], ["US", "US"], ["IN", "India"], ["GB", "UK"], ["AU", "Australia"], ["OTHER", "Other"]]} />
        <Field label="Province or region" hint="optional" value={p.region ?? ""} onChangeText={(v) => set("region", v)} />
        <Field label="Time zone" value={p.timezone} onChangeText={(v) => set("timezone", v)} autoCapitalize="none" />
      </Section>
      <Section title="Goals and how you eat">
        <Chips label="Goal" value={p.goal} onChange={(v) => set("goal", v)} options={[["lose", "Lose weight"], ["maintain", "Maintain"], ["gain", "Gain weight"]]} />
        <Chips label="Activity" value={p.activity} onChange={(v) => set("activity", v)} options={[
          ["sedentary", "Mostly sitting"], ["light", "1–3 workouts/wk"], ["moderate", "3–5 workouts/wk"], ["active", "6–7 workouts/wk"], ["very_active", "Physical job / athlete"],
        ]} />
        <Chips label="Diet" value={p.diet} onChange={(v) => set("diet", v)} options={[
          ["omnivore", "Eat everything"], ["vegetarian", "Vegetarian"], ["eggetarian", "Veg + eggs"], ["vegan", "Vegan"], ["pescatarian", "Pescatarian"], ["jain", "Jain"], ["keto", "Keto"],
        ]} />
        <Chips label="Food budget" value={p.budget} onChange={(v) => set("budget", v)} options={[["low", "Keep it cheap"], ["medium", "Moderate"], ["high", "Not a concern"]]} />
        <Field label="Cuisines and tastes you like" value={tastes} onChangeText={setTastes} placeholder="indian, spicy, mediterranean" autoCapitalize="none" />
        <Field label="Foods to never suggest" value={avoid} onChangeText={setAvoid} placeholder="mushrooms, peanuts" autoCapitalize="none" />
      </Section>
      {preview && (
        <T soft>
          Your daily target: <T v="bodyBold">{preview.nutrients.kcal.toLocaleString()} kcal</T>, with {preview.nutrients.protein} g protein,{" "}
          {preview.nutrients.carbs} g carbs and {preview.nutrients.fat} g fat. Adjust your goal if your weight doesn't move as expected after 2–3 weeks.
        </T>
      )}
      {err && <T style={{ color: t.warn }} accessibilityRole="alert">{err}</T>}
      <Button title={busy ? "Saving…" : submitLabel} busy={busy} onPress={save} />
    </View>
  );
}
