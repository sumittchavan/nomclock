import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "@/lib/supabase";
import { useTheme } from "@/lib/theme";
import { Button, Field, T } from "@/components/ui";

export default function Login() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true); setErr(null); setMsg(null);
    const { error } = mode === "signin"
      ? await supabase.auth.signInWithPassword({ email: email.trim(), password })
      : await supabase.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: "nutrisnap://auth-callback" } });
    setBusy(false);
    if (error) setErr(error.message);
    else if (mode === "signup") setMsg("Check your email to confirm your account, then sign in.");
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: t.bg }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 64, paddingHorizontal: 20, gap: 18 }} keyboardShouldPersistTaps="handled">
        <T v="h1" style={{ fontSize: 40, lineHeight: 44 }}>NutriSnap</T>
        <T soft>Photograph what you eat. See your calories, macros and vitamins add up through the day.</T>
        <T v="h2" style={{ marginTop: 12 }}>{mode === "signin" ? "Sign in" : "Create your account"}</T>
        <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" textContentType="emailAddress" />
        <Field label="Password" hint={mode === "signup" ? "at least 10 characters" : undefined} value={password} onChangeText={setPassword} secureTextEntry
          textContentType={mode === "signin" ? "password" : "newPassword"} autoComplete={mode === "signin" ? "current-password" : "new-password"} />
        {err && <T style={{ color: t.warn }} accessibilityRole="alert">{err}</T>}
        {msg && <T>{msg}</T>}
        <Button title={mode === "signin" ? "Sign in" : "Create account"} busy={busy} disabled={!email || password.length < (mode === "signup" ? 10 : 1)} onPress={submit} />
        <Button kind="ghost" title={mode === "signin" ? "New here? Create an account" : "Already have an account? Sign in"} onPress={() => setMode(mode === "signin" ? "signup" : "signin")} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
