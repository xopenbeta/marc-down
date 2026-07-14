import { useEffect } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { activeFileAtom, fileConflictAtom } from "@/atoms";
import * as tauriFs from "@/utils/tauriFs";

export function useFileConflict() {
  const activeFile = useAtomValue(activeFileAtom);
  const setConflict = useSetAtom(fileConflictAtom);

  const checkActiveFile = async () => {
    if (!activeFile) return;
    try {
      const diskContent = await tauriFs.readFile(activeFile.path);
      if (diskContent !== activeFile.savedContent) {
        setConflict({
          path: activeFile.path,
          name: activeFile.name,
          diskContent,
        });
      }
    } catch {
      // 文件可能被删除，忽略
    }
  };

  useEffect(() => {
    checkActiveFile();
    const handleFocus = () => checkActiveFile();
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [activeFile]);
}
