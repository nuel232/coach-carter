"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

type Theme = "light" | "dark";

export default function ThemeToggle() {
  // null until mounted. The server puts a saved choice on <html data-theme>;
  // with none saved we fall back to the OS setting, same as the CSS does.
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    const attr = document.documentElement.dataset.theme;
    const system = matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
    setTheme(attr === "light" || attr === "dark" ? attr : system);
  }, []);

  const toggle = () => {
    const next: Theme = theme === "light" ? "dark" : "light";
    document.documentElement.dataset.theme = next;
    document.cookie = `cc-theme=${next}; path=/; max-age=31536000; samesite=lax`;
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
