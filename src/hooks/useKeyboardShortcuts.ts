import { useEffect } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { activeFilePathAtom, isSearchPanelOpenAtom } from "@/atoms";
import { useFile } from "./useFile";

export function useKeyboardShortcuts() {
  const activeFilePath = useAtomValue(activeFilePathAtom);
  const setSearchPanelOpen = useSetAtom(isSearchPanelOpenAtom);
  const { saveFile } = useFile();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey;

      if (isMod && e.key === "s") {
        e.preventDefault();
        if (activeFilePath) {
          saveFile(activeFilePath);
        }
      }

      if (isMod && e.shiftKey && e.key === "f") {
        e.preventDefault();
        setSearchPanelOpen((prev) => !prev);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeFilePath, saveFile, setSearchPanelOpen]);
}
