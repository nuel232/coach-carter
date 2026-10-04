import type { Metadata, Viewport } from "next";
import { Barlow_Condensed, Inter } from "next/font/google";
import { cookies } from "next/headers";

import "./globals.css";

const display = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-barlow",
  display: "swap",
});

const sans = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Coach Carter AI — Basketball Coaching Assistant",
  description: "AI-powered basketball coaching. Get drills, plays, and motivation from Coach Carter.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf5ee" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0a09" },
  ],
  colorScheme: "dark light",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // The saved theme lives in a cookie so the server can put it on <html> directly:
  // no inline <script> (React 19 warns on those) and no wrong-theme flash.
  // With no cookie yet, globals.css follows the OS via prefers-color-scheme.
  const saved = (await cookies()).get("cc-theme")?.value;
  const theme = saved === "light" || saved === "dark" ? saved : undefined;

  return (
    <html lang="en" className={`${display.variable} ${sans.variable}`} data-theme={theme}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
