import { useEffect } from "react";
import { useSetAtom } from "jotai";
import { Menu } from "@tauri-apps/api/menu";
import { LogicalPosition } from "@tauri-apps/api/dpi";
import { showExportDialogAtom } from "@/atoms";

export function useEditorContextMenu() {
  const setShowExport = useSetAtom(showExportDialogAtom);

  useEffect(() => {
    const handleEditorContextMenu = async (e: Event) => {
      const { x, y } = (e as CustomEvent).detail;
      const menu = await Menu.new({
        items: [
          { item: "Cut", text: "Cut" },
          { item: "Copy", text: "Copy" },
          { item: "Paste", text: "Paste" },
          { item: "SelectAll", text: "Select All" },
          { item: "Separator" },
          { id: "export", text: "Export", action: () => setShowExport(true) },
        ],
      });
      await menu.popup(new LogicalPosition(x, y));
    };
    window.addEventListener("editor-contextmenu", handleEditorContextMenu);
    return () => window.removeEventListener("editor-contextmenu", handleEditorContextMenu);
  }, [setShowExport]);
}
