import { useState } from "react";
import { X } from "lucide-react";

const STORAGE_KEY = "marc-down-default-app-dismissed";

export function DefaultAppToast() {
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem(STORAGE_KEY) === "1"
  );

  if (dismissed) return null;

  const handleDismiss = () => {
    localStorage.setItem(STORAGE_KEY, "1");
    setDismissed(true);
  };

  return (
    <div
      style={{
        position: "absolute",
        bottom: 12,
        right: 12,
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 10px",
        background: "var(--bg-primary)",
        border: "1px solid #e8e8e8",
        borderRadius: 6,
        fontSize: 11,
        color: "var(--text-secondary)",
        zIndex: 1000,
        boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
      }}
    >
      <span>设为默认：右键 .md 文件 → 打开方式 → 始终使用 MarcDown 打开</span>
      <button
        onClick={handleDismiss}
        title="不再显示"
        style={{
          display: "flex",
          alignItems: "center",
          padding: 2,
          borderRadius: 3,
          color: "var(--text-muted)",
          flexShrink: 0,
        }}
        onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-primary)")}
        onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
      >
        <X size={12} />
      </button>
    </div>
  );
}
