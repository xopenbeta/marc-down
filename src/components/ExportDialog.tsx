import { useAtom, useAtomValue } from "jotai";
import { FileText, FileCode, Globe, Printer, BookOpen } from "lucide-react";
import { showExportDialogAtom, activeFileAtom } from "@/atoms";
import { exportAs } from "@/utils/export";

const FORMATS = [
  { key: "txt" as const, label: "TXT", desc: "Plain text", icon: FileText },
  { key: "md" as const, label: "MD", desc: "Markdown", icon: FileCode },
  { key: "html" as const, label: "HTML", desc: "Web page", icon: Globe },
  { key: "pdf" as const, label: "PDF", desc: "Print / PDF", icon: Printer },
  { key: "epub" as const, label: "EPUB", desc: "E-book", icon: BookOpen },
];

export function ExportDialog() {
  const [show, setShow] = useAtom(showExportDialogAtom);
  const activeFile = useAtomValue(activeFileAtom);

  if (!show || !activeFile) return null;

  const handleExport = async (format: "txt" | "md" | "html" | "pdf" | "epub") => {
    setShow(false);
    await exportAs(format, activeFile.content, activeFile.name);
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 3000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0, 0, 0, 0.3)",
      }}
      onClick={() => setShow(false)}
    >
      <div
        style={{
          background: "var(--bg-primary)",
          borderRadius: 8,
          padding: "24px 28px",
          minWidth: 320,
          boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3
          style={{
            fontSize: 14,
            fontWeight: 600,
            marginBottom: 16,
            color: "var(--text-primary)",
          }}
        >
          Export
        </h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {FORMATS.map((fmt) => (
            <button
              key={fmt.key}
              onClick={() => handleExport(fmt.key)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 12px",
                borderRadius: 6,
                fontSize: 13,
                color: "var(--text-primary)",
                textAlign: "left",
                transition: "background 0.1s",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = "var(--bg-hover)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = "transparent")
              }
            >
              <fmt.icon size={16} style={{ flexShrink: 0, color: "var(--text-secondary)" }} />
              <span style={{ fontWeight: 500, minWidth: 40 }}>{fmt.label}</span>
              <span style={{ color: "var(--text-muted)", fontSize: 12 }}>
                {fmt.desc}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
