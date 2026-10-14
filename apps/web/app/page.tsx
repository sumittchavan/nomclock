"use client";
import { localDateKey } from "@nutrisnap/shared";
import { useSession } from "@/lib/session";
import { DayView } from "@/components/DayView";

export default function TodayPage() {
  const { profile } = useSession();
  if (!profile) return null;
  return <DayView dateKey={localDateKey(new Date(), profile.timezone)} title="Today" />;
}
