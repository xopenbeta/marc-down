import { useState, useCallback, useEffect } from "react";
import type { EditorCore } from "@/components/Editor/core/EditorCore";

export function useEditorSearch(editorRef: React.RefObject<EditorCore | null>) {
  const [searchVisible, setSearchVisible] = useState(false);

  const handleSearchClose = useCallback(() => {
    setSearchVisible(false);
    editorRef.current?.focus();
  }, []);

  const openSearch = useCallback(() => {
    setSearchVisible(true);
  }, []);

  useEffect(() => {
    const handleSearchOpen = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "f") {
        e.preventDefault();
        openSearch();
      }
    };
    window.addEventListener("keydown", handleSearchOpen);
    return () => window.removeEventListener("keydown", handleSearchOpen);
  }, [openSearch]);

  return {
    searchVisible,
    openSearch,
    handleSearchClose,
  };
}
