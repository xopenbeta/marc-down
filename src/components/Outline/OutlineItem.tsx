import { ChevronRight, ChevronDown } from "lucide-react";
import type { HeadingItem } from "@/types";

interface OutlineItemProps {
  heading: HeadingItem;
  isCollapsed: boolean;
  onToggleCollapse: (paragraph: number) => void;
}

export function OutlineItem({
  heading,
  isCollapsed,
  onToggleCollapse,
}: OutlineItemProps) {
  const handleClick = () => {
    window.dispatchEvent(
      new CustomEvent("outline-jump", { detail: { paragraph: heading.paragraph } })
    );
  };

  const handleChevronClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleCollapse(heading.paragraph);
  };

  return (
    <div
      onClick={handleClick}
      style={{
        display: "flex",
        alignItems: "center",
        padding: "4px 8px",
        paddingLeft: (heading.level - 1) * 12 + 8,
        cursor: "pointer",
        fontSize: 13,
        color: "var(--text-secondary)",
        position: "relative",
        overflow: "hidden",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "var(--bg-hover)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
      }}
    >
      <span
        onClick={handleChevronClick}
        style={{ display: "flex", alignItems: "center", flexShrink: 0, marginRight: 4 }}
      >
        {isCollapsed ? (
          <ChevronRight size={14} />
        ) : (
          <ChevronDown size={14} />
        )}
      </span>

      <span
        style={{
          flex: 1,
          overflow: "hidden",
          whiteSpace: "nowrap",
          maskImage: "linear-gradient(to right, black 80%, transparent 100%)",
          WebkitMaskImage: "linear-gradient(to right, black 80%, transparent 100%)",
        }}
      >
        {heading.text}
      </span>
    </div>
  );
}
