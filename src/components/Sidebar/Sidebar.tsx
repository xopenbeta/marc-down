import { useEffect, useState } from "react";
import { useAtomValue } from "jotai";
import { FolderOpen, X } from "lucide-react";
import {
  fileTreeAtom,
  isSearchPanelOpenAtom,
} from "@/atoms";
import { useFile } from "@/hooks/useFile";
import { useFileHistory } from "@/hooks/useFileHistory";
import { FileTree } from "./FileTree";
import { SearchPanel } from "../Search/SearchPanel";

export function Sidebar() {
  const fileTree = useAtomValue(fileTreeAtom);
  const isSearchOpen = useAtomValue(isSearchPanelOpenAtom);
  const { openPath, openFolderPath, refreshTree } = useFile();
  const { folderHistory, removeFolder } = useFileHistory();

  useEffect(() => {
    const handleFocus = () => {
      refreshTree();
    };
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [refreshTree]);

  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: "var(--bg-surface)",
        borderRight: "1px solid var(--border-color)",
        boxShadow: "inset -12px 0 16px -16px rgba(0, 0, 0, 0.1)",
      }}
    >
      {isSearchOpen ? (
        <SearchPanel />
      ) : (
        <div style={{ flex: 1, overflow: "auto" }}>
          {fileTree ? (
            <FileTree node={fileTree} />
          ) : (
            <div
              style={{
                padding: "40px 20px",
                textAlign: "center",
                color: "var(--text-secondary)",
              }}
            >
              <p style={{ fontSize: 12, marginBottom: 12 }}>
                Open a folder to get started
              </p>
              <button
                onClick={openPath}
                style={{
                  padding: "6px 16px",
                  background: "var(--text-primary)",
                  color: "var(--bg-primary)",
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: "pointer",
                  border: "none",
                }}
              >
                Open
              </button>
              {folderHistory.length > 0 && (
                <div style={{ textAlign: "left", marginTop: 20 }}>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4, paddingLeft: 2 }}>
                    Recent folders
                  </div>
                  {folderHistory.map((item) => (
                    <FolderHistoryRow
                      key={item.path}
                      item={item}
                      onClick={() => openFolderPath(item.path)}
                      onRemove={() => removeFolder(item.path)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function FolderHistoryRow({
  item,
  onClick,
  onRemove,
}: {
  item: { path: string; name: string };
  onClick: () => void;
  onRemove: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onClick={onClick}
      title={item.path}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "5px 8px",
        borderRadius: 4,
        cursor: "pointer",
        fontSize: 12,
        color: "var(--text-secondary)",
        background: hovered ? "var(--bg-hover)" : "transparent",
        transition: "background 0.1s",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span style={{ display: "flex", alignItems: "center", flexShrink: 0, color: "var(--text-muted)" }}>
        <FolderOpen size={13} />
      </span>
      <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {item.name}
      </span>
      {hovered && (
        <span
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          title="Remove from history"
          style={{
            display: "flex",
            alignItems: "center",
            flexShrink: 0,
            padding: 2,
            borderRadius: 3,
            color: "var(--text-muted)",
            cursor: "pointer",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "var(--bg-hover)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
          }}
        >
          <X size={12} />
        </span>
      )}
    </div>
  );
}
