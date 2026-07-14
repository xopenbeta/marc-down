import { useEffect, useMemo } from "react";
import { useAtomValue } from "jotai";
import { isOutlineCollapsedAtom, outlineWidthAtom } from "@/atoms";
import type { EditorCore } from "@/components/Editor/core/EditorCore";

const EDITOR_EDGE_PADDING = 28;

export function useEditorPadding(editorRef: React.RefObject<EditorCore | null>) {
  const outlineCollapsed = useAtomValue(isOutlineCollapsedAtom);
  const outlineWidth = useAtomValue(outlineWidthAtom);

  const padding = useMemo(() => ({
    paddingLeft: EDITOR_EDGE_PADDING,
    paddingRight: (outlineCollapsed ? 0 : outlineWidth + 6) + EDITOR_EDGE_PADDING,
    paddingTop: EDITOR_EDGE_PADDING,
    paddingBottom: EDITOR_EDGE_PADDING,
  }), [outlineCollapsed, outlineWidth]);

  useEffect(() => {
    editorRef.current?.setPadding(padding.paddingLeft, padding.paddingRight, padding.paddingTop, padding.paddingBottom);
  }, [padding]);

  return { padding, edgeSize: EDITOR_EDGE_PADDING };
}
