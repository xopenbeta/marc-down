import { useState, useRef, useEffect, useCallback } from "react";

interface SearchPanelProps {
  visible: boolean;
  onClose: () => void;
  onSearch: (query: string, options: { caseSensitive: boolean; regex: boolean }) => SearchMatch[];
  onReplace: (from: number, to: number, replacement: string) => void;
  onReplaceAll: (query: string, replacement: string, options: { caseSensitive: boolean; regex: boolean }) => void;
  onNavigate: (match: SearchMatch) => void;
}

export interface SearchMatch {
  from: number;
  to: number;
  paragraphIndex: number;
}

export function SearchPanel({
  visible,
  onClose,
  onSearch,
  onReplace,
  onReplaceAll,
  onNavigate,
}: SearchPanelProps) {
  const [query, setQuery] = useState("");
  const [replacement, setReplacement] = useState("");
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [useRegex, setUseRegex] = useState(false);
  const [matches, setMatches] = useState<SearchMatch[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (visible) {
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [visible]);

  const doSearch = useCallback(
    (q: string) => {
      if (!q.trim()) {
        setMatches([]);
        setCurrentIndex(-1);
        return;
      }
      const results = onSearch(q, { caseSensitive, regex: useRegex });
      setMatches(results);
      setCurrentIndex(results.length > 0 ? 0 : -1);
      if (results.length > 0) onNavigate(results[0]);
    },
    [caseSensitive, useRegex, onSearch, onNavigate],
  );

  useEffect(() => {
    doSearch(query);
  }, [query, caseSensitive, useRegex]);

  const navigateNext = () => {
    if (matches.length === 0) return;
    const next = (currentIndex + 1) % matches.length;
    setCurrentIndex(next);
    onNavigate(matches[next]);
  };

  const navigatePrev = () => {
    if (matches.length === 0) return;
    const prev = (currentIndex - 1 + matches.length) % matches.length;
    setCurrentIndex(prev);
    onNavigate(matches[prev]);
  };

  const handleReplace = () => {
    if (currentIndex < 0 || currentIndex >= matches.length) return;
    const match = matches[currentIndex];
    onReplace(match.from, match.to, replacement);
    doSearch(query);
  };

  const handleReplaceAll = () => {
    if (!query.trim()) return;
    onReplaceAll(query, replacement, { caseSensitive, regex: useRegex });
    doSearch(query);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onClose();
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (e.shiftKey) {
        navigatePrev();
      } else {
        navigateNext();
      }
    }
  };

  if (!visible) return null;

  return (
    <div className="cm-panels cm-panels-top" style={{ borderBottom: "1px solid var(--border-color)" }}>
      <div className="cm-panel cm-search" style={{ padding: "8px 12px", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <input
          ref={inputRef}
          className="cm-textfield"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search..."
          style={{ width: 160 }}
        />
        <input
          className="cm-textfield"
          value={replacement}
          onChange={(e) => setReplacement(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Replace..."
          style={{ width: 160 }}
        />
        <span style={{ fontSize: 12, color: "var(--text-muted)", minWidth: 60 }}>
          {matches.length > 0 ? `${currentIndex + 1}/${matches.length}` : "No results"}
        </span>
        <button className="cm-button" onClick={navigatePrev} title="Previous">↑</button>
        <button className="cm-button" onClick={navigateNext} title="Next">↓</button>
        <button className="cm-button" onClick={handleReplace} title="Replace">Replace</button>
        <button className="cm-button" onClick={handleReplaceAll} title="Replace All">All</button>
        <label style={{ fontSize: 13, color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 4 }}>
          <input type="checkbox" checked={caseSensitive} onChange={(e) => setCaseSensitive(e.target.checked)} />
          Aa
        </label>
        <label style={{ fontSize: 13, color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 4 }}>
          <input type="checkbox" checked={useRegex} onChange={(e) => setUseRegex(e.target.checked)} />
          .*
        </label>
        <button
          className="cm-button"
          onClick={onClose}
          title="Close"
          style={{ marginLeft: "auto" }}
        >
          ✕
        </button>
      </div>
    </div>
  );
}
