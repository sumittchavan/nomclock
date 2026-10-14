"use client";
import { useRouter } from "next/navigation";
import { api } from "@/lib/supabase";
import { useSession } from "@/lib/session";
import { ProfileForm } from "@/components/ProfileForm";

export default function Onboarding() {
  const { session, reloadProfile } = useSession();
  const router = useRouter();
  if (!session) return null;
  return (
    <div style={{ maxWidth: 760, display: "grid", gap: 24 }}>
      <div>
        <h1>Set up your profile</h1>
        <p className="soft">Your targets and suggestions are based on these details. Only you can see them. Your data is stored in Canada; meal photos you log are sent to Anthropic's Claude API to estimate their nutrition.</p>
      </div>
      <ProfileForm
        initial={null} userId={session.user.id} submitLabel="Save and start logging"
        onSave={async (p) => { await api.saveProfile(p); await reloadProfile(); router.replace("/"); }}
      />
    </div>
  );
}
