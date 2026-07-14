import mermaid from "mermaid";
import type { Block } from "./types";
import { hashBlock } from "../cache";

function getMermaidTheme(): "dark" | "default" {
  return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "default";
}

let lastTheme = "";

export function ensureMermaidInit() {
  const theme = getMermaidTheme();
  if (lastTheme === theme) return;
  lastTheme = theme;
  mermaid.initialize({
    startOnLoad: false,
    theme,
    securityLevel: "loose",
  });
}

export function findMermaidBlocks(
  doc: { toString(): string; content: string; getParagraphAtPos(pos: number): { from: number; to: number; number: number }; getParagraph(n: number): { documentPosFrom: number; documentPosTo: number }; sliceContent(from: number, to: number): string; paraphsLength: number }, 
  fromLine = 0, 
  toLine = doc.paraphsLength - 1): Block[] {
  const blocks: Block[] = [];
  let i = fromLine;
  while (i <= toLine) {
    const ln = doc.getParagraph(i);
    const lnText = doc.sliceContent(ln.documentPosFrom, ln.documentPosTo);
    if (/^```mermaid\s*$/.test(lnText)) {
      let endLineNum = -1;
      for (let j = i + 1; j < doc.paraphsLength; j++) {
        const l = doc.getParagraph(j);
        const lText = doc.sliceContent(l.documentPosFrom, l.documentPosTo);
        if (/^```\s*$/.test(lText)) {
          endLineNum = j;
          break;
        }
      }
      if (endLineNum > 0) {
        const startParagraph = doc.getParagraph(i);
        const endParagraph = doc.getParagraph(endLineNum);
        const codeLines: string[] = [];
        for (let j = i + 1; j < endLineNum; j++) {
          const p = doc.getParagraph(j);
          codeLines.push(doc.sliceContent(p.documentPosFrom, p.documentPosTo));
        }
        const code = codeLines.join("\n").trim();
        if (code) {
          blocks.push({
            type: "mermaid",
            id: hashBlock(doc.sliceContent(startParagraph.documentPosFrom, endParagraph.documentPosTo)),
            code,
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
