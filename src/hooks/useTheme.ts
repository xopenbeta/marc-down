import { useEffect } from "react";
import { useAtomValue } from "jotai";
import { settingsAtom } from "@/atoms";

export function useTheme() {
  const settings = useAtomValue(settingsAtom);

  useEffect(() => {
    const apply = (dark: boolean) => {
      document.documentElement.dataset.theme = dark ? "dark" : "light";
    };

    if (settings.theme === "light") {
      apply(false);
      return;
    }
    if (settings.theme === "dark") {
      apply(true);
      return;
    }

    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    apply(mq.matches);
    const handler = (e: MediaQueryListEvent) => apply(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [settings.theme]);
}
