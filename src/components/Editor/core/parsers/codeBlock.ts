import type { Block } from "./types";
import { hashBlockId } from "../cache";

export function findCodeBlocks(doc: { getParagraph(n: number): { documentPosFrom: number; documentPosTo: number }; sliceContent(from: number, to: number): string; paraphsLength: number }, 
  fromLine = 0, 
  toLine = doc.paraphsLength - 1): Block[] {
  const blocks: Block[] = [];
  let i = fromLine;
  while (i <= toLine) {
    const ln = doc.getParagraph(i);
    const lnText = doc.sliceContent(ln.documentPosFrom, ln.documentPosTo);
    const openMatch = lnText.match(/^(`{3,})(\S*)\s*$/);
    if (openMatch) {
      const fence = openMatch[1];
      const lang = openMatch[2] || "";
      if (lang === "mermaid") { i++; continue; }

      const fenceLen = fence.length;
      let endLineNum = -1;
      for (let j = i + 1; j < doc.paraphsLength; j++) {
        const l = doc.getParagraph(j);
        const lText = doc.sliceContent(l.documentPosFrom, l.documentPosTo);
        if (new RegExp(`^\`{${fenceLen},}\\s*$`).test(lText)) {
          endLineNum = j;
          break;
        }
      }

      if (endLineNum > 0) {
        const startParagraph = doc.getParagraph(i);
        const endParagraph = doc.getParagraph(endLineNum);
        const lines: string[] = [];
        for (let k = i; k <= endLineNum; k++) {
          const p = doc.getParagraph(k);
          lines.push(doc.sliceContent(p.documentPosFrom, p.documentPosTo));
        }
        blocks.push({
          type: "code",
          id: hashBlockId(lines.join("\n")),
          lang,
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
