import { useEffect, useRef } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { activeFileAtom, outlineAtom } from "@/atoms";
import { extractHeadings } from "@/utils/markdownParser";

export function useOutline() {
  const activeFile = useAtomValue(activeFileAtom);
  const setOutline = useSetAtom(outlineAtom);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    if (!activeFile) {
      setOutline([]);
      return;
    }

    timerRef.current = setTimeout(() => {
      const headings = extractHeadings(activeFile.content);
      setOutline(headings);
    }, 300);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [activeFile?.content, setOutline]);
}
