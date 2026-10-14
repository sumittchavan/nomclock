"use client";
import { useState } from "react";
import { api, supabase } from "@/lib/supabase";
import { useSession } from "@/lib/session";
import { ProfileForm } from "@/components/ProfileForm";

export default function ProfilePage() {
  const { session, profile, reloadProfile } = useSession();
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  if (!session || !profile) return null;

  const exportData = async () => {
    setBusy("export");
    const data = await api.exportMyData();
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: `nutrisnap-export-${data.exportedAt.slice(0, 10)}.json` });
    a.click();
    URL.revokeObjectURL(url);
    setBusy(null);
  };

  const deleteAccount = async () => {
    if (prompt('This permanently deletes your account, meals and photos. Type "delete" to confirm.') !== "delete") return;
    setBusy("delete");
    await api.deleteAccount();
  };

  return (
    <div style={{ maxWidth: 760, display: "grid", gap: 24 }}>
      <h1>Profile</h1>
      <ProfileForm
        initial={profile} userId={profile.id} submitLabel="Save changes"
        onSave={async (p) => { await api.saveProfile(p); await reloadProfile(); setSaved(true); setTimeout(() => setSaved(false), 2500); }}
      />
      {saved && <p role="status">Changes saved. Your targets are updated.</p>}

      <section className="section">
        <h2>Your data</h2>
        <p className="soft" style={{ marginBottom: 14, maxWidth: "65ch" }}>
          Your profile, meals and photos are stored privately in Canada. Photos are only shown to you through links
          that expire after 10 minutes, and location data is removed before upload. To estimate nutrition, each photo is
          sent to Anthropic's Claude API, which processes it outside Canada.
        </p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button className="btn ghost" onClick={exportData} disabled={busy !== null}>{busy === "export" ? "Preparing…" : "Download my data"}</button>
          <button className="btn ghost" onClick={() => supabase.auth.signOut()}>Sign out</button>
          <button className="btn danger" onClick={deleteAccount} disabled={busy !== null}>{busy === "delete" ? "Deleting…" : "Delete my account"}</button>
        </div>
      </section>
    </div>
  );
}
