import { markdownToMdast } from "satteri";
import type { Block } from "./types";
import { hashBlockId } from "../cache";
import { Document } from "./types";

type MdastPosition = {
  start?: { offset?: number };
  end?: { offset?: number };
};

type MdastNode = {
  type: string;
  lang?: string | null;
  depth?: number;
  value?: string;
  alt?: string;
  url?: string;
  children?: MdastNode[];
  position?: MdastPosition;
};

type MdastRoot = {
  children?: MdastNode[];
};

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
  const toLine = doc.paraphsLength - 1;

  if (toLine < 0) {
    doc.blocks = [];
    doc.dirtyFromIndex = doc.paraphsLength;
    return [];
  }

  // 全量清理 paragraph.block，后续再按新 blocks 回填。
  for (let k = 0; k <= toLine; k++) {
    doc.getParagraph(k).block = null;
  }

  const tree = markdownToMdast(text, { features: { gfm: true } }) as MdastRoot;
  const blocks: Block[] = [];

  for (const node of tree.children ?? []) {
    const block = mapTopLevelNodeToBlock(node, doc, text);
    if (block) {
      blocks.push(block);
    }
  }

  // 兜底补齐：确保每一行都被 block 覆盖（空行为 gap，非空行为 paragraph）。
  appendUncoveredLineBlocks(doc, text, blocks);

  blocks.sort((a, b) => a.documentPosFrom - b.documentPosFrom || a.documentPosTo - b.documentPosTo);

  // 设置 paragraph -> block 的双向引用。
  for (const block of blocks) {
    assignBlockToParagraphs(doc, block);
  }

  doc.blocks = blocks;
  doc.dirtyFromIndex = doc.paraphsLength;

  const elapsed = performance.now() - t0;
  if (elapsed > 1) {
    console.log(`[parseBlocks] ${elapsed.toFixed(1)}ms, total=${blocks.length}, full_parse=1`);
  }
  return blocks;
}

function mapTopLevelNodeToBlock(node: MdastNode, doc: Document, text: string): Block | null {
  const range = getLineAlignedRange(node.position, doc);
  if (!range) return null;

  if (node.type === "heading") {
    const level = clampHeadingLevel(node.depth);
    return createRangeBlock("heading", range, text, { level });
  }

  if (node.type === "thematicBreak") {
    return createRangeBlock("hr", range, text);
  }

  if (node.type === "blockquote") {
    return createRangeBlock("blockquote", range, text);
  }

  if (node.type === "table") {
    return createRangeBlock("table", range, text);
  }

  if (node.type === "html" || node.type === "raw") {
    return createRangeBlock("html", range, text, {
      html: text.slice(range.documentPosFrom, range.documentPosTo),
    });
  }

  if (node.type === "math") {
    const latex = (node.value ?? "").trim();
    if (!latex) return null;
    return createRangeBlock("math", range, text, { latex });
  }

  if (node.type === "code") {
    const lang = (node.lang ?? "").trim();
    if (lang === "mermaid") {
      const code = (node.value ?? "").trim();
      if (code) {
        return createRangeBlock("mermaid", range, text, { code });
      }
      return createRangeBlock("code", range, text, { lang: "mermaid" });
    }
    return createRangeBlock("code", range, text, { lang });
  }

  if (node.type === "image") {
    return createRangeBlock("image", range, text, {
      url: (node.url ?? "").trim(),
      alt: node.alt ?? "",
    });
  }

  if (node.type === "paragraph") {
    const maybeMath = tryParseMathFenceFromRange(range, text);
    if (maybeMath) {
      return createRangeBlock("math", range, text, { latex: maybeMath });
    }

    const image = getParagraphStandaloneImage(node);
    if (image) {
      return createRangeBlock("image", range, text, {
        url: (image.url ?? "").trim(),
        alt: image.alt ?? "",
      });
    }
    return createRangeBlock("paragraph", range, text);
  }

  // 未显式支持的顶层节点统一降级为 paragraph，保证渲染链路不断。
  return createRangeBlock("paragraph", range, text);
}

function getLineAlignedRange(position: MdastPosition | undefined, doc: Document): { documentPosFrom: number; documentPosTo: number } | null {
  const contentLen = doc.length;
  const rawFrom = clamp(position?.start?.offset ?? -1, 0, contentLen);
  const rawTo = clamp(position?.end?.offset ?? -1, 0, contentLen);
  if (rawFrom < 0 || rawTo <= rawFrom) return null;

  const startParagraph = doc.getParagraphAtPos(rawFrom);
  const endSeek = Math.max(rawFrom, rawTo - 1);
  const endParagraph = doc.getParagraphAtPos(endSeek);

  const documentPosFrom = startParagraph.documentPosFrom;
  const documentPosTo = endParagraph.documentPosTo;
  if (documentPosTo <= documentPosFrom) return null;

  return { documentPosFrom, documentPosTo };
}

function createRangeBlock(type: string, range: { documentPosFrom: number; documentPosTo: number }, text: string, extra: Partial<Block> = {}): Block {
  return {
    type,
    id: hashBlockId(text.slice(range.documentPosFrom, range.documentPosTo)),
    documentPosFrom: range.documentPosFrom,
    documentPosTo: range.documentPosTo,
    ...extra,
  };
}

function getParagraphStandaloneImage(node: MdastNode): MdastNode | null {
  if (!Array.isArray(node.children) || node.children.length === 0) return null;

  let image: MdastNode | null = null;
  for (const child of node.children) {
    if (child.type === "image") {
      if (image) return null;
      image = child;
      continue;
    }

    if (child.type === "text" && (child.value ?? "").trim() === "") {
      continue;
    }

    return null;
  }
  return image;
}

function tryParseMathFenceFromRange(range: { documentPosFrom: number; documentPosTo: number }, text: string): string | null {
  const raw = text.slice(range.documentPosFrom, range.documentPosTo).trim();
  if (!raw.startsWith("$$") || !raw.endsWith("$$")) return null;

  const lines = raw.split("\n");
  if (lines.length < 3) return null;
  if (lines[0].trim() !== "$$" || lines[lines.length - 1].trim() !== "$$") return null;

  const latex = lines.slice(1, -1).join("\n").trim();
  if (!latex) return null;
  return latex;
}

function appendUncoveredLineBlocks(doc: Document, text: string, blocks: Block[]): void {
  const covered = new Array(doc.paraphsLength).fill(false);

  for (const block of blocks) {
    const startIdx = doc.getParagraphAtPos(block.documentPosFrom).documentOffsetIndex;
    const endIdx = doc.getParagraphAtPos(block.documentPosTo).documentOffsetIndex;
    for (let i = startIdx; i <= endIdx; i++) {
      covered[i] = true;
    }
  }

  let i = 0;
  while (i < doc.paraphsLength) {
    if (covered[i]) {
      i++;
      continue;
    }

    const para = doc.getParagraph(i);
    if (para.text.trim() === "") {
      blocks.push({
        type: "gap",
        id: hashBlockId(para.text),
        documentPosFrom: para.documentPosFrom,
        documentPosTo: para.documentPosTo,
      });
      covered[i] = true;
      i++;
      continue;
    }

    const startLine = i;
    let endLine = i;
    for (let j = i + 1; j < doc.paraphsLength; j++) {
      if (covered[j]) break;
      if (doc.getParagraph(j).text.trim() === "") break;
      endLine = j;
    }

    const startParagraph = doc.getParagraph(startLine);
    const endParagraph = doc.getParagraph(endLine);
    blocks.push({
      type: "paragraph",
      id: hashBlockId(text.slice(startParagraph.documentPosFrom, endParagraph.documentPosTo)),
      documentPosFrom: startParagraph.documentPosFrom,
      documentPosTo: endParagraph.documentPosTo,
    });

    for (let j = startLine; j <= endLine; j++) {
      covered[j] = true;
    }
    i = endLine + 1;
  }
}

function clampHeadingLevel(depth: number | undefined): 1 | 2 | 3 | 4 | 5 | 6 {
  const n = typeof depth === "number" && Number.isFinite(depth) ? Math.floor(depth) : 1;
  return clamp(n, 1, 6) as 1 | 2 | 3 | 4 | 5 | 6;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
