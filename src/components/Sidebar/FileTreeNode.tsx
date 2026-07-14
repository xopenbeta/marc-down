import { useAtomValue } from "jotai";
import { ChevronRight, ChevronDown, File, Folder, FolderOpen } from "lucide-react";
import { activeFilePathAtom } from "@/atoms";
import { useFile } from "@/hooks/useFile";
import type { FileNode } from "@/types";

interface FileTreeNodeProps {
  node: FileNode;
  level: number;
  isCollapsed: boolean;
  onToggleCollapse: (path: string) => void;
  onContextMenu: (node: FileNode, x: number, y: number) => void;
}

export function FileTreeNode({
  node,
  level,
  isCollapsed,
  onToggleCollapse,
  onContextMenu,
}: FileTreeNodeProps) {
  const activeFilePath = useAtomValue(activeFilePathAtom);
  const { openFile } = useFile();

  const isActive = !node.is_directory && node.path === activeFilePath;
  const isExpanded = node.is_directory && !isCollapsed;

  const handleClick = () => {
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
          cursor: "pointer",
          color: isActive ? "var(--text-primary)" : "var(--text-secondary)",
          fontSize: 13,
          userSelect: "none",
          position: "relative",
          overflow: "hidden",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "var(--bg-hover)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "transparent";
        }}
      >
        {node.is_directory ? (
          <span style={{ display: "flex", alignItems: "center", marginRight: 4, flexShrink: 0 }}>
            {isExpanded ? (
              <ChevronDown size={14} style={{ marginRight: 2 }} />
            ) : (
              <ChevronRight size={14} style={{ marginRight: 2 }} />
            )}
            {isExpanded ? <FolderOpen size={14} /> : <Folder size={14} />}
          </span>
        ) : (
          <span style={{ display: "flex", alignItems: "center", marginRight: 4, marginLeft: 16, flexShrink: 0 }}>
            <File size={14} />
          </span>
        )}

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
      </div>

    </>
  );
}
