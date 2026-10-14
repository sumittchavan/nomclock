import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { computeTargets, type Profile, type Targets } from "@nomclock/shared";
import { api, supabase } from "./supabase";

interface Ctx {
  session: Session | null;
  profile: Profile | null;
  targets: Targets | null;
  loading: boolean;
  reloadProfile: () => Promise<void>;
}

const SessionCtx = createContext<Ctx>({ session: null, profile: null, targets: null, loading: true, reloadProfile: async () => {} });

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const reloadProfile = useCallback(async () => setProfile(await api.getProfile()), []);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      if (data.session) await reloadProfile();
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      if (s) reloadProfile();
      else setProfile(null);
    });
    return () => sub.subscription.unsubscribe();
  }, [reloadProfile]);

  const targets = useMemo(() => (profile ? computeTargets(profile) : null), [profile]);
  return <SessionCtx.Provider value={{ session, profile, targets, loading, reloadProfile }}>{children}</SessionCtx.Provider>;
}

export const useSession = () => useContext(SessionCtx);
