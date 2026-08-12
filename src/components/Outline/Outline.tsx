import { useState, useMemo, useCallback } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import {
  ChevronsDownUp,
  ChevronsUpDown,
  Download,
  ListTree,
  Settings,
} from "lucide-react";
import { activeFileAtom, outlineAtom, showExportDialogAtom } from "@/atoms";
import { OutlineItem } from "./OutlineItem";
import { SettingsList } from "../Settings/SettingsList";
import type { HeadingItem } from "@/types";

interface OutlineProps {
  onFoldAll?: (action: "fold" | "unfold") => void;
}

export function Outline({ onFoldAll }: OutlineProps) {
  const activeFile = useAtomValue(activeFileAtom);
  const headings = useAtomValue(outlineAtom);
  const setShowExport = useSetAtom(showExportDialogAtom);
  const [collapsedItems, setCollapsedItems] = useState<Set<number>>(
    new Set()
  );
  const [blocksFolded, setBlocksFolded] = useState(false);
  const [panelView, setPanelView] = useState<"outline" | "settings">("outline");

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
          padding: "0px 4px 0",
        }}
      >
        {panelView === "outline" && (
          <div style={{ display: "flex", alignItems: "center" }}>
            <OutlineIconButton
              onClick={toggleFoldAllBlocks}
              title={blocksFolded ? "展开所有源码块" : "折叠所有源码块"}
              active={blocksFolded}
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
        )}
        <div style={{ display: "flex", alignItems: "center" }}>
          <OutlineIconButton
            onClick={() => setPanelView("outline")}
            title="大纲"
            active={panelView === "outline"}
          >
            <ListTree size={14} />
          </OutlineIconButton>
          <OutlineIconButton
            onClick={() => setPanelView("settings")}
            title="设置"
            active={panelView === "settings"}
          >
            <Settings size={14} />
          </OutlineIconButton>
        </div>
      </div>
      <div style={{ 
            height: "100%",
            overflow: "auto",
            paddingTop: 4,
            borderRadius: 8,
            border: "1px solid var(--bg-hover)",
            background: "var(--bg-panel)",
            boxShadow: "0 1px 2px rgba(0, 0, 0, 0.06)",flex: 1, minHeight: 0 }}>
          {panelView === "outline" ? (
            visibleHeadings.length > 0 ? (
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
            )
          ) : (
            <SettingsList />
          )}
      </div>
      {activeFile && panelView === "outline" && (
        <div
          style={{
            padding: "8px 12px",
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
    </div>
  );
}

function OutlineIconButton({
  onClick,
  title,
  active = false,
  children,
}: {
  onClick: () => void;
  title: string;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        width: 24,
        height: 24,
        margin: 2,
        borderRadius: 8,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: active ? "var(--text-primary)" : "var(--text-muted)",
        opacity: active ? 1 : 0.9,
        background: active ? "var(--bg-hover)" : "transparent",
        transition: "background 0.15s",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.opacity = "1";
        e.currentTarget.style.color = "var(--text-primary)";
        e.currentTarget.style.background = "var(--bg-hover)";
      }}
      onMouseLeave={(e) => {
        if (active) return;
        e.currentTarget.style.opacity = "0.9";
        e.currentTarget.style.color = "var(--text-muted)";
        e.currentTarget.style.background = "transparent";
      }}
    >
      {children}
    </button>
  );
}
