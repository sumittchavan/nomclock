// Supabase now injects new-style keys (SUPABASE_PUBLISHABLE_KEYS / SUPABASE_SECRET_KEYS,
// JSON dictionaries) alongside the legacy SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY.
// Read whichever this project has.
import { createClient, type SupabaseClient, type User } from "npm:@supabase/supabase-js@2";

function fromDict(name: string): string | undefined {
  const raw = Deno.env.get(name);
  if (!raw) return undefined;
  try {
    const d = JSON.parse(raw) as Record<string, string>;
    return d.default ?? Object.values(d)[0];
  } catch {
    return undefined;
  }
}

export const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
export const PUBLIC_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? fromDict("SUPABASE_PUBLISHABLE_KEYS")!;
export const SECRET_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? fromDict("SUPABASE_SECRET_KEYS")!;

/** A client acting as the caller (RLS applies), plus the verified user; null if not signed in. */
export async function userFromRequest(req: Request): Promise<{ client: SupabaseClient; user: User } | null> {
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  const client = createClient(SUPABASE_URL, PUBLIC_KEY, { global: { headers: { Authorization: auth } } });
  const { data: { user } } = await client.auth.getUser(auth.slice(7));
  return user ? { client, user } : null;
}

export const adminClient = () => createClient(SUPABASE_URL, SECRET_KEY);

export const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
