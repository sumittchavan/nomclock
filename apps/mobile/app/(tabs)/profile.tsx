import { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, ScrollView, Share, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { api, supabase } from "@/lib/supabase";
import { useSession } from "@/lib/session";
import { useTheme } from "@/lib/theme";
import { ProfileForm } from "@/components/ProfileForm";
import { Button, Section, T } from "@/components/ui";

export default function ProfileTab() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { profile, reloadProfile } = useSession();
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  if (!profile) return null;

  const exportData = async () => {
    setBusy("export");
    const data = await api.exportMyData();
    setBusy(null);
    await Share.share({ title: "NomClock data export", message: JSON.stringify(data, null, 2) });
  };

  const deleteAccount = () =>
    Alert.alert("Delete your account?", "Your profile, every meal and every photo are deleted permanently. This can't be undone.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete account", style: "destructive", onPress: async () => { setBusy("delete"); await api.deleteAccount(); } },
    ]);

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView style={{ backgroundColor: t.bg }} contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: 16, paddingBottom: 60, gap: 16 }} keyboardShouldPersistTaps="handled">
        <T v="h1">Profile</T>
        <ProfileForm initial={profile} userId={profile.id} submitLabel="Save changes"
          onSave={async (p) => { await api.saveProfile(p); await reloadProfile(); Alert.alert("Changes saved", "Your targets are updated."); }} />
        <Section title="Ideas and feedback">
          <T soft>Suggest a feature, ask for a change, report a problem, or vote on other people's ideas.</T>
          <Button kind="ghost" title="Suggest an idea" onPress={() => router.push({ pathname: "/feedback", params: { area: "profile" } })} />
        </Section>
        <Section title="Your data">
          <T soft>Your profile, meals and photos are stored privately in Canada. Photos are only shown to you through links that expire after 10 minutes, and location data is removed before upload. Meal photos and coach messages are sent to Anthropic's Claude API, which processes them outside Canada.</T>
          <View style={{ gap: 10 }}>
            <Button kind="ghost" title={busy === "export" ? "Preparing…" : "Export my data"} busy={busy === "export"} onPress={exportData} />
            <Button kind="ghost" title="Sign out" onPress={() => supabase.auth.signOut()} />
            <Button kind="danger" title={busy === "delete" ? "Deleting…" : "Delete my account"} busy={busy === "delete"} onPress={deleteAccount} />
          </View>
        </Section>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
