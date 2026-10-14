import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { localDateKey, localHour, slotForHour, zonedMidnight, type MealSlot } from "@nomclock/shared";
import { api } from "@/lib/supabase";
import { useSession } from "@/lib/session";
import { useTheme } from "@/lib/theme";
import { pickPhoto, preparePhoto, type Picked } from "@/lib/photo";
import { Button, Chips, Field, T } from "@/components/ui";

const OFFSETS: [string, string][] = [["0", "Just now"], ["30", "30 min ago"], ["60", "1 hr ago"], ["120", "2 hr ago"], ["180", "3 hr ago"]];

export default function AddMeal() {
  const t = useTheme();
  const router = useRouter();
  const { date } = useLocalSearchParams<{ date?: string }>();
  const { profile } = useSession();
  const tz = profile?.timezone ?? "UTC";
  const isToday = !date || date === localDateKey(new Date(), tz);
  const [photo, setPhoto] = useState<Picked | null>(null);
  const [offset, setOffset] = useState("0");
  const [pastHour, setPastHour] = useState("12");
  const eatenAt = isToday
    ? new Date(Date.now() - Number(offset) * 60_000)
    : new Date(zonedMidnight(date!, tz).getTime() + Number(pastHour) * 3600_000);
  const [slot, setSlot] = useState<MealSlot>(slotForHour(localHour(eatenAt, tz)));
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const choose = async (src: "camera" | "library") => {
    setErr(null);
    try { const p = await pickPhoto(src); if (p) setPhoto(p); }
    catch (e: any) { setErr(e.message); }
  };

  const submit = async () => {
    if (!photo || !profile) return;
    setBusy(true); setErr(null);
    try {
      const data = await preparePhoto(photo);
      await api.logPhotoMeal({ userId: profile.id, photo: data, contentType: "image/jpeg", eatenAt, slot, note: note.trim() || undefined });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (e: any) {
      setErr(e?.message ?? "Couldn't save this meal. Check your connection and try again.");
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: t.surface }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 18, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
        <T v="h1">Add a meal</T>
        {photo ? (
          <View style={{ gap: 10 }}>
            <Image source={{ uri: photo.uri }} style={{ width: "100%", aspectRatio: 4 / 3, borderRadius: 18, backgroundColor: t.track }} contentFit="cover" accessibilityLabel="Selected meal photo" />
            <Button small kind="ghost" title="Choose a different photo" onPress={() => setPhoto(null)} style={{ alignSelf: "flex-start" }} />
          </View>
        ) : (
          <View style={{ borderWidth: 2, borderStyle: "dashed", borderColor: t.line, borderRadius: 18, padding: 22, gap: 12 }}>
            <T soft>Get the whole plate in frame. Location data is removed before upload.</T>
            <Button title="Take a photo" onPress={() => choose("camera")} />
            <Button kind="ghost" title="Choose from library" onPress={() => choose("library")} />
          </View>
        )}
        {isToday
          ? <Chips label="When" value={offset} options={OFFSETS} onChange={(v) => { setOffset(v); setSlot(slotForHour(localHour(new Date(Date.now() - Number(v) * 60_000), tz))); }} />
          : <Chips label="Roughly when" value={pastHour} onChange={(v) => { setPastHour(v); setSlot(slotForHour(Number(v))); }}
              options={[["8", "8 am"], ["10", "10 am"], ["13", "1 pm"], ["16", "4 pm"], ["19", "7 pm"], ["21", "9 pm"]]} />}
        <Chips label="Meal" value={slot} onChange={setSlot} options={[["breakfast", "Breakfast"], ["lunch", "Lunch"], ["dinner", "Dinner"], ["snack", "Snack"]]} />
        <Field label="Anything the photo won't show?" hint="optional" value={note} onChangeText={setNote} placeholder="e.g. cooked in ghee, 2 rotis, no sugar in chai" />
        {err && <T style={{ color: t.warn }} accessibilityRole="alert">{err}</T>}
        <View style={{ flexDirection: "row", gap: 10, justifyContent: "flex-end" }}>
          <Button kind="ghost" title="Cancel" onPress={() => router.back()} disabled={busy} />
          <Button title={busy ? "Reading your plate…" : "Log meal"} busy={busy} disabled={!photo} onPress={submit} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
