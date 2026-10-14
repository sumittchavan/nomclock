"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { BrandMark } from "@/components/BrandMark";

export default function LoginPage() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr(null); setMsg(null);
    const { error } = mode === "signin"
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } });
    setBusy(false);
    if (error) setErr(error.message);
    else if (mode === "signup") setMsg("Check your email to confirm your account, then sign in.");
  };

  return (
    <div style={{ maxWidth: 420, margin: "8vh auto 0", display: "grid", gap: 22 }}>
      <BrandMark size={72} label="NomClock" />
      <div>
        <h1>{mode === "signin" ? "Sign in" : "Create your account"}</h1>
        <p className="soft">Photograph what you eat. See your calories, macros and vitamins add up through the day.</p>
      </div>
      <form onSubmit={submit} style={{ display: "grid", gap: 16 }}>
        <label>Email<input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        <label>Password<input type="password" autoComplete={mode === "signin" ? "current-password" : "new-password"} minLength={10} required value={password} onChange={(e) => setPassword(e.target.value)} /></label>
        {err && <p className="error" role="alert">{err}</p>}
        {msg && <p role="status">{msg}</p>}
        <button className="btn" disabled={busy}>{mode === "signin" ? "Sign in" : "Create account"}</button>
      </form>
      <p className="soft">
        {mode === "signin" ? "New here? " : "Already have an account? "}
        <button className="btn ghost small" onClick={() => setMode(mode === "signin" ? "signup" : "signin")}>
          {mode === "signin" ? "Create an account" : "Sign in"}
        </button>
      </p>
    </div>
  );
}
