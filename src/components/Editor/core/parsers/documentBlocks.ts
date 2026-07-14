import type { Block, Paragraph } from "./types";
import { hashBlockId } from "../cache";
import { Document } from "./types";

const codeFenceRe = /^(`{3,})(\S*)\s*$/;
const mathFenceRe = /^\$\$\s*$/;
const htmlOpenTagRe = /^<([a-zA-Z][a-zA-Z0-9]*)([\s>])/;
const tableSeparatorRe = /^\s*\|?(\s*:?-+:?\s*\|)+\s*:?-+:?\s*\|?\s*$/;
const imageRe = /^!\[([^\]]*)\]\(([^)]+)\)\s*$/;
const headingRe = /^(#{1,6})\s/;
const hrRe = /^(?:---+|___+|\*\*\*+)\s*$/;
const blockquoteRe = /^>\s?/;

function htmlCloseTagRe(tag: string) {
  return new RegExp(`</${tag}\\s*>`);
}

function htmlOpenCountRe(tag: string) {
  return new RegExp(`<${tag}[\\s>]`, "g");
}

/** 设置 block 范围内所有段落的 block 反向引用 */
function assignBlockToParagraphs(doc: Document, block: Block): void {
  const startIdx = doc.getParagraphAtPos(block.documentPosFrom).documentOffsetIndex;
  const endIdx = doc.getParagraphAtPos(block.documentPosTo).documentOffsetIndex;
  for (let i = startIdx; i <= endIdx; i++) {
    doc.getParagraph(i).block = block;
  }
}

export function parseDocumentToBlocks(doc: Document): Block[] {
  const t0 = performance.now();
  const text = doc.content;
  const oldBlocks = doc.blocks;
  const dirtyFrom = doc.dirtyFromIndex;
  const toLine = doc.paraphsLength - 1;

  // 无脏区域时直接返回旧 blocks
  if (dirtyFrom > toLine && oldBlocks.length > 0) {
    return oldBlocks;
  }

  // ─── 增量解析：复用前缀，从 dirty block 开始重解析，匹配后缀时提前终止 ───

  // 1. 找到包含 dirtyFrom 的第一个旧 block 的索引
  let firstDirtyBlockIdx = 0;
  if (oldBlocks.length > 0 && dirtyFrom > 0) {
    for (let b = 0; b < oldBlocks.length; b++) {
      const blockEndLine = doc.getParagraphAtPos(oldBlocks[b].documentPosTo).documentOffsetIndex;
      if (blockEndLine >= dirtyFrom) {
        firstDirtyBlockIdx = b;
        break;
      }
      if (b === oldBlocks.length - 1) {
        firstDirtyBlockIdx = oldBlocks.length;
      }
    }
  }

  // 2. prefix：dirty block 之前的 block 直接复用
  const prefix = oldBlocks.slice(0, firstDirtyBlockIdx);

  // 3. 确定重解析起始行
  let startLine = 0;
  if (firstDirtyBlockIdx > 0) {
    const lastPrefixBlock = prefix[prefix.length - 1];
    startLine = doc.getParagraphAtPos(lastPrefixBlock.documentPosTo).documentOffsetIndex + 1;
  }

  // 4. 从 startLine 开始解析新 blocks
  const newSuffix: Block[] = [];
  let i = startLine;

  // 清除重解析范围内的旧 block 引用
  for (let k = startLine; k <= toLine; k++) {
    doc.getParagraph(k).block = null;
  }

  while (i <= toLine) {
    const ln = doc.getParagraph(i);

    if (tryCodeFence(doc, text, i, ln, newSuffix)) {
      i = lastBlockEnd(newSuffix, doc) + 1;
    } else if (tryMathFence(doc, text, i, ln, newSuffix)) {
      i = lastBlockEnd(newSuffix, doc) + 1;
    } else if (tryHtmlBlock(doc, text, i, ln, newSuffix)) {
      i = lastBlockEnd(newSuffix, doc) + 1;
    } else if (tryTable(doc, text, i, ln, newSuffix)) {
      i = lastBlockEnd(newSuffix, doc) + 1;
    } else if (tryImage(ln, newSuffix)) {
      i++;
    } else if (tryHeading(ln, newSuffix)) {
      i++;
    } else if (tryHr(ln, newSuffix)) {
      i++;
    } else if (tryBlockquote(doc, text, i, toLine, newSuffix)) {
      i = lastBlockEnd(newSuffix, doc) + 1;
    } else if (ln.text.trim() === "") {
      newSuffix.push({ type: "gap", id: hashBlockId(ln.text), documentPosFrom: ln.documentPosFrom, documentPosTo: ln.documentPosTo });
      i++;
    } else {
      i = consumeParagraph(doc, text, i, toLine, newSuffix);
    }
  }

  const blocks = [...prefix, ...newSuffix];

  // 设置双向引用（仅对新解析/变更的 blocks）
  for (const block of newSuffix) {
    assignBlockToParagraphs(doc, block);
  }

  // 重置 dirty
  doc.dirtyFromIndex = doc.paraphsLength;

  const elapsed = performance.now() - t0;
  if (elapsed > 1) {
    console.log(`[parseBlocks] ${elapsed.toFixed(1)}ms, total=${blocks.length}, reused_prefix=${prefix.length}, reparsed=${newSuffix.length}`);
  }
  return blocks;
}

function lastBlockEnd(blocks: Block[], doc: Document): number {
  const last = blocks[blocks.length - 1];
  return doc.getParagraphAtPos(last.documentPosTo).documentOffsetIndex;
}

function tryCodeFence(doc: Document, text: string, lineIndex: number, ln: Paragraph, blocks: Block[]): boolean {
  const lnText = ln.text;
  const m = codeFenceRe.exec(lnText);
  if (!m) return false;

  const fence = m[1];
  const lang = m[2] || "";
  const fenceLen = fence.length;
  const isMermaid = lang === "mermaid";

  let endLineNum = -1;
  for (let j = lineIndex + 1; j < doc.paraphsLength; j++) {
    const l = doc.getParagraph(j);
    if (new RegExp(`^\`{${fenceLen},}\\s*$`).test(l.text)) {
      endLineNum = j;
      break;
    }
  }

  if (endLineNum <= 0) return false;

  const startParagraph = doc.getParagraph(lineIndex);
  const endParagraph = doc.getParagraph(endLineNum);
  const id = hashBlockId(text.slice(startParagraph.documentPosFrom, endParagraph.documentPosTo));

  if (isMermaid) {
    const codeLines: string[] = [];
    for (let j = lineIndex + 1; j < endLineNum; j++) {
      codeLines.push(doc.getParagraph(j).text);
    }
    const code = codeLines.join("\n").trim();
    if (code) {
      blocks.push({
        type: "mermaid",
        id,
        code,
        documentPosFrom: startParagraph.documentPosFrom,
        documentPosTo: endParagraph.documentPosTo,
      });
    } else {
      // 空 mermaid 块退化为普通 code 块，避免不 push 导致无限循环
      blocks.push({
        type: "code",
        id,
        lang: "mermaid",
        documentPosFrom: startParagraph.documentPosFrom,
        documentPosTo: endParagraph.documentPosTo,
      });
    }
  } else {
    blocks.push({
      type: "code",
      id,
      lang,
      documentPosFrom: startParagraph.documentPosFrom,
      documentPosTo: endParagraph.documentPosTo,
    });
  }

  return true;
}

function tryMathFence(doc: Document, text: string, lineIndex: number, ln: Paragraph, blocks: Block[]): boolean {
  if (!mathFenceRe.test(ln.text)) return false;

  let endLineNum = -1;
  for (let j = lineIndex + 1; j < doc.paraphsLength; j++) {
    if (mathFenceRe.test(doc.getParagraph(j).text)) {
      endLineNum = j;
      break;
    }
  }

  if (endLineNum <= 0) return false;

  const startParagraph = doc.getParagraph(lineIndex);
  const endParagraph = doc.getParagraph(endLineNum);
  const latex = text.slice(startParagraph.documentPosTo + 1, endParagraph.documentPosFrom).trim();
  if (!latex) return false;

  blocks.push({
    type: "math",
    id: hashBlockId(text.slice(startParagraph.documentPosFrom, endParagraph.documentPosTo)),
    latex,
    documentPosFrom: startParagraph.documentPosFrom,
    documentPosTo: endParagraph.documentPosTo,
  });
  return true;
}

function tryHtmlBlock(doc: Document, text: string, lineIndex: number, ln: Paragraph, blocks: Block[]): boolean {
  const m = htmlOpenTagRe.exec(ln.text);
  if (!m) return false;

  const tag = m[1];
  const closeRe = htmlCloseTagRe(tag);
  const openRe = htmlOpenCountRe(tag);
  let depth = 0;
  let endLineNum = -1;

  for (let j = lineIndex; j < doc.paraphsLength; j++) {
    const lText = doc.getParagraph(j).text;
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

  if (endLineNum <= 0) return false;

  const startParagraph = doc.getParagraph(lineIndex);
  const endParagraph = doc.getParagraph(endLineNum);
  const html = text.slice(startParagraph.documentPosFrom, endParagraph.documentPosTo);
  blocks.push({
    type: "html",
    id: hashBlockId(html),
    html,
    documentPosFrom: startParagraph.documentPosFrom,
    documentPosTo: endParagraph.documentPosTo,
  });
  return true;
}

function tryTable(doc: Document, text: string, lineIndex: number, ln: Paragraph, blocks: Block[]): boolean {
  if (!ln.text.includes("|")) return false;
  if (lineIndex + 1 >= doc.paraphsLength) return false;

  const nextParagraph = doc.getParagraph(lineIndex + 1);
  if (!tableSeparatorRe.test(nextParagraph.text)) return false;

  let endLineNum = lineIndex + 1;
  for (let j = lineIndex + 2; j < doc.paraphsLength; j++) {
    if (!doc.getParagraph(j).text.includes("|")) break;
    endLineNum = j;
  }

  if (endLineNum <= lineIndex + 1) return false;

  const startParagraph = doc.getParagraph(lineIndex);
  const endParagraph = doc.getParagraph(endLineNum);
  blocks.push({
    type: "table",
    id: hashBlockId(text.slice(startParagraph.documentPosFrom, endParagraph.documentPosTo)),
    documentPosFrom: startParagraph.documentPosFrom,
    documentPosTo: endParagraph.documentPosTo,
  });
  return true;
}

function tryImage(para: Paragraph, blocks: Block[]): boolean {
  const m = imageRe.exec(para.text);
  if (!m) return false;

  blocks.push({
    type: "image",
    id: hashBlockId(para.text),
    url: m[2].trim(),
    alt: m[1],
    documentPosFrom: para.documentPosFrom,
    documentPosTo: para.documentPosTo,
  });
  return true;
}

function tryHeading(para: Paragraph, blocks: Block[]): boolean {
  const m = headingRe.exec(para.text);
  if (!m) return false;

  blocks.push({
    type: "heading",
    id: hashBlockId(para.text),
    level: m[1].length as 1 | 2 | 3 | 4 | 5 | 6,
    documentPosFrom: para.documentPosFrom,
    documentPosTo: para.documentPosTo,
  });
  return true;
}

function tryHr(para: Paragraph, blocks: Block[]): boolean {
  if (!hrRe.test(para.text)) return false;

  blocks.push({
    type: "hr",
    id: hashBlockId(para.text),
    documentPosFrom: para.documentPosFrom,
    documentPosTo: para.documentPosTo,
  });
  return true;
}

function tryBlockquote(doc: Document, text: string, lineIndex: number, toLine: number, blocks: Block[]): boolean {
  const ln = doc.getParagraph(lineIndex);
  if (!blockquoteRe.test(ln.text)) return false;

  let endLineNum = lineIndex;
  for (let j = lineIndex + 1; j <= toLine; j++) {
    if (!blockquoteRe.test(doc.getParagraph(j).text)) break;
    endLineNum = j;
  }

  const endParagraph = doc.getParagraph(endLineNum);
  blocks.push({
    type: "blockquote",
    id: hashBlockId(text.slice(ln.documentPosFrom, endParagraph.documentPosTo)),
    documentPosFrom: ln.documentPosFrom,
    documentPosTo: endParagraph.documentPosTo,
  });
  return true;
}

function consumeParagraph(doc: Document, text: string, lineIndex: number, toLine: number, blocks: Block[]): number {
  const startParagraph = doc.getParagraph(lineIndex);
  let endLineNum = lineIndex;

  for (let j = lineIndex + 1; j <= toLine; j++) {
    const lText = doc.getParagraph(j).text;
    if (lText.trim() === "") break;
    if (codeFenceRe.test(lText)) break;
    if (mathFenceRe.test(lText)) break;
    if (htmlOpenTagRe.test(lText)) break;
    if (imageRe.test(lText)) break;
    if (headingRe.test(lText)) break;
    if (hrRe.test(lText)) break;
    if (blockquoteRe.test(lText)) break;
    if (lText.includes("|") && j + 1 < doc.paraphsLength) {
      if (tableSeparatorRe.test(doc.getParagraph(j + 1).text)) break;
    }
    endLineNum = j;
  }

  const endParagraph = doc.getParagraph(endLineNum);
  blocks.push({
    type: "paragraph",
    id: hashBlockId(text.slice(startParagraph.documentPosFrom, endParagraph.documentPosTo)),
    documentPosFrom: startParagraph.documentPosFrom,
    documentPosTo: endParagraph.documentPosTo,
  });
  return endLineNum + 1;
}
