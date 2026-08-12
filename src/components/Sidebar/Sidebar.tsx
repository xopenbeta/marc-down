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
                color: "var(--text-secondary)",
              }}
            >
              <FolderHistoryRow
                icon={<FolderOpen size={13} />}
                name="Open Folder"
                path="Open a folder to get started"
                onClick={openPath}
              />
              {folderHistory.length > 0 && (
                <div style={{ marginTop: 6 }}>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4, paddingLeft: 2 }}>
                    Recent folders
                  </div>
                  {folderHistory.map((item) => (
                    <FolderHistoryRow
                      key={item.path}
                      icon={<FolderOpen size={13} />}
                      name={item.name}
                      path={item.path}
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
  icon,
  name,
  path,
  onClick,
  onRemove,
}: {
  icon: React.ReactNode;
  name: string;
  path: string;
  onClick: () => void;
  onRemove?: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onClick={onClick}
      title={path}
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
        {icon}
      </span>
      <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {name}
      </span>
      {onRemove && hovered && (
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
          <X size={10} />
        </span>
      )}
    </div>
  );
}
