import { useCallback, useEffect, useState } from "react";

export type Theme = "light" | "dark";

// The inline script in index.html applies the same logic before first paint.
const KEY = "beatsense:theme";
const BG: Record<Theme, string> = { light: "#f4f4f5", dark: "#0a0a0b" };
const DARK_QUERY = "(prefers-color-scheme: dark)";

/**
 * Starts from the device preference (or the last toggle choice), follows device
 * changes, and lets the user flip it. Whichever changed last wins.
 */
export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() =>
    document.documentElement.dataset.theme === "dark" ? "dark" : "light",
  );

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.setAttribute("content", BG[theme]);
  }, [theme]);

  useEffect(() => {
    const mq = matchMedia(DARK_QUERY);
    const onChange = () => {
      setTheme(mq.matches ? "dark" : "light");
      try {
        localStorage.removeItem(KEY); // the device spoke last
      } catch {
        // Storage unavailable: nothing to clear.
      }
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const toggle = useCallback(() => {
    const next = theme === "dark" ? "light" : "dark";
    try {
      localStorage.setItem(KEY, next);
    } catch {
      // Storage unavailable: the choice just won't persist.
    }
    setTheme(next);
  }, [theme]);

  return { theme, toggle };
}
