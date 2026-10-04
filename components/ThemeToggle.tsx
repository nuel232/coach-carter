"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

type Theme = "light" | "dark";

export default function ThemeToggle() {
  // null until mounted: the real theme is set by the inline script in layout.tsx,
  // so we read it from the DOM instead of guessing during server render.
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    setTheme(document.documentElement.dataset.theme === "light" ? "light" : "dark");
  }, []);

  const toggle = () => {
    const next: Theme = theme === "light" ? "dark" : "light";
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem("cc-theme", next); } catch {}
    setTheme(next);
  };

  const label = theme === "light" ? "Switch to dark mode" : "Switch to light mode";

  return (
    <button
      onClick={toggle}
      title={label}
      aria-label={label}
      className="flex size-9 items-center justify-center rounded-lg text-dust transition hover:bg-ink-800 hover:text-ember-400 focus-visible:outline-2 focus-visible:outline-ember-500"
    >
      {theme === "light" ? <Moon size={16} /> : <Sun size={16} />}
    </button>
  );
}
