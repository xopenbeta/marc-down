import type { Block } from "./types";
import { hashBlockId } from "../cache";

export function findMathBlocks(doc: { toString(): string; content: string; getParagraphAtPos(pos: number): { from: number; to: number; number: number }; getParagraph(n: number): { documentPosFrom: number; documentPosTo: number }; sliceContent(from: number, to: number): string; paraphsLength: number }, 
  fromLine = 0, 
  toLine = doc.paraphsLength - 1): Block[] {
  const blocks: Block[] = [];
  let i = fromLine;
  while (i <= toLine) {
    const ln = doc.getParagraph(i);
    const lnText = doc.sliceContent(ln.documentPosFrom, ln.documentPosTo);
    if (/^\$\$\s*$/.test(lnText)) {
      let endLineNum = -1;
      for (let j = i + 1; j < doc.paraphsLength; j++) {
        const l = doc.getParagraph(j);
        const lText = doc.sliceContent(l.documentPosFrom, l.documentPosTo);
        if (/^\$\$\s*$/.test(lText)) {
          endLineNum = j;
          break;
        }
      }
      if (endLineNum > 0) {
        const startParagraph = doc.getParagraph(i);
        const endParagraph = doc.getParagraph(endLineNum);
        const latex = doc.sliceContent(startParagraph.documentPosTo + 1, endParagraph.documentPosFrom).trim();
        if (latex) {
          blocks.push({
            type: "math",
            id: hashBlockId(doc.sliceContent(startParagraph.documentPosFrom, endParagraph.documentPosTo)),
            latex,
            documentPosFrom: startParagraph.documentPosFrom,
            documentPosTo: endParagraph.documentPosTo,
          });
        }
        i = endLineNum + 1;
        continue;
      }
    }
    i++;
  }
  return blocks;
}
