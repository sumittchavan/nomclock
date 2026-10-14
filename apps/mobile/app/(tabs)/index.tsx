import { localDateKey } from "@nutrisnap/shared";
import { useSession } from "@/lib/session";
import { DayScreen } from "@/components/DayScreen";

export default function Today() {
  const { profile } = useSession();
  if (!profile) return null;
  return <DayScreen dateKey={localDateKey(new Date(), profile.timezone)} title="Today" />;
}
