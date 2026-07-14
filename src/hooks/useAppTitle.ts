import { useEffect } from "react";
import { useAtomValue } from "jotai";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { activeFileAtom, settingsAtom } from "@/atoms";

export function useAppTitle() {
  const activeFile = useAtomValue(activeFileAtom);
  const settings = useAtomValue(settingsAtom);

  const showDirtyMark = settings.saveMode === "manual" && activeFile != null && activeFile.content !== activeFile.savedContent;

  useEffect(() => {
    const dirtyPrefix = showDirtyMark ? "* " : "";
    const title = activeFile
      ? `MarcDown - ${dirtyPrefix}${activeFile.name}`
      : "MarcDown";
    getCurrentWindow().setTitle(title);
  }, [activeFile?.name, showDirtyMark]);
}
