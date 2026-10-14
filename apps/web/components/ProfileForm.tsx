"use client";
import { useState } from "react";
import { computeTargets, type Profile } from "@nutrisnap/shared";

const COUNTRIES: [string, string][] = [
  ["CA", "Canada"], ["US", "United States"], ["IN", "India"], ["GB", "United Kingdom"], ["AU", "Australia"],
  ["AE", "United Arab Emirates"], ["SG", "Singapore"], ["DE", "Germany"], ["NZ", "New Zealand"], ["OTHER", "Other"],
];

const csv = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);

export function ProfileForm({ initial, userId, onSave, submitLabel }: {
  initial: Profile | null;
  userId: string;
  onSave: (p: Profile) => Promise<void>;
  submitLabel: string;
}) {
  const [p, setP] = useState<Profile>(initial ?? {
    id: userId, displayName: "", birthDate: "", sex: "female", heightCm: 165, weightKg: 65,
    activity: "light", goal: "maintain", diet: "omnivore", budget: "medium", tastes: [], avoid: [],
    country: "CA", timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  });
  const [tastes, setTastes] = useState(p.tastes.join(", "));
  const [avoid, setAvoid] = useState(p.avoid.join(", "));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = <K extends keyof Profile>(k: K, v: Profile[K]) => setP((x) => ({ ...x, [k]: v }));

  const complete = p.birthDate && p.heightCm > 0 && p.weightKg > 0;
  const preview = complete ? computeTargets({ ...p, tastes: [], avoid: [] }) : null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      await onSave({ ...p, tastes: csv(tastes), avoid: csv(avoid) });
    } catch (e: any) {
      setErr(e?.message?.includes("adult") ? "NutriSnap is for adults 18 and over." : e?.message ?? "Couldn't save your profile.");
    }
    setBusy(false);
  };

  return (
    <form onSubmit={submit} style={{ display: "grid", gap: 28 }}>
      <fieldset style={{ border: 0, padding: 0, margin: 0, display: "grid", gap: 18 }}>
        <legend><h2 style={{ marginBottom: 14 }}>About you</h2></legend>
        <div className="form-grid">
          <label>Name<input required value={p.displayName} onChange={(e) => set("displayName", e.target.value)} /></label>
          <label>Date of birth<input type="date" required value={p.birthDate} onChange={(e) => set("birthDate", e.target.value)} /></label>
          <label><span>Sex <span className="soft small" style={{ fontWeight: 400 }}>used for energy and nutrient targets</span></span>
            <select value={p.sex} onChange={(e) => set("sex", e.target.value as Profile["sex"])}>
              <option value="female">Female</option><option value="male">Male</option>
            </select>
          </label>
          <label>Height (cm)<input type="number" min={100} max={250} step="0.1" required value={p.heightCm} onChange={(e) => set("heightCm", Number(e.target.value))} /></label>
          <label>Weight (kg)<input type="number" min={30} max={300} step="0.1" required value={p.weightKg} onChange={(e) => set("weightKg", Number(e.target.value))} /></label>
          <label>Country
            <select value={p.country} onChange={(e) => set("country", e.target.value)}>
              {COUNTRIES.map(([c, n]) => <option key={c} value={c}>{n}</option>)}
            </select>
          </label>
          <label><span>Province or region <span className="soft small" style={{ fontWeight: 400 }}>optional</span></span><input value={p.region ?? ""} onChange={(e) => set("region", e.target.value)} /></label>
          <label>Time zone<input value={p.timezone} onChange={(e) => set("timezone", e.target.value)} /></label>
        </div>
      </fieldset>

      <fieldset style={{ border: 0, padding: 0, margin: 0, display: "grid", gap: 18 }}>
        <legend><h2 style={{ marginBottom: 14 }}>Goals and how you eat</h2></legend>
        <div className="form-grid">
          <label>Goal
            <select value={p.goal} onChange={(e) => set("goal", e.target.value as Profile["goal"])}>
              <option value="lose">Lose weight</option><option value="maintain">Maintain</option><option value="gain">Gain weight</option>
            </select>
          </label>
          <label>Activity
            <select value={p.activity} onChange={(e) => set("activity", e.target.value as Profile["activity"])}>
              <option value="sedentary">Mostly sitting</option>
              <option value="light">Light: walks, 1–3 workouts a week</option>
              <option value="moderate">Moderate: 3–5 workouts a week</option>
              <option value="active">Active: 6–7 workouts a week</option>
              <option value="very_active">Very active: physical job or training twice a day</option>
            </select>
          </label>
          <label>Diet
            <select value={p.diet} onChange={(e) => set("diet", e.target.value as Profile["diet"])}>
              <option value="omnivore">Eat everything</option><option value="vegetarian">Vegetarian</option>
              <option value="eggetarian">Vegetarian + eggs</option><option value="vegan">Vegan</option>
              <option value="pescatarian">Pescatarian</option><option value="jain">Jain</option><option value="keto">Keto</option>
            </select>
          </label>
          <label>Food budget
            <select value={p.budget} onChange={(e) => set("budget", e.target.value as Profile["budget"])}>
              <option value="low">Keep it cheap</option><option value="medium">Moderate</option><option value="high">Not a concern</option>
            </select>
          </label>
          <label>Cuisines and tastes you like<input placeholder="indian, spicy, mediterranean" value={tastes} onChange={(e) => setTastes(e.target.value)} /></label>
          <label>Foods to never suggest<input placeholder="mushrooms, peanuts" value={avoid} onChange={(e) => setAvoid(e.target.value)} /></label>
        </div>
      </fieldset>

      {preview && (
        <p className="soft" role="status">
          Your daily target: <b className="num" style={{ color: "var(--ink)" }}>{preview.nutrients.kcal.toLocaleString()} kcal</b>, with{" "}
          {preview.nutrients.protein} g protein, {preview.nutrients.carbs} g carbs and {preview.nutrients.fat} g fat.
          This is a starting estimate; adjust your goal if your weight doesn't move the way you expect after 2–3 weeks.
        </p>
      )}
      {err && <p className="error" role="alert">{err}</p>}
      <div><button className="btn" disabled={busy}>{busy ? "Saving…" : submitLabel}</button></div>
    </form>
  );
}
