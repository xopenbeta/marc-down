import { useAtom } from "jotai";
import { openFilesAtom, fileConflictAtom } from "@/atoms";

export function ConflictDialog() {
  const [conflict, setConflict] = useAtom(fileConflictAtom);
  const [, setOpenFiles] = useAtom(openFilesAtom);

  if (!conflict) return null;

  const keepLocal = () => {
    setOpenFiles((prev) =>
      prev.map((f) =>
        f.path === conflict.path
          ? { ...f, savedContent: conflict.diskContent }
          : f
      )
    );
    setConflict(null);
  };

  const useDisk = () => {
    setOpenFiles((prev) =>
      prev.map((f) =>
        f.path === conflict.path
          ? {
              ...f,
              content: conflict.diskContent,
              savedContent: conflict.diskContent,
            }
          : f
      )
    );
    setConflict(null);
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
    >
      <div
        style={{
          background: "var(--bg-primary)",
          borderRadius: 8,
          padding: "24px 28px",
          minWidth: 340,
          boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
          border: "1px solid var(--border-color)",
        }}
      >
        <h3
          style={{
            fontSize: 14,
            fontWeight: 600,
            marginBottom: 12,
            color: "var(--text-primary)",
          }}
        >
          File Changed Externally
        </h3>
        <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 20 }}>
          <strong>{conflict.name}</strong> has been modified outside the editor.
          You also have unsaved changes. Which version do you want to keep?
        </p>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button
            onClick={keepLocal}
            style={{
              padding: "6px 14px",
              borderRadius: 4,
              fontSize: 12,
              fontWeight: 500,
              border: "1px solid var(--border-color)",
              background: "var(--bg-primary)",
              color: "var(--text-primary)",
              cursor: "pointer",
            }}
          >
            Keep Local
          </button>
          <button
            onClick={useDisk}
            style={{
              padding: "6px 14px",
              borderRadius: 4,
              fontSize: 12,
              fontWeight: 500,
              background: "var(--text-primary)",
              color: "var(--bg-primary)",
              cursor: "pointer",
            }}
          >
            Use Disk Version
          </button>
        </div>
      </div>
    </div>
  );
}
