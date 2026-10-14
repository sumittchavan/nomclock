import { KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/lib/supabase";
import { useSession } from "@/lib/session";
import { useTheme } from "@/lib/theme";
import { ProfileForm } from "@/components/ProfileForm";
import { T } from "@/components/ui";

export default function Onboarding() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { session, reloadProfile } = useSession();
  if (!session) return null;
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView style={{ backgroundColor: t.bg }} contentContainerStyle={{ paddingTop: insets.top + 16, paddingHorizontal: 16, paddingBottom: 60, gap: 16 }} keyboardShouldPersistTaps="handled">
        <T v="h1">Set up your profile</T>
        <T soft>Your targets and suggestions are based on these details. Only you can see them. Your data is stored in Canada; meal photos you log are sent to Anthropic's Claude API to estimate their nutrition.</T>
        <ProfileForm initial={null} userId={session.user.id} submitLabel="Save and start logging"
          onSave={async (p) => { await api.saveProfile(p); await reloadProfile(); router.replace("/"); }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
