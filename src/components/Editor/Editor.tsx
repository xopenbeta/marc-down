import { useRef, useEffect, useCallback } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { ChevronRight } from "lucide-react";
import {
  activeFileAtom,
  isSidebarCollapsedAtom,
  isOutlineCollapsedAtom,
  outlineWidthAtom,
  settingsAtom,
} from "@/atoms";
import { editorViewStateCache } from "@/atoms/editorAtom";
import { EditorCore } from "./core/EditorCore";
import { SearchMatch, SearchPanel } from "./core/SearchPanel";
import { EditorTabs } from "./EditorTabs";
import { Outline } from "../Outline/Outline";
import { PanelResizer } from "../PanelResizer/PanelResizer";
import { useFile } from "@/hooks/useFile";
import { useFileConflict } from "@/hooks/useFileConflict";
import { useDropFile } from "@/hooks/useDropFile";
import { useEditorContextMenu } from "@/hooks/useEditorContextMenu";
import { useAppTitle } from "@/hooks/useAppTitle";
import { usePanelLayout } from "@/hooks/usePanelLayout";
import { useEditorSearch } from "@/hooks/useEditorSearch";
import { useEditorPadding } from "@/hooks/useEditorPadding";

export function Editor() {
  const activeFile = useAtomValue(activeFileAtom);
  const sidebarCollapsed = useAtomValue(isSidebarCollapsedAtom);
  const outlineCollapsed = useAtomValue(isOutlineCollapsedAtom);
  const outlineWidth = useAtomValue(outlineWidthAtom);
  const setSidebarCollapsed = useSetAtom(isSidebarCollapsedAtom);
  const setOutlineCollapsed = useSetAtom(isOutlineCollapsedAtom);
  const { handleOutlineResize } = usePanelLayout();
  const { updateFileContent, openPath } = useFile();
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<EditorCore | null>(null);
  const { padding, edgeSize } = useEditorPadding(editorRef);
  const {
    searchVisible,
    handleSearchClose,
  } = useEditorSearch(editorRef);

  useFileConflict();
  useEditorContextMenu();
  useAppTitle();
  const { isDragOver } = useDropFile();

  const activeFilePath = activeFile?.path ?? null;
  const activeFileContent = activeFile?.content ?? "";
  const settings = useAtomValue(settingsAtom);

  useEffect(() => {
    if (!containerRef.current || !activeFilePath) return;

    const editor = new EditorCore(containerRef.current, {
      content: activeFileContent,
      fileKey: activeFilePath,
      onContentChange: (c) => updateFileContent(activeFilePath, c),
      style: padding,
    });

    editor.setShowSpaceDots(settings.showSpaceDots);
    editor.setDebugTopLabels(settings.debugTopLabels);
    editor.setDebugHeightPanel(settings.debugHeightPanel);
    editor.setDebugBackground(settings.debugBackground);
    editor.setDebugUnderline(settings.debugUnderline);
    editor.setDebugGlyphOverlay(settings.debugGlyphOverlay);

    if (activeFilePath) {
      const cached = editorViewStateCache.get(activeFilePath);
      if (cached) {
        editor.restoreEditorInstanceState(cached);
      }
    }

    editorRef.current = editor;

    return () => {
      editorViewStateCache.set(activeFilePath, editor.getEditorInstanceState());
      editor.destroy();
      editorRef.current = null;
    };
  }, [containerRef, activeFilePath]);

  const scrollToBlock = useCallback((blockId: number) => {
    editorRef.current?.scrollToBlock(blockId);
  }, []);

  useEffect(() => {
    const handleJump = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.paragraph) {
        scrollToBlock(detail.paragraph);
      }
    };
    window.addEventListener("outline-jump", handleJump);
    return () => window.removeEventListener("outline-jump", handleJump);
  }, [scrollToBlock]);

  useEffect(() => {
    editorRef.current?.setShowSpaceDots(settings.showSpaceDots);
    editorRef.current?.setDebugTopLabels(settings.debugTopLabels);
    editorRef.current?.setDebugHeightPanel(settings.debugHeightPanel);
    editorRef.current?.setDebugBackground(settings.debugBackground);
    editorRef.current?.setDebugUnderline(settings.debugUnderline);
    editorRef.current?.setDebugGlyphOverlay(settings.debugGlyphOverlay);
  }, [settings.showSpaceDots, settings.debugTopLabels, settings.debugHeightPanel, settings.debugBackground, settings.debugUnderline, settings.debugGlyphOverlay]);

  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        position: "relative",
        outline: isDragOver ? "2px dashed var(--text-muted)" : "none",
        outlineOffset: "-2px",
        borderRadius: 4,
      }}
    >
      {/* 左上角：展开/折叠 sidebar */}
      <button
        onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
        title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        style={{
          position: "absolute",
          top: 0,
          left: sidebarCollapsed ? 1 : -2,
          width: edgeSize,
          height: edgeSize,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--text-muted)",
          opacity: 0.5,
          transition: "opacity 0.15s, color 0.15s, transform 0.2s",
          zIndex: 10,
          borderRadius: 4,
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
        <ChevronRight size={16} style={{ transform: `rotate(${sidebarCollapsed ? 45 : 180}deg)` }} />
      </button>

      {/* 右上角：展开/折叠 outline */}
      <button
        onClick={() => setOutlineCollapsed(!outlineCollapsed)}
        title={outlineCollapsed ? "Expand outline" : "Collapse outline"}
        style={{
          position: "absolute",
          top: 0,
          right: outlineCollapsed ? 1 : outlineWidth - 2,
          width: edgeSize,
          height: edgeSize,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--text-muted)",
          opacity: 0.5,
          transition: "opacity 0.15s, color 0.15s, transform 0.2s",
          zIndex: 10,
          borderRadius: 4,
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
        <ChevronRight size={16} style={{ transform: `rotate(${outlineCollapsed ? 135 : 0}deg)` }} />
      </button>

      <EditorTabs />
      <SearchPanel
        visible={searchVisible}
        onClose={handleSearchClose}
        onSearch={(query: string, opts: { caseSensitive: boolean; regex: boolean }): SearchMatch[] => {
          return editorRef.current?.search(query, opts) ?? [];
        }}
        onReplace={(from: number, to: number, replacement: string) => {
          editorRef.current?.replaceMatch(from, to, replacement);
        }}
        onReplaceAll={(query: string, replacement: string, opts: { caseSensitive: boolean; regex: boolean }) => {
          editorRef.current?.replaceAll(query, replacement, opts);
        }}
        onNavigate={(match: SearchMatch) => {
          editorRef.current?.navigateToMatch(match);
        }}
      />
      {activeFile ? (
        <div style={{ flex: 1, overflow: "hidden", position: "relative" }}>
          <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
          {!outlineCollapsed && (
            <div
              style={{
                position: "absolute",
                top: 0,
                right: 6,
                bottom: 0,
                width: outlineWidth,
                overflow: "hidden",
                display: "flex",
              }}
            >
              <PanelResizer onResize={handleOutlineResize} />
              <div style={{ flex: 1, overflow: "hidden" }}>
                <Outline onFoldAll={(action: "fold" | "unfold") => {
                  if (action === "fold") {
                    editorRef.current?.foldAll();
                  } else {
                    editorRef.current?.unfoldAll();
                  }
                }} />
              </div>
            </div>
          )}
        </div>
      ) : (
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "column",
            gap: 12,
            color: "var(--text-secondary)",
          }}
        >
          <p style={{ fontSize: 13 }}>Open a folder or file to start editing</p>
          <button
            onClick={openPath}
            style={{
              padding: "5px 16px",
              background: "var(--text-primary)",
              color: "var(--bg-primary)",
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 500,
            }}
          >
            Open...
          </button>
        </div>
      )}
    </div>
  );
}
