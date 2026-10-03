import type { Metadata } from "next";

import "./globals.css";



export const metadata: Metadata = {
  title: "Coach Carter AI — Basketball Coaching Assistant",
  description: "AI-powered basketball coaching. Get drills, plays, and motivation from Coach Carter.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body >{children}</body>
    </html>
  );
}
