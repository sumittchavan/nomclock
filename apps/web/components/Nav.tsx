"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "@/lib/session";
import { BrandMark } from "./BrandMark";

const LINKS = [
  { href: "/", label: "Today" },
  { href: "/history", label: "History" },
  { href: "/coach", label: "Coach" },
  { href: "/trends", label: "Trends" },
  { href: "/profile", label: "Profile" },
];

export function Nav() {
  const path = usePathname();
  const { session, profile } = useSession();
  return (
    <header className="nav">
      <Link href="/" className="brand" aria-label="NomClock home"><BrandMark size={30} /><span>nomclock</span></Link>
      {session && profile && (
        <nav className="nav-links" aria-label="Main">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} aria-current={path === l.href ? "page" : undefined}>{l.label}</Link>
          ))}
        </nav>
      )}
    </header>
  );
}
