"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "@/lib/session";

const AREA_BY_PATH: Record<string, string> = {
  "/": "today", "/history": "history", "/coach": "coach", "/trends": "trends", "/profile": "profile",
};

/** A quiet, always-available way to suggest changes, pre-set to the page you're on. */
export function Footer() {
  const path = usePathname();
  const { session, profile } = useSession();
  if (!session || !profile || path === "/feedback" || path.startsWith("/admin")) return null;
  return (
    <footer className="site-footer">
      <span className="soft small">Missing something, or something not working?</span>{" "}
      <Link className="small" href={`/feedback?area=${AREA_BY_PATH[path] ?? "other"}`}>Suggest an idea</Link>
    </footer>
  );
}
