import "react-native-url-polyfill/auto";
import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";
import { AppState, Platform } from "react-native";
import { createClient } from "@supabase/supabase-js";
import { createApi } from "@nutrisnap/shared";

// Hermes has no crypto.randomUUID; the shared API uses it for meal ids.
const g = globalThis as any;
g.crypto = g.crypto ?? {};
if (!g.crypto.randomUUID) g.crypto.randomUUID = Crypto.randomUUID;

/**
 * Session tokens go in the iOS Keychain / Android Keystore rather than plain
 * storage. SecureStore caps values at ~2 KB, so long values are chunked.
 */
const CHUNK = 1800;
const secureStorage = {
  async getItem(key: string) {
    const count = await SecureStore.getItemAsync(`${key}.n`);
    if (!count) return SecureStore.getItemAsync(key);
    const parts = await Promise.all(Array.from({ length: Number(count) }, (_, i) => SecureStore.getItemAsync(`${key}.${i}`)));
    return parts.some((p) => p === null) ? null : parts.join("");
  },
  async setItem(key: string, value: string) {
    await this.removeItem(key);
    const n = Math.ceil(value.length / CHUNK);
    for (let i = 0; i < n; i++) await SecureStore.setItemAsync(`${key}.${i}`, value.slice(i * CHUNK, (i + 1) * CHUNK));
    await SecureStore.setItemAsync(`${key}.n`, String(n));
  },
  async removeItem(key: string) {
    const count = Number((await SecureStore.getItemAsync(`${key}.n`)) ?? 0);
    for (let i = 0; i < count; i++) await SecureStore.deleteItemAsync(`${key}.${i}`);
    await SecureStore.deleteItemAsync(`${key}.n`);
    await SecureStore.deleteItemAsync(key);
  },
};

export const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL ?? "http://localhost:54321",
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "missing-anon-key",
  {
    auth: {
      storage: Platform.OS === "web" ? undefined : secureStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  },
);

// Only refresh tokens while the app is in the foreground.
AppState.addEventListener("change", (s) => {
  if (s === "active") supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});

export const api = createApi(supabase);
