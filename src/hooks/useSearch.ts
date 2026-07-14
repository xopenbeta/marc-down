import { useAtom, useAtomValue, useSetAtom } from "jotai";
import {
  searchQueryAtom,
  searchResultsAtom,
  isSearchingAtom,
  workspacePathAtom,
} from "@/atoms";
import { searchInFiles } from "@/utils/tauriFs";

export function useSearch() {
  const [query, setQuery] = useAtom(searchQueryAtom);
  const setResults = useSetAtom(searchResultsAtom);
  const [isSearching, setIsSearching] = useAtom(isSearchingAtom);
  const workspacePath = useAtomValue(workspacePathAtom);

  const performSearch = async (searchQuery?: string) => {
    const q = searchQuery ?? query;
    if (!q.trim() || !workspacePath) {
      setResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const results = await searchInFiles(workspacePath, q);
      setResults(results);
    } finally {
      setIsSearching(false);
    }
  };

  return { query, setQuery, performSearch, isSearching };
}
