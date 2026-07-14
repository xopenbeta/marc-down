import { useAtom, useAtomValue } from "jotai";
import { X } from "lucide-react";
import { openFilesAtom, activeFilePathAtom, settingsAtom } from "@/atoms";
import { useFile } from "@/hooks/useFile";

export function EditorTabs() {
  const openFiles = useAtomValue(openFilesAtom);
  const [activeFilePath, setActiveFilePath] = useAtom(activeFilePathAtom);
  const settings = useAtomValue(settingsAtom);
  const { closeFile } = useFile();

  if (openFiles.length <= 1) return null;

  return (
    <div
      style={{
        display: "flex",
        background: "var(--bg-primary)",
        overflow: "auto",
        borderBottom: "1px solid var(--bg-surface)",
        padding: "0 36px",
      }}
    >
      {openFiles.map((file) => (
        <div
          key={file.path}
          onClick={() => setActiveFilePath(file.path)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "6px 6px 6px 12px",
            fontSize: 12,
            cursor: "pointer",
            color:
              file.path === activeFilePath
                ? "var(--text-primary)"
                : "var(--text-muted)",
            fontWeight: file.path === activeFilePath ? 500 : 400,
            // border: '1px solid red',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "var(--bg-hover)";
            const btn = e.currentTarget.querySelector<HTMLElement>(".tab-close");
            if (btn) btn.style.opacity = "1";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
            const btn = e.currentTarget.querySelector<HTMLElement>(".tab-close");
            if (btn) btn.style.opacity = "0";
          }}
        >
          <span>
            {file.content !== file.savedContent && settings.saveMode === "manual" && (
              <span style={{ color: "var(--text-secondary)", marginRight: 2 }}>
                *
              </span>
            )}
            {file.name}
          </span>
          <button
            className="tab-close"
            onClick={(e) => {
              e.stopPropagation();
              closeFile(file.path);
            }}
            style={{
              padding: 2,
              borderRadius: 4,
              display: "flex",
              alignItems: "center",
              opacity: file.path === activeFilePath ? 1 : 0,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--bg-hover)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
            }}
          >
            <X size={12} />
          </button>
        </div>
      ))}
    </div>
  );
}
