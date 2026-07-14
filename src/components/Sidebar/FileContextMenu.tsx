import { useEffect, useState } from "react";
import { useSetAtom } from "jotai";
import { FilePlus, FolderPlus, Pencil, Trash2, Download } from "lucide-react";
import { useFile } from "@/hooks/useFile";
import { showExportDialogAtom } from "@/atoms";
import type { FileNode } from "@/types";

interface FileContextMenuProps {
  node?: FileNode;
  dirPath: string;
  x: number;
  y: number;
  onClose: () => void;
}

export function FileContextMenu({
  node,
  dirPath,
  x,
  y,
  onClose,
}: FileContextMenuProps) {
  const [inputMode, setInputMode] = useState<
    "newFile" | "newFolder" | "rename" | null
  >(null);
  const [inputValue, setInputValue] = useState("");
  const { createFile, createFolder, deleteEntry, renameEntry, openFile } =
    useFile();
  const setShowExport = useSetAtom(showExportDialogAtom);

  useEffect(() => {
    const handleClick = () => onClose();
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [onClose]);

  const handleAction = async () => {
    if (!inputValue.trim()) return;
    if (inputMode === "newFile") {
      const name = inputValue.endsWith(".md") ? inputValue : `${inputValue}.md`;
      await createFile(dirPath, name);
    } else if (inputMode === "newFolder") {
      await createFolder(dirPath, inputValue);
    } else if (inputMode === "rename" && node) {
      await renameEntry(node.path, inputValue);
    }
    onClose();
  };

  const handleDelete = async () => {
    if (!node) return;
    if (confirm(`Delete "${node.name}"?`)) {
      await deleteEntry(node.path);
    }
    onClose();
  };

  if (inputMode) {
    return (
      <div
        style={{
          position: "fixed",
          left: x,
          top: y,
          zIndex: 1000,
          background: "var(--bg-primary)",
          border: "1px solid var(--border-color)",
          borderRadius: 6,
          padding: 8,
          boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <input
          autoFocus
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleAction();
            if (e.key === "Escape") onClose();
          }}
          placeholder={
            inputMode === "newFile"
              ? "filename.md"
              : inputMode === "newFolder"
                ? "folder name"
                : "new name"
          }
          style={{
            width: 180,
            padding: "4px 8px",
            borderRadius: 4,
            fontSize: 13,
            border: "1px solid var(--border-color)",
            background: "var(--bg-primary)",
          }}
        />
      </div>
    );
  }

  const menuItems: {
    icon: typeof FilePlus;
    label: string;
    action: () => void;
    danger?: boolean;
  }[] = [
    {
      icon: FilePlus,
      label: "New File",
      action: () => setInputMode("newFile"),
    },
    {
      icon: FolderPlus,
      label: "New Folder",
      action: () => setInputMode("newFolder"),
    },
  ];

  if (node) {
    menuItems.push({
      icon: Pencil,
      label: "Rename",
      action: () => {
        setInputValue(node.name);
        setInputMode("rename");
      },
    });
    if (!node.is_directory && (node.name.endsWith(".md") || node.name.endsWith(".markdown"))) {
      menuItems.push({
        icon: Download,
        label: "Export",
        action: () => {
          openFile(node.path, node.name);
          setShowExport(true);
          onClose();
        },
      });
    }
    menuItems.push({
      icon: Trash2,
      label: "Delete",
      action: handleDelete,
      danger: true,
    });
  }

  return (
    <div
      style={{
        position: "fixed",
        left: x,
        top: y,
        zIndex: 1000,
        background: "var(--bg-primary)",
        border: "1px solid var(--border-color)",
        borderRadius: 6,
        padding: 4,
        minWidth: 140,
        boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {menuItems.map((item) => (
        <button
          key={item.label}
          onClick={item.action}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            width: "100%",
            padding: "6px 10px",
            borderRadius: 4,
            fontSize: 13,
            color: item.danger
              ? "var(--danger)"
              : "var(--text-primary)",
          }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.background = "var(--bg-hover)")
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.background = "transparent")
          }
        >
          <item.icon size={14} />
          {item.label}
        </button>
      ))}
    </div>
  );
}
