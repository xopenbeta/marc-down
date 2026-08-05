import { useState, useMemo, useCallback } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import {
  ChevronsDownUp,
  ChevronsUpDown,
  Download,
  FolderOpen,
  Settings,
} from "lucide-react";
import { activeFileAtom, outlineAtom, showExportDialogAtom } from "@/atoms";
import { useFile } from "@/hooks/useFile";
import { OutlineItem } from "./OutlineItem";
import { SettingsDialog } from "../Settings/SettingsDialog";
import type { HeadingItem } from "@/types";

interface OutlineProps {
  onFoldAll?: (action: "fold" | "unfold") => void;
}

export function Outline({ onFoldAll }: OutlineProps) {
  const activeFile = useAtomValue(activeFileAtom);
  const headings = useAtomValue(outlineAtom);
  const setShowExport = useSetAtom(showExportDialogAtom);
  const { openPath } = useFile();
  const [collapsedItems, setCollapsedItems] = useState<Set<number>>(
    new Set()
  );
  const [blocksFolded, setBlocksFolded] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const toggleItem = (paragraph: number) => {
    setCollapsedItems((prev) => {
      const next = new Set(prev);
      if (next.has(paragraph)) {
        next.delete(paragraph);
      } else {
        next.add(paragraph);
      }
      return next;
    });
  };

  const toggleFoldAllBlocks = useCallback(() => {
    const action = blocksFolded ? "unfold" : "fold";
    onFoldAll?.(action);
    setBlocksFolded(!blocksFolded);
  }, [blocksFolded, onFoldAll]);

  const visibleHeadings = useMemo(() => {
    const result: HeadingItem[] = [];
    let skipBelow = Infinity;

    for (const heading of headings) {
      if (heading.level > skipBelow) {
        continue;
      }
      skipBelow = Infinity;
      result.push(heading);
      if (collapsedItems.has(heading.paragraph)) {
        skipBelow = heading.level;
      }
    }
    return result;
  }, [headings, collapsedItems]);

  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: "transparent",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0px 8px 0",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <OutlineIconButton onClick={openPath} title="打开">
            <FolderOpen size={14} />
          </OutlineIconButton>
          <OutlineIconButton onClick={() => setShowSettings(true)} title="设置">
            <Settings size={14} />
          </OutlineIconButton>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <OutlineIconButton
            onClick={toggleFoldAllBlocks}
            title={blocksFolded ? "展开所有源码块" : "折叠所有源码块"}
          >
            {blocksFolded ? (
              <ChevronsUpDown size={14} />
            ) : (
              <ChevronsDownUp size={14} />
            )}
          </OutlineIconButton>
          <OutlineIconButton onClick={() => setShowExport(true)} title="导出">
            <Download size={14} />
          </OutlineIconButton>
        </div>
      </div>
      <div style={{ flex: 1, overflow: "auto", paddingTop: 8 }}>
        {visibleHeadings.length > 0 ? (
          visibleHeadings.map((heading, idx) => (
            <OutlineItem
              key={`${heading.paragraph}-${idx}`}
              heading={heading}
              isCollapsed={collapsedItems.has(heading.paragraph)}
              onToggleCollapse={toggleItem}
            />
          ))
        ) : (
          <div
            style={{
              padding: "40px 20px",
              textAlign: "center",
              color: "var(--text-muted)",
              fontSize: 12,
            }}
          >
            No headings
          </div>
        )}
      </div>
      {activeFile && (
        <div
          style={{
            padding: "8px 12px",
            borderTop: "1px solid var(--bg-hover)",
            color: "var(--text-muted)",
            fontSize: 11,
            display: "flex",
            flexWrap: "wrap",
            gap: "4px 12px",
          }}
        >
          <span>{activeFile.content.replace(/\s/g, "").length} 字</span>
          <span>{activeFile.content.split("\n").length} 行</span>
        </div>
      )}
      {showSettings && (
        <SettingsDialog onClose={() => setShowSettings(false)} />
      )}
    </div>
  );
}

function OutlineIconButton({
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
