import { useRef, useEffect, useCallback, useState } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { ChevronRight, FileInput, FilePlus, FileText, X } from "lucide-react";
import {
  activeFileAtom,
  isSidebarCollapsedAtom,
  isOutlineCollapsedAtom,
  outlineWidthAtom,
  settingsAtom,
} from "@/atoms";
import * as tauriFs from "@/utils/tauriFs";
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
import { useFileHistory } from "@/hooks/useFileHistory";

export function Editor() {
  const activeFile = useAtomValue(activeFileAtom);
  const sidebarCollapsed = useAtomValue(isSidebarCollapsedAtom);
  const outlineCollapsed = useAtomValue(isOutlineCollapsedAtom);
  const outlineWidth = useAtomValue(outlineWidthAtom);
  const setSidebarCollapsed = useSetAtom(isSidebarCollapsedAtom);
  const setOutlineCollapsed = useSetAtom(isOutlineCollapsedAtom);
  const { handleOutlineResize } = usePanelLayout();
  const { updateFileContent, openFileDialog, openFile, createFile, workspacePath, openFolderPath } = useFile();
  const { fileHistory, removeFile } = useFileHistory();
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<EditorCore | null>(null);
  const { padding } = useEditorPadding(editorRef);
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

  const handleCreateNewFile = useCallback(async () => {
    let dir = workspacePath;
    if (!dir) {
      const selected = await tauriFs.openWorkspaceDialog();
      if (!selected) return;
      dir = selected;
      await openFolderPath(selected);
    }

    const input = window.prompt("Create new file", "untitled.md");
    const rawName = input?.trim();
    if (!rawName) return;

    const name = rawName.endsWith(".md") || rawName.endsWith(".markdown")
      ? rawName
      : `${rawName}.md`;

    const fullPath = `${dir}/${name}`;
    await createFile(dir, name);
    await openFile(fullPath, name);
  }, [createFile, openFile, openFolderPath, workspacePath]);

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
          width: 24,
          height: 24,
          margin: 2,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--text-muted)",
          opacity: 0.9,
          transition: "opacity 0.15s, color 0.15s, transform 0.2s, background 0.15s",
          zIndex: 10,
          borderRadius: 8,
          border: "none",
          background: "transparent",
          cursor: "pointer",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.opacity = "1";
          e.currentTarget.style.color = "var(--text-primary)";
        e.currentTarget.style.background = "var(--bg-hover)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.opacity = "0.9";
          e.currentTarget.style.color = "var(--text-muted)";
        e.currentTarget.style.background = "transparent";
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
          width: 24,
          height: 24,
          margin: 2,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--text-muted)",
          opacity: 0.9,
          transition: "opacity 0.15s, color 0.15s, transform 0.2s, background 0.15s",
          zIndex: 10,
          borderRadius: 8,
          border: "none",
          background: "transparent",
          cursor: "pointer",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.opacity = "1";
          e.currentTarget.style.color = "var(--text-primary)";
        e.currentTarget.style.background = "var(--bg-hover)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.opacity = "0.9";
          e.currentTarget.style.color = "var(--text-muted)";
        e.currentTarget.style.background = "transparent";
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
            gap: 24,
            color: "var(--text-secondary)",
            overflow: "auto",
            padding: "40px 20px",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, width: "100%", maxWidth: 360 }}>
            <div style={{ width: "100%" }}>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4, paddingLeft: 2 }}>
                Operations
              </div>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <HistoryRow
                  icon={<FileInput size={13} />}
                  name="Open File"
                  path="Open a markdown file from disk"
                  onClick={openFileDialog}
                />
                <HistoryRow
                  icon={<FilePlus size={13} />}
                  name="Create New File"
                  path="Create a new markdown file in the workspace"
                  onClick={handleCreateNewFile}
                />
              </div>
            </div>
            {fileHistory.length > 0 && (
              <div style={{ width: "100%" }}>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4, paddingLeft: 2 }}>
                  Recent files
                </div>
                {fileHistory.map((item) => (
                  <HistoryRow
                    key={item.path}
                    icon={<FileText size={13} />}
                    name={item.name}
                    path={item.path}
                    onClick={() => openFile(item.path, item.name)}
                    onRemove={() => removeFile(item.path)}
                  />
                ))}
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  );
}

function HistoryRow({
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
