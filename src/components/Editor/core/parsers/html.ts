import type { Block } from "./types";
import { hashBlockId } from "../cache";

export function findHtmlBlocks(doc: { toString(): string; content: string; getParagraphAtPos(pos: number): { from: number; to: number; number: number }; getParagraph(n: number): { documentPosFrom: number; documentPosTo: number }; sliceContent(from: number, to: number): string; paraphsLength: number }, 
  fromLine = 0, 
  toLine = doc.paraphsLength - 1): Block[] {
  const blocks: Block[] = [];
  const openTagRe = /^<([a-zA-Z][a-zA-Z0-9]*)([\s>])/;
  const closeTagRe = (tag: string) => new RegExp(`</${tag}\\s*>`);
  const openCountRe = (tag: string) => new RegExp(`<${tag}[\\s>]`, "g");

  let i = fromLine;
  while (i <= toLine) {
    const ln = doc.getParagraph(i);
    const lnText = doc.sliceContent(ln.documentPosFrom, ln.documentPosTo);
    const m = openTagRe.exec(lnText);
    if (m) {
      const tag = m[1];
      const closeRe = closeTagRe(tag);
      const openRe = openCountRe(tag);
      let depth = 0;
      let endLineNum = -1;

      for (let j = i; j < doc.paraphsLength; j++) {
        const l = doc.getParagraph(j);
        const lText = doc.sliceContent(l.documentPosFrom, l.documentPosTo);
        const opens = lText.match(openRe);
        if (opens) depth += opens.length;
        if (closeRe.test(lText)) {
          depth--;
          if (depth <= 0) {
            endLineNum = j;
            break;
          }
        }
      }

      if (endLineNum > 0) {
        const startParagraph = doc.getParagraph(i);
        const endParagraph = doc.getParagraph(endLineNum);
        const html = doc.sliceContent(startParagraph.documentPosFrom, endParagraph.documentPosTo);
        blocks.push({
          type: "html",
          id: hashBlockId(html),
          html,
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
