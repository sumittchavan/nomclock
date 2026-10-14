import type { SupabaseClient } from "@supabase/supabase-js";

export type FeedbackKind = "feature" | "improvement" | "bug" | "other";
export type FeedbackArea = "today" | "photo" | "history" | "coach" | "trends" | "profile" | "design" | "other";
export type FeedbackStatus = "new" | "under_review" | "planned" | "in_progress" | "done" | "declined";
export type Platform = "web" | "ios" | "android";

export const FEEDBACK_KINDS: [FeedbackKind, string][] = [
  ["feature", "New feature"], ["improvement", "Improve something"], ["bug", "Something's broken"], ["other", "Other"],
];
export const FEEDBACK_AREAS: [FeedbackArea, string][] = [
  ["today", "Today"], ["photo", "Photo logging"], ["history", "History"], ["coach", "Coach"],
  ["trends", "Trends"], ["profile", "Profile"], ["design", "Look and feel"], ["other", "Other"],
];
export const STATUS_LABEL: Record<FeedbackStatus, string> = {
  new: "Received", under_review: "Under review", planned: "Planned", in_progress: "In progress", done: "Shipped", declined: "Not planned",
};

export interface FeedbackItem {
  id: string;
  kind: FeedbackKind;
  area: FeedbackArea;
  title: string;
  details: string;
  status: FeedbackStatus;
  adminNote: string | null;
  createdAt: string;
  isPublic?: boolean;
  screenshotPath?: string | null;
  platform?: Platform | null;
  appVersion?: string | null;
  userId?: string;
  votes?: number;
  myVote?: boolean;
  mine?: boolean;
}

const fromRow = (r: Record<string, any>): FeedbackItem => ({
  id: r.id, kind: r.kind, area: r.area, title: r.title, details: r.details ?? "", status: r.status,
  adminNote: r.admin_note ?? null, createdAt: r.created_at, isPublic: r.is_public, screenshotPath: r.screenshot_path,
  platform: r.platform, appVersion: r.app_version, userId: r.user_id,
  votes: r.votes !== undefined ? Number(r.votes) : undefined, myVote: r.my_vote, mine: r.mine,
});

export function createFeedbackApi(sb: SupabaseClient) {
  return {
    async submit(args: {
      userId: string; kind: FeedbackKind; area: FeedbackArea; title: string; details: string;
      platform: Platform; appVersion?: string;
      screenshot?: { data: Blob | ArrayBuffer; contentType: string };
    }) {
      let screenshot_path: string | null = null;
      if (args.screenshot) {
        const path = `${args.userId}/feedback/${crypto.randomUUID()}.jpg`;
        const up = await sb.storage.from("meal-photos").upload(path, args.screenshot.data, { contentType: args.screenshot.contentType });
        if (up.error) throw up.error;
        screenshot_path = path;
      }
      const { error } = await sb.from("feedback").insert({
        kind: args.kind, area: args.area, title: args.title.trim(), details: args.details.trim(),
        platform: args.platform, app_version: args.appVersion ?? null, screenshot_path,
      });
      if (error) {
        if (screenshot_path) await sb.storage.from("meal-photos").remove([screenshot_path]);
        if (error.code === "42501") throw new Error("You've sent 10 suggestions today. Please try again tomorrow.");
        throw error;
      }
    },

    async mine(): Promise<FeedbackItem[]> {
      const { data: { user } } = await sb.auth.getUser();
      if (!user) return [];
      const { data, error } = await sb.from("feedback").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map(fromRow);
    },

    async remove(id: string) {
      const { error } = await sb.from("feedback").delete().eq("id", id);
      if (error) throw error;
    },

    async board(): Promise<FeedbackItem[]> {
      const { data, error } = await sb.rpc("ideas_board");
      if (error) throw error;
      return (data ?? []).map(fromRow);
    },

    async vote(id: string, on: boolean) {
      const { error } = on
        ? await sb.from("feedback_votes").insert({ feedback_id: id })
        : await sb.from("feedback_votes").delete().eq("feedback_id", id);
      if (error && error.code !== "23505") throw error; // already voted is fine
    },

    async isAdmin(): Promise<boolean> {
      const { data } = await sb.rpc("is_admin");
      return data === true;
    },

    async adminList(status?: FeedbackStatus): Promise<FeedbackItem[]> {
      const { data, error } = await sb.rpc("admin_feedback", { status_filter: status ?? null });
      if (error) throw error;
      return (data ?? []).map(fromRow);
    },

    async adminUpdate(id: string, patch: { status?: FeedbackStatus; adminNote?: string | null; isPublic?: boolean }) {
      const row: Record<string, unknown> = {};
      if (patch.status) row.status = patch.status;
      if (patch.adminNote !== undefined) row.admin_note = patch.adminNote || null;
      if (patch.isPublic !== undefined) row.is_public = patch.isPublic;
      const { error } = await sb.from("feedback").update(row).eq("id", id);
      if (error) throw error;
    },

    async screenshotUrl(path: string): Promise<string | null> {
      const { data } = await sb.storage.from("meal-photos").createSignedUrl(path, 600);
      return data?.signedUrl ?? null;
    },
  };
}

export type FeedbackApi = ReturnType<typeof createFeedbackApi>;
