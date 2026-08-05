import { useEffect } from "react";
import { useAtomValue } from "jotai";
import {
  fileTreeAtom,
  isSearchPanelOpenAtom,
} from "@/atoms";
import { useFile } from "@/hooks/useFile";
import { FileTree } from "./FileTree";
import { SearchPanel } from "../Search/SearchPanel";

export function Sidebar() {
  const fileTree = useAtomValue(fileTreeAtom);
  const isSearchOpen = useAtomValue(isSearchPanelOpenAtom);
  const { openPath, refreshTree } = useFile();

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
                }}
              >
                Open
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
