import { useAtomValue } from "jotai";
import { searchResultsAtom } from "@/atoms";
import { useFile } from "@/hooks/useFile";

export function SearchResults() {
  const results = useAtomValue(searchResultsAtom);
  const { openFile } = useFile();

  const handleResultClick = async (
    filePath: string,
    fileName: string,
    paragraph: number
  ) => {
    await openFile(filePath, fileName);
    setTimeout(() => {
      window.dispatchEvent(
        new CustomEvent("outline-jump", { detail: { paragraph } })
      );
    }, 100);
  };

  return (
    <div>
      {results.map((result, idx) => (
        <button
          key={`${result.file_path}-${result.line}-${idx}`}
          onClick={() =>
            handleResultClick(result.file_path, result.file_name, result.line)
          }
          style={{
            display: "block",
            width: "100%",
            padding: "5px 12px",
            textAlign: "left",
            fontSize: 12,
          }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.background = "var(--bg-hover)")
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.background = "transparent")
          }
        >
          <div
            style={{
              color: "var(--text-primary)",
              marginBottom: 2,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              fontWeight: 500,
            }}
          >
            {result.file_name}
            <span style={{ color: "var(--text-muted)", marginLeft: 4, fontWeight: 400 }}>
              :{result.line}
            </span>
          </div>
          <div
            style={{
              color: "var(--text-muted)",
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {result.content}
          </div>
        </button>
      ))}
    </div>
  );
}
