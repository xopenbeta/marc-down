import { useSetAtom, useAtomValue } from "jotai";
import { Search, X } from "lucide-react";
import { isSearchPanelOpenAtom, searchResultsAtom } from "@/atoms";
import { useSearch } from "@/hooks/useSearch";
import { SearchResults } from "./SearchResults";

export function SearchPanel() {
  const setSearchPanelOpen = useSetAtom(isSearchPanelOpenAtom);
  const results = useAtomValue(searchResultsAtom);
  const { query, setQuery, performSearch, isSearching } = useSearch();

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
      <div
        style={{
          padding: "8px 12px",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <Search size={14} color="var(--text-muted)" />
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") performSearch();
            if (e.key === "Escape") setSearchPanelOpen(false);
          }}
          placeholder="Search in files..."
          style={{
            flex: 1,
            padding: "4px 8px",
            borderRadius: 4,
            fontSize: 13,
            background: "var(--bg-surface)",
          }}
        />
        <button
          onClick={() => setSearchPanelOpen(false)}
          style={{ padding: 4, borderRadius: 4 }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.background = "var(--bg-hover)")
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.background = "transparent")
          }
        >
          <X size={14} />
        </button>
      </div>

      <div style={{ flex: 1, overflow: "auto" }}>
        {isSearching ? (
          <div
            style={{
              padding: 20,
              textAlign: "center",
              color: "var(--text-muted)",
              fontSize: 12,
            }}
          >
            Searching...
          </div>
        ) : results.length > 0 ? (
          <SearchResults />
        ) : query ? (
          <div
            style={{
              padding: 20,
              textAlign: "center",
              color: "var(--text-muted)",
              fontSize: 12,
            }}
          >
            No results
          </div>
        ) : null}
      </div>
    </div>
  );
}
