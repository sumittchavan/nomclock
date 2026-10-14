import { useCallback, useEffect, useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from "react-native";
import { Image } from "expo-image";
import Constants from "expo-constants";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import {
  FEEDBACK_AREAS, FEEDBACK_KINDS, STATUS_LABEL,
  type FeedbackArea, type FeedbackItem, type FeedbackKind,
} from "@nutrisnap/shared";
import { api } from "@/lib/supabase";
import { useSession } from "@/lib/session";
import { fonts, useTheme } from "@/lib/theme";
import { pickPhoto, preparePhoto, type Picked } from "@/lib/photo";
import { Button, Chips, Field, T } from "@/components/ui";

type View_ = "suggest" | "board" | "mine";
const AREA_TEXT = Object.fromEntries(FEEDBACK_AREAS) as Record<FeedbackArea, string>;
const KIND_TEXT = Object.fromEntries(FEEDBACK_KINDS) as Record<FeedbackKind, string>;

function Status({ s }: { s: FeedbackItem["status"] }) {
  const t = useTheme();
  const color = s === "done" ? t.good : s === "planned" || s === "in_progress" ? t.carbs : t.line;
  return (
    <View style={{ borderWidth: 1, borderColor: color, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 1, alignSelf: "flex-start" }}>
      <T v="small" style={{ fontSize: 12 }}>{STATUS_LABEL[s]}</T>
    </View>
  );
}

function Reply({ note }: { note: string }) {
  const t = useTheme();
  return (
    <View style={{ borderLeftWidth: 2, borderLeftColor: t.line, paddingLeft: 10 }}>
      <T v="small" soft><T v="small" style={{ fontFamily: fonts.bodyBold }}>From the team: </T>{note}</T>
    </View>
  );
}

function Suggest({ initialArea, onSent }: { initialArea: FeedbackArea; onSent: () => void }) {
  const t = useTheme();
  const { profile } = useSession();
  const [kind, setKind] = useState<FeedbackKind>("feature");
  const [area, setArea] = useState<FeedbackArea>(initialArea);
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [shot, setShot] = useState<Picked | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    if (!profile) return;
    setBusy(true); setErr(null);
    try {
      const screenshot = shot ? { data: await preparePhoto(shot, 1400), contentType: "image/jpeg" } : undefined;
      await api.feedback.submit({
        userId: profile.id, kind, area, title, details, screenshot,
        platform: Platform.OS === "ios" ? "ios" : "android", appVersion: Constants.expoConfig?.version,
      });
      setTitle(""); setDetails(""); setShot(null);
      onSent();
    } catch (e: any) {
      setErr(e?.message ?? "Couldn't send your suggestion. Try again.");
    }
    setBusy(false);
  };

  return (
    <View style={{ gap: 18 }}>
      <Chips label="What kind of suggestion?" value={kind} onChange={setKind} options={FEEDBACK_KINDS} />
      <Chips label="Which part of the app?" value={area} onChange={setArea} options={FEEDBACK_AREAS} />
      <Field label="In a sentence" value={title} onChangeText={setTitle} maxLength={120}
        placeholder={kind === "bug" ? "e.g. The calendar shows the wrong day" : "e.g. Scan barcodes on packaged food"} />
      <Field label="Details" hint="optional" value={details} onChangeText={setDetails} maxLength={2000} multiline
        style={{ minHeight: 110, textAlignVertical: "top" }}
        placeholder={kind === "bug" ? "What did you do, what did you expect, and what happened?" : "How would it work? What would it help you do?"} />
      <View style={{ gap: 8 }}>
        <T v="bodyBold" style={{ fontSize: 14.5 }}>Screenshot <T v="small" soft>optional</T></T>
        {shot ? (
          <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
            <Image source={{ uri: shot.uri }} style={{ width: 64, height: 110, borderRadius: 8 }} contentFit="cover" accessibilityLabel="Attached screenshot" />
            <Button small kind="ghost" title="Remove" onPress={() => setShot(null)} />
          </View>
        ) : (
          <Button small kind="ghost" title="Attach a screenshot" style={{ alignSelf: "flex-start" }}
            onPress={async () => { try { const p = await pickPhoto("library"); if (p) setShot(p); } catch (e: any) { setErr(e.message); } }} />
        )}
      </View>
      {err && <T style={{ color: t.warn }} accessibilityRole="alert">{err}</T>}
      <Button title={busy ? "Sending…" : "Send suggestion"} busy={busy} disabled={title.trim().length < 3} onPress={submit} />
      <T v="small" soft>Only the NutriSnap team sees your suggestion. If we add it to the public ideas board, your name isn't shown.</T>
    </View>
  );
}

function Board() {
  const t = useTheme();
  const [ideas, setIdeas] = useState<FeedbackItem[] | null>(null);
  useEffect(() => { api.feedback.board().then(setIdeas); }, []);
  if (!ideas) return <T soft>Loading…</T>;
  if (!ideas.length) return <T soft>No ideas on the board yet. Suggest one and it may appear here.</T>;
  const toggle = async (i: FeedbackItem) => {
    setIdeas((xs) => xs?.map((x) => x.id === i.id ? { ...x, myVote: !x.myVote, votes: (x.votes ?? 0) + (x.myVote ? -1 : 1) } : x) ?? null);
    await api.feedback.vote(i.id, !i.myVote);
  };
  return (
    <View style={{ borderTopWidth: 1, borderTopColor: t.line }}>
      {ideas.map((i) => (
        <View key={i.id} style={{ flexDirection: "row", gap: 12, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: t.line }}>
          <Pressable onPress={() => toggle(i)} accessibilityRole="button" accessibilityState={{ selected: !!i.myVote }}
            accessibilityLabel={`${i.myVote ? "Remove your vote for" : "Vote for"} ${i.title}. ${i.votes} votes`}
            style={{ width: 52, alignItems: "center", paddingVertical: 8, borderRadius: 12, borderWidth: 1.5, borderColor: i.myVote ? t.ink : t.line, backgroundColor: i.myVote ? t.ink : t.surface }}>
            <Svg width={14} height={10} viewBox="0 0 14 10"><Path d="M7 1 13 9H1z" fill={i.myVote ? t.onInk : t.inkSoft} /></Svg>
            <T v="num" style={{ color: i.myVote ? t.onInk : t.ink }}>{i.votes}</T>
          </Pressable>
          <View style={{ flex: 1, gap: 4 }}>
            <T v="h3">{i.title}</T>
            {!!i.details && <T v="small" soft>{i.details}</T>}
            <View style={{ flexDirection: "row", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <Status s={i.status} /><T v="small" soft>{AREA_TEXT[i.area]}</T>{i.mine && <T v="small" soft>Your idea</T>}
            </View>
            {i.adminNote && <Reply note={i.adminNote} />}
          </View>
        </View>
      ))}
    </View>
  );
}

function Mine({ refreshKey }: { refreshKey: number }) {
  const t = useTheme();
  const [items, setItems] = useState<FeedbackItem[] | null>(null);
  const load = useCallback(() => api.feedback.mine().then(setItems), []);
  useEffect(() => { load(); }, [load, refreshKey]);
  if (!items) return <T soft>Loading…</T>;
  if (!items.length) return <T soft>You haven't sent any suggestions yet.</T>;
  return (
    <View style={{ borderTopWidth: 1, borderTopColor: t.line }}>
      {items.map((i) => (
        <View key={i.id} style={{ paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: t.line, gap: 5 }}>
          <T v="h3">{i.title}</T>
          <View style={{ flexDirection: "row", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <Status s={i.status} />
            <T v="small" soft>{KIND_TEXT[i.kind]}, {AREA_TEXT[i.area]}</T>
            {i.isPublic && <T v="small" soft>On the ideas board</T>}
          </View>
          {!!i.details && <T v="small" soft>{i.details}</T>}
          {i.adminNote && <Reply note={i.adminNote} />}
          {i.status === "new" && (
            <Button small kind="ghost" title="Withdraw" style={{ alignSelf: "flex-start" }}
              onPress={() => Alert.alert("Withdraw this suggestion?", undefined, [
                { text: "Cancel", style: "cancel" },
                { text: "Withdraw", style: "destructive", onPress: async () => { await api.feedback.remove(i.id); load(); } },
              ])} />
          )}
        </View>
      ))}
    </View>
  );
}

export default function FeedbackScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { area } = useLocalSearchParams<{ area?: string }>();
  const [view, setView] = useState<View_>("suggest");
  const [sent, setSent] = useState(0);
  const initialArea = FEEDBACK_AREAS.some(([a]) => a === area) ? (area as FeedbackArea) : "other";

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: t.bg }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: 16, paddingBottom: 60, gap: 16 }} keyboardShouldPersistTaps="handled">
        <Button small kind="ghost" title="‹ Back" onPress={() => router.back()} style={{ alignSelf: "flex-start" }} />
        <T v="h1">Ideas and feedback</T>
        <T soft>Tell us what to add or change in NutriSnap, and vote on ideas from other people.</T>
        <View style={{ flexDirection: "row", borderWidth: 1.5, borderColor: t.line, borderRadius: 999, padding: 3, alignSelf: "flex-start" }} accessibilityRole="tablist">
          {([["suggest", "Suggest"], ["board", "Ideas board"], ["mine", "Yours"]] as [View_, string][]).map(([v, l]) => (
            <Pressable key={v} onPress={() => setView(v)} accessibilityRole="tab" accessibilityState={{ selected: v === view }}
              style={{ paddingVertical: 7, paddingHorizontal: 14, borderRadius: 999, backgroundColor: v === view ? t.ink : "transparent" }}>
              <T style={{ color: v === view ? t.onInk : t.inkSoft }}>{l}</T>
            </Pressable>
          ))}
        </View>
        {sent > 0 && view === "suggest" && (
          <View style={{ borderLeftWidth: 4, borderLeftColor: t.good, paddingVertical: 8, paddingLeft: 12 }} accessibilityLiveRegion="polite">
            <T>Thanks, your suggestion was sent. Follow its status under Yours.</T>
          </View>
        )}
        {view === "suggest" && <Suggest initialArea={initialArea} onSent={() => setSent((n) => n + 1)} />}
        {view === "board" && <Board />}
        {view === "mine" && <Mine refreshKey={sent} />}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
