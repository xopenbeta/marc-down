import { useCallback } from "react";
import { useAtom } from "jotai";
import {
  sidebarWidthAtom,
  outlineWidthAtom,
  isSidebarCollapsedAtom,
  isOutlineCollapsedAtom,
} from "@/atoms";

const MIN_SIDEBAR_WIDTH = 80;
const COLLAPSE_THRESHOLD = 40;
const DEFAULT_SIDEBAR_WIDTH = 150;
const MIN_OUTLINE_WIDTH = 80;
const OUTLINE_COLLAPSE_THRESHOLD = 40;
const DEFAULT_OUTLINE_WIDTH = 150;

export function usePanelLayout() {
  const [sidebarWidth, setSidebarWidth] = useAtom(sidebarWidthAtom);
  const [outlineWidth, setOutlineWidth] = useAtom(outlineWidthAtom);
  const [sidebarCollapsed, setSidebarCollapsed] = useAtom(
    isSidebarCollapsedAtom
  );
  const [outlineCollapsed, setOutlineCollapsed] = useAtom(
    isOutlineCollapsedAtom
  );

  const handleSidebarResize = useCallback(
    (delta: number) => {
      setSidebarWidth((prev) => {
        const next = prev + delta;
        if (next < COLLAPSE_THRESHOLD) {
          setSidebarCollapsed(true);
          return DEFAULT_SIDEBAR_WIDTH;
        }
        return Math.max(next, MIN_SIDEBAR_WIDTH);
      });
    },
    [setSidebarWidth, setSidebarCollapsed]
  );

  const handleOutlineResize = useCallback(
    (delta: number) => {
      setOutlineWidth((prev) => {
        const next = prev - delta;
        if (next < OUTLINE_COLLAPSE_THRESHOLD) {
          setOutlineCollapsed(true);
          return DEFAULT_OUTLINE_WIDTH;
        }
        return Math.max(next, MIN_OUTLINE_WIDTH);
      });
    },
    [setOutlineWidth, setOutlineCollapsed]
  );

  return {
    sidebarWidth,
    outlineWidth,
    sidebarCollapsed,
    outlineCollapsed,
    handleSidebarResize,
    handleOutlineResize,
  };
}
