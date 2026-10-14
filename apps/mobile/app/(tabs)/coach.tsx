import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, FlatList, KeyboardAvoidingView, Platform, Pressable, TextInput, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import {
  COACH_STARTERS, buildCoachContext, localDateKey, localHour, localRange, optionToItem, slotForHour, sumMeals,
  type ChatTurn, type CoachOption, type MealWithStatus,
} from "@nutrisnap/shared";
import { api } from "@/lib/supabase";
import { useSession } from "@/lib/session";
import { fonts, useTheme } from "@/lib/theme";
import { Button, T } from "@/components/ui";

const KIND_LABEL: Record<CoachOption["kind"], string> = {
  original: "As you'd usually order it", smarter: "Same thing, lighter", swap: "Swap", healthy: "Healthiest pick",
};

function OptionRow({ o, onLog }: { o: CoachOption; onLog: (o: CoachOption) => Promise<void> }) {
  const t = useTheme();
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const accent = { original: t.line, smarter: t.carbs, swap: t.info, healthy: t.good }[o.kind] ?? t.line;
  return (
    <View style={{ borderLeftWidth: 4, borderLeftColor: accent, borderBottomWidth: 1, borderBottomColor: t.line, paddingVertical: 12, paddingLeft: 12, gap: 3 }}>
      <T v="small" soft>{KIND_LABEL[o.kind] ?? o.kind}</T>
      <T v="bodyBold">{o.name}</T>
      <T v="small" soft>{o.why}</T>
      <T v="small" soft>P {Math.round(o.protein)} g, C {Math.round(o.carbs)} g, F {Math.round(o.fat)} g{o.sugar ? `, sugar ${Math.round(o.sugar)} g` : ""}</T>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 6 }}>
        <T v="h2">~{Math.round(o.kcal)}<T v="small" soft> kcal</T></T>
        <Button small kind="ghost" disabled={state !== "idle"} busy={state === "busy"}
          title={state === "done" ? "Logged" : "Log this"} accessibilityLabel={`Log ${o.name}`}
          onPress={async () => { setState("busy"); await onLog(o); setState("done"); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); }} />
      </View>
    </View>
  );
}

export default function Coach() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { profile, targets } = useSession();
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [meals, setMeals] = useState<MealWithStatus[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const list = useRef<FlatList<ChatTurn>>(null);
  const tz = profile?.timezone ?? "UTC";

  const loadToday = useCallback(async () => {
    if (!profile) return;
    const today = localDateKey(new Date(), tz);
    const [from, to] = localRange(today, today, tz);
    setMeals(await api.listMeals(from, to));
  }, [profile, tz]);

  useFocusEffect(useCallback(() => { loadToday(); }, [loadToday]));
  useEffect(() => { if (profile) api.chatHistory().then(setTurns); }, [profile]);

  if (!profile || !targets) return null;
  const totals = sumMeals(meals);
  const left = Math.round(targets.nutrients.kcal - totals.kcal);

  const send = async (msg: string) => {
    const message = msg.trim();
    if (!message || sending) return;
    setText(""); setSending(true);
    const now = new Date().toISOString();
    setTurns((x) => [...x,
      { id: `u-${now}`, role: "user", content: message, createdAt: now },
      { id: `p-${now}`, role: "assistant", content: "", createdAt: now, pending: true }]);
    try {
      const r = await api.sendChat(message, buildCoachContext(profile, targets, meals));
      setTurns((x) => x.map((m) => (m.id === `p-${now}` ? { ...m, pending: false, content: r.message, options: r.options, tip: r.tip } : m)));
    } catch (e: any) {
      setTurns((x) => x.map((m) => (m.id === `p-${now}` ? { ...m, pending: false, error: true, content: e?.message ?? "Something went wrong." } : m)));
    }
    setSending(false);
  };

  const logOption = async (o: CoachOption) => {
    const now = new Date();
    await api.logManualItem({ userId: profile.id, eatenAt: now, slot: slotForHour(localHour(now, tz)), item: optionToItem(o) });
    await loadToday();
  };

  const clear = () => Alert.alert("Clear your conversation?", "Your chat history with the coach is deleted.", [
    { text: "Cancel", style: "cancel" },
    { text: "Clear", style: "destructive", onPress: async () => { await api.clearChat(); setTurns([]); } },
  ]);

  const renderTurn = ({ item: m }: { item: ChatTurn }) => m.role === "user" ? (
    <View style={{ alignSelf: "flex-end", maxWidth: "82%", backgroundColor: t.ink, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 18, borderBottomRightRadius: 4, marginBottom: 16 }}>
      <T style={{ color: t.onInk }}>{m.content}</T>
    </View>
  ) : (
    <View style={{ marginBottom: 22, gap: 10 }}>
      {m.pending ? <T soft>Thinking about your options…</T> : (
        <>
          <T style={m.error ? { color: t.warn } : undefined}>{m.content}</T>
          {!!m.options?.length && (
            <View style={{ borderTopWidth: 1, borderTopColor: t.line }}>
              {m.options.map((o, i) => <OptionRow key={i} o={o} onLog={logOption} />)}
            </View>
          )}
          {m.tip ? (
            <View style={{ borderLeftWidth: 2, borderLeftColor: t.line, paddingLeft: 12 }}>
              <T soft><T v="bodyBold">Next time: </T>{m.tip}</T>
            </View>
          ) : null}
        </>
      )}
    </View>
  );

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: t.bg }} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={0}>
      <View style={{ paddingTop: insets.top + 12, paddingHorizontal: 16, paddingBottom: 8, gap: 2 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <T v="h1">Coach</T>
          {turns.length > 0 && <Button small kind="ghost" title="Clear" accessibilityLabel="Clear chat" onPress={clear} />}
        </View>
        <T soft>Today: {Math.round(totals.kcal).toLocaleString()} of {targets.nutrients.kcal.toLocaleString()} kcal, {left >= 0 ? `${left.toLocaleString()} left` : `${Math.abs(left).toLocaleString()} over`}</T>
      </View>

      <FlatList
        ref={list}
        data={turns}
        keyExtractor={(m) => m.id}
        renderItem={renderTurn}
        contentContainerStyle={{ padding: 16, flexGrow: 1 }}
        onContentSizeChange={() => list.current?.scrollToEnd({ animated: true })}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <View style={{ gap: 14 }}>
            <T soft>Tell the coach what you're craving or about to order. It knows what you've eaten today and how much room is left.</T>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {COACH_STARTERS.map((s) => <Button key={s} small kind="ghost" title={s} onPress={() => send(s)} />)}
            </View>
          </View>
        }
        ListFooterComponent={turns.length ? <T v="small" soft>Calories for menu items are estimates. General guidance, not medical advice.</T> : null}
      />

      <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8, margin: 12, padding: 6, paddingLeft: 14, borderRadius: 22, borderWidth: 1.5, borderColor: t.line, backgroundColor: t.surface }}>
        <TextInput
          value={text} onChangeText={setText} placeholder="e.g. I'm at Starbucks and want a mocha" placeholderTextColor={t.inkSoft}
          multiline maxLength={1500} accessibilityLabel="Message the coach"
          style={{ flex: 1, color: t.ink, fontFamily: fonts.body, fontSize: 16, paddingVertical: 8, maxHeight: 120 }}
        />
        <Pressable onPress={() => send(text)} disabled={!text.trim() || sending} accessibilityRole="button" accessibilityLabel="Send"
          style={{ backgroundColor: t.ink, opacity: !text.trim() || sending ? 0.4 : 1, borderRadius: 999, paddingVertical: 10, paddingHorizontal: 16 }}>
          <T v="bodyBold" style={{ color: t.onInk }}>Send</T>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
