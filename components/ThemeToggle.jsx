import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return (
    <button
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      className="p-2 rounded-lg bg-amber-100 dark:bg-zinc-700 text-amber-900 dark:text-zinc-100 transition-all shadow-sm"
    >
      {theme === "dark" ? "☀️" : "🌙"}
    </button>
  );
}
