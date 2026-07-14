import { useEffect, useState } from "react";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { useFile } from "./useFile";

export function useDropFile() {
  const { openFile } = useFile();
  const [isDragOver, setIsDragOver] = useState(false);

  useEffect(() => {
    const unlistenPromise = getCurrentWebview().onDragDropEvent((event) => {
      const { type } = event.payload;
      if (type === "enter" || type === "over") {
        setIsDragOver(true);
      } else if (type === "leave") {
        setIsDragOver(false);
      } else if (type === "drop") {
        setIsDragOver(false);
        const paths = event.payload.paths.filter((p) =>
          p.toLowerCase().endsWith(".md")
        );
        for (const path of paths) {
          openFile(path);
        }
      }
    });
    return () => {
      unlistenPromise.then((fn) => fn());
    };
  }, [openFile]);

  return { isDragOver };
}
