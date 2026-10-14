import type { Metadata, Viewport } from "next";
import "@fontsource/bricolage-grotesque/400.css";
import "@fontsource/bricolage-grotesque/600.css";
import "@fontsource/bricolage-grotesque/800.css";
import "@fontsource/atkinson-hyperlegible/400.css";
import "@fontsource/atkinson-hyperlegible/700.css";
import { SessionProvider } from "@/lib/session";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import "./globals.css";

export const metadata: Metadata = {
  title: "NomClock",
  description: "Photograph your meals, see your day's nutrition, get practical suggestions.",
  applicationName: "NomClock",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F3F6F5" },
    { media: "(prefers-color-scheme: dark)", color: "#15172B" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <SessionProvider>
          <Nav />
          <main className="page">{children}</main>
          <Footer />
        </SessionProvider>
      </body>
    </html>
  );
}
