import { useState, useEffect } from "react";
import { useAtomValue } from "jotai";
import { FolderOpen, Settings } from "lucide-react";
import {
  fileTreeAtom,
  isSearchPanelOpenAtom,
} from "@/atoms";
import { useFile } from "@/hooks/useFile";
import { FileTree } from "./FileTree";
import { SearchPanel } from "../Search/SearchPanel";
import { SettingsDialog } from "../Settings/SettingsDialog";

export function Sidebar() {
  const fileTree = useAtomValue(fileTreeAtom);
  const isSearchOpen = useAtomValue(isSearchPanelOpenAtom);
  // const setSearchOpen = useSetAtom(isSearchPanelOpenAtom);
  const { openPath, refreshTree } = useFile();
  const [showSettings, setShowSettings] = useState(false);

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
        background: "var(--bg-primary)",
      }}
    >
      <div
        style={{
          padding: "0px 8px",
          display: "flex",
          alignItems: "center",
          gap: 2,
        }}
      >
        <IconButton onClick={openPath} title="Open">
          <FolderOpen size={16} />
        </IconButton>
        {/* <IconButton
          onClick={() => setSearchOpen((v) => !v)}
          title="Search"
        >
          <Search size={16} />
        </IconButton> */}
        <IconButton onClick={() => setShowSettings(true)} title="Settings">
          <Settings size={16} />
        </IconButton>
      </div>

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
                }}
              >
                Open
              </button>
            </div>
          )}
        </div>
      )}

      {showSettings && (
        <SettingsDialog onClose={() => setShowSettings(false)} />
      )}
    </div>
  );
}

function IconButton({
  onClick,
  title,
  children,
}: {
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        width: 28,
        height: 28,
        borderRadius: 4,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "var(--text-muted)",
        opacity: 0.5,
        transition: "opacity 0.15s, color 0.15s",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.opacity = "1";
        e.currentTarget.style.color = "var(--text-primary)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.opacity = "0.5";
        e.currentTarget.style.color = "var(--text-muted)";
      }}
    >
      {children}
    </button>
  );
}
