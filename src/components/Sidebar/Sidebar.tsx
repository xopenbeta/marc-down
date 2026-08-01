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
        background: "var(--bg-surface)",
      }}
    >
      <div
        style={{
          padding: "0px 4px",
          display: "flex",
          alignItems: "center",
          background: "transparent",
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
  const [isHovered, setIsHovered] = useState(false);
  const [isPressed, setIsPressed] = useState(false);
  const isActive = isHovered || isPressed;

  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        width: 28,
        height: 28,
        borderRadius: "50%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: isActive ? "var(--text-primary)" : "var(--text-muted)",
        background: isActive ? "var(--bg-hover)" : "transparent",
        boxShadow: isActive ? "inset 0 0 0 1px rgba(0, 0, 0, 0.08)" : "none",
        border: "none",
        padding: 0,
        cursor: "pointer",
        transition: "background-color 0.15s, color 0.15s, box-shadow 0.15s",
        opacity: 1,
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        setIsPressed(false);
      }}
      onMouseDown={() => setIsPressed(true)}
      onMouseUp={() => setIsPressed(false)}
      onBlur={() => {
        setIsHovered(false);
        setIsPressed(false);
      }}
    >
      {children}
    </button>
  );
}
