import { useRef, useEffect } from "react";
import { useAtomValue } from "jotai";
import { ChevronDown, ChevronRight, File } from "lucide-react";
import { activeFilePathAtom } from "@/atoms";
import { useFile } from "@/hooks/useFile";
import type { FileNode } from "@/types";

interface FileTreeNodeProps {
  node: FileNode;
  level: number;
  isCollapsed: boolean;
  isRenaming?: boolean;
  onToggleCollapse: (path: string) => void;
  onContextMenu: (node: FileNode, x: number, y: number) => void;
  onFinishRename: () => void;
}

export function FileTreeNode({
  node,
  level,
  isCollapsed,
  isRenaming = false,
  onToggleCollapse,
  onContextMenu,
  onFinishRename,
}: FileTreeNodeProps) {
  const activeFilePath = useAtomValue(activeFilePathAtom);
  const { openFile, renameEntry } = useFile();
  const inputRef = useRef<HTMLInputElement>(null);

  const isActive = !node.is_directory && node.path === activeFilePath;
  const isExpanded = node.is_directory && !isCollapsed;

  useEffect(() => {
    if (isRenaming && inputRef.current) {
      inputRef.current.focus();
      // select the name without extension
      const dotIndex = node.name.lastIndexOf(".");
      const selectEnd = dotIndex > 0 ? dotIndex : node.name.length;
      inputRef.current.setSelectionRange(0, selectEnd);
    }
  }, [isRenaming, node.name]);

  const handleClick = () => {
    if (isRenaming) return;
    if (node.is_directory) {
      onToggleCollapse(node.path);
    } else {
      openFile(node.path, node.name);
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    onContextMenu(node, e.clientX, e.clientY);
  };

  const handleRenameConfirm = async () => {
    const newName = inputRef.current?.value.trim();
    if (newName && newName !== node.name) {
      await renameEntry(node.path, newName);
    }
    onFinishRename();
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleRenameConfirm();
    } else if (e.key === "Escape") {
      onFinishRename();
    }
  };

  return (
    <>
      <div
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        style={{
          display: "flex",
          alignItems: "center",
          padding: "4px 8px",
          paddingLeft: level * 16,
          cursor: isRenaming ? "default" : "pointer",
          color: isActive ? "var(--text-primary)" : "var(--text-secondary)",
          fontSize: 13,
          userSelect: "none",
          position: "relative",
          overflow: "hidden",
          transition: "background-color 0.12s ease",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "var(--file-tree-hover-bg)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "transparent";
        }}
      >
        {node.is_directory ? (
          <span style={{ display: "flex", alignItems: "center", width: 14, marginRight: 4, flexShrink: 0 }}>
            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </span>
        ) : (
          <span style={{ display: "flex", alignItems: "center", width: 14, marginRight: 4, flexShrink: 0 }}>
            <File size={14} />
          </span>
        )}

        {isRenaming ? (
          <input
            ref={inputRef}
            defaultValue={node.name}
            onKeyDown={handleRenameKeyDown}
            onBlur={handleRenameConfirm}
            onClick={(e) => e.stopPropagation()}
            style={{
              flex: 1,
              minWidth: 0,
              padding: "0 4px",
              margin: 0,
              border: "1px solid var(--accent)",
              borderRadius: 3,
              background: "var(--bg-primary)",
              fontSize: 13,
              fontFamily: "inherit",
              lineHeight: "inherit",
              color: "var(--text-primary)",
              outline: "none",
              boxSizing: "border-box",
            }}
          />
        ) : (
          <span
            style={{
              flex: 1,
              overflow: "hidden",
              whiteSpace: "nowrap",
              fontWeight: isActive ? 500 : 400,
              maskImage: "linear-gradient(to right, black 70%, transparent 100%)",
              WebkitMaskImage: "linear-gradient(to right, black 70%, transparent 100%)",
            }}
          >
            {node.name}
          </span>
        )}
      </div>

    </>
  );
}
