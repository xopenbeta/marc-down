import type { Block } from "./types";
import { hashBlockId } from "../cache";

export function parseTableRow(para: string): string[] {
  const trimmed = para.trim();
  const content = trimmed.startsWith("|") ? trimmed.slice(1) : trimmed;
  const withoutTrailing = content.endsWith("|") ? content.slice(0, -1) : content;
  return withoutTrailing.split("|").map(cell => cell.trim());
}

export function parseAlignments(para: string): ("left" | "center" | "right" | null)[] {
  return parseTableRow(para).map(cell => {
    const trimmed = cell.trim().replace(/\s/g, "");
    if (trimmed.startsWith(":") && trimmed.endsWith(":")) return "center";
    if (trimmed.endsWith(":")) return "right";
    if (trimmed.startsWith(":")) return "left";
    return null;
  });
}

export function findTableBoundaries(
  doc: { getParagraph(n: number): { documentPosFrom: number; documentPosTo: number }; sliceContent(from: number, to: number): string; paraphsLength: number }, 
  fromLine = 0, 
  toLine = doc.paraphsLength - 1): Block[] {
  const blocks: Block[] = [];
  const separatorRe = /^\s*\|?(\s*:?-+:?\s*\|)+\s*:?-+:?\s*\|?\s*$/;
  let i = Math.max(fromLine, 1);
  while (i <= toLine) {
    const ln = doc.getParagraph(i);
    const lnText = doc.sliceContent(ln.documentPosFrom, ln.documentPosTo);
    if (separatorRe.test(lnText)) {
      const headerParagraph = doc.getParagraph(i - 1);
      const headerText = doc.sliceContent(headerParagraph.documentPosFrom, headerParagraph.documentPosTo);
      if (!headerText.includes("|")) { i++; continue; }
      let endLineNum = i;
      for (let j = i + 1; j < doc.paraphsLength; j++) {
        const l = doc.getParagraph(j);
        const lText = doc.sliceContent(l.documentPosFrom, l.documentPosTo);
        if (!lText.includes("|")) break;
        endLineNum = j;
      }
      if (endLineNum > i) {
        const startParagraph = doc.getParagraph(i - 1);
        const endParagraph = doc.getParagraph(endLineNum);
        const lines: string[] = [];
        for (let k = i - 1; k <= endLineNum; k++) {
          const p = doc.getParagraph(k);
          lines.push(doc.sliceContent(p.documentPosFrom, p.documentPosTo));
        }
        blocks.push({
          type: "table",
          id: hashBlockId(lines.join("\n")),
          documentPosFrom: startParagraph.documentPosFrom,
          documentPosTo: endParagraph.documentPosTo,
        });
        i = endLineNum + 1;
        continue;
      }
    }
    i++;
  }
  return blocks;
}
