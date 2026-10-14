import { useEffect, useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import { addDays, localDateKey, type DailyTotal } from "@nomclock/shared";
import { api } from "@/lib/supabase";
import { useSession } from "@/lib/session";
import { fonts, useTheme } from "@/lib/theme";
import { DayScreen } from "@/components/DayScreen";
import { Button, T } from "@/components/ui";

function monthDays(month: string) {
  const [y, m] = month.split("-").map(Number);
  const count = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const lead = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7;
  return { lead, keys: Array.from({ length: count }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`) };
}
const shiftMonth = (month: string, n: number) => {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 7);
};

function Calendar({ today, selected, onSelect }: { today: string; selected: string; onSelect: (d: string) => void }) {
  const t = useTheme();
  const { targets } = useSession();
  const [month, setMonth] = useState(selected.slice(0, 7));
  const [days, setDays] = useState<Record<string, DailyTotal>>({});
  const grid = useMemo(() => monthDays(month), [month]);

  useEffect(() => {
    api.dailyTotals(grid.keys[0], grid.keys[grid.keys.length - 1]).then((r) => setDays(Object.fromEntries(r.map((d) => [d.day, d]))));
  }, [grid]);

  const target = targets?.nutrients.kcal ?? 2000;
  const tint = (kcal: number) => {
    const r = kcal / target;
    return r > 1.1 ? t.warn + "44" : r >= 0.85 ? t.good + "44" : t.carbs + "33";
  };

  return (
    <View style={{ gap: 10, marginBottom: 28 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Button small kind="ghost" title="‹" accessibilityLabel="Previous month" onPress={() => setMonth(shiftMonth(month, -1))} />
        <T v="h2">{new Date(`${month}-15T12:00:00`).toLocaleDateString([], { month: "long", year: "numeric" })}</T>
        <Button small kind="ghost" title="›" accessibilityLabel="Next month" disabled={month >= today.slice(0, 7)} onPress={() => setMonth(shiftMonth(month, 1))} />
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
          <View key={i} style={{ width: `${100 / 7}%`, alignItems: "center", paddingBottom: 4 }}><T v="small" soft>{d}</T></View>
        ))}
        {Array.from({ length: grid.lead }, (_, i) => <View key={`l${i}`} style={{ width: `${100 / 7}%` }} />)}
        {grid.keys.map((k) => {
          const d = days[k]; const on = k === selected; const future = k > today;
          return (
            <View key={k} style={{ width: `${100 / 7}%`, padding: 3 }}>
              <Pressable
                disabled={future} onPress={() => onSelect(k)} accessibilityRole="button" accessibilityState={{ selected: on, disabled: future }}
                accessibilityLabel={`${k}${d ? `, ${Math.round(d.kcal)} calories` : ", nothing logged"}`}
                style={{ aspectRatio: 1, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: d ? tint(d.kcal) : "transparent", borderWidth: 1.5, borderColor: on ? t.ink : "transparent", opacity: future ? 0.35 : 1 }}
              >
                <T style={{ fontFamily: fonts.displaySemi }}>{Number(k.slice(8))}</T>
                {d && <T v="small" soft style={{ fontSize: 9.5, lineHeight: 12 }}>{Math.round(d.kcal)}</T>}
              </Pressable>
            </View>
          );
        })}
      </View>
    </View>
  );
}

export default function History() {
  const { profile } = useSession();
  const today = profile ? localDateKey(new Date(), profile.timezone) : "";
  const [selected, setSelected] = useState("");
  useEffect(() => { if (today && !selected) setSelected(addDays(today, -1)); }, [today, selected]);
  if (!profile || !selected) return null;
  return <DayScreen key={selected} dateKey={selected} header={<Calendar today={today} selected={selected} onSelect={setSelected} />} />;
}
