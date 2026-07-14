import katex from "katex";
import type { Block, Segment, Glyph, VisualLine, Paragraph } from "./parsers/types";
import { EditorFontManager } from "./EditorFont";

/** 获取 glyph 的完整占位宽度（字符宽度 + 左右 padding） */
export function glyphFullWidth(g: Glyph): number {
  return g.width + (g.padLeft ?? 0) + (g.padRight ?? 0);
}

// 延迟初始化：将 canvas 挂载到 DOM 并在首次使用时创建，
// 避免模块加载时期创建 detached canvas 导致浏览器无法解析 @font-face 字体。
let _measureCtx: CanvasRenderingContext2D | null = null;

function getMeasureCtx(): CanvasRenderingContext2D {
  if (!_measureCtx) {
    const canvas = document.createElement("canvas");
    canvas.style.cssText = "position:fixed;top:-9999px;left:-9999px;visibility:hidden;pointer-events:none;width:0;height:0;";
    document.body.appendChild(canvas);
    _measureCtx = canvas.getContext("2d")!;
  }
  return _measureCtx;
}

const charWidthCache = new Map<string, Map<number, number>>();
const inlineMathWidthCache = new Map<string, { width: number; height: number }>();

function hashStr(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(36);
}

function measureCharWidth(font: string, char: string): number {
  let fontCache = charWidthCache.get(font);
  if (!fontCache) {
    fontCache = new Map();
    charWidthCache.set(font, fontCache);
  }
  const cp = char.codePointAt(0)!;
  let w = fontCache.get(cp);
  if (w === undefined) {
    const ctx = getMeasureCtx();
    ctx.font = font;
    w = ctx.measureText(char).width;
    fontCache.set(cp, w);
  }
  return w;
}

function measureInlineMath(latex: string): { width: number; height: number } {
  // 将 font-size 纳入缓存 key，确保字体大小变更后不会返回过期值
  const fm = EditorFontManager.getInstance();
  const editorFontSize = fm.fontSize;
  const editorLineHeight = fm.lineHeight;
  const key = hashStr(latex) + "_" + editorFontSize;
  let cached = inlineMathWidthCache.get(key);
  if (cached) return cached;

  const container = document.createElement("span");
  container.className = "cm-math-inline-render";
  // 同步编辑器 font-size/line-height，覆盖 CSS 类的 height:1lh/overflow:hidden
  // 以确保测量环境与编辑器渲染环境一致，避免高度约束影响 KaTeX vlist 布局宽度
  container.style.cssText = `position:absolute;visibility:hidden;pointer-events:none;font-size:${editorFontSize}px;line-height:${editorLineHeight}px;height:auto;overflow:visible;`;
  try {
    katex.render(latex, container, {
      displayMode: false,
      throwOnError: false,
      output: "html",
    });
  } catch {
    container.textContent = latex;
  }
  document.body.appendChild(container);
  const rect = container.getBoundingClientRect();
  const width = Math.ceil(rect.width);
  const height = Math.ceil(rect.height);
  document.body.removeChild(container);

  cached = { width: width || 20, height: height || 18 };
  inlineMathWidthCache.set(key, cached);
  return cached;
}

const CJK_RANGES: [number, number][] = [
  [0x4e00, 0x9fff], // CJK Unified Ideographs
  [0x3400, 0x4dbf], // CJK Unified Ideographs Extension A
  [0x3000, 0x303f], // CJK Symbols and Punctuation
  [0xff00, 0xffef], // Fullwidth Forms
  [0x3040, 0x309f], // Hiragana
  [0x30a0, 0x30ff], // Katakana
  [0xac00, 0xd7af], // Hangul
];

function isCJK(cp: number): boolean {
  for (const [lo, hi] of CJK_RANGES) {
    if (cp >= lo && cp <= hi) return true;
  }
  return false;
}

function isBreakableAfter(cp: number, nextCp: number | undefined): boolean {
  if (cp === 0x20 || cp === 0x09) return true; // space, tab
  if (isCJK(cp)) return true;
  if (nextCp !== undefined && isCJK(nextCp)) return true;
  return false;
}

// ─── Block-relative glyph helpers ───────────────────────────────────────────

/** 带 block-relative 偏移的 glyph 条目 */
export interface BlockGlyph {
  glyph: Glyph;
  blockOffsetFrom: number;
  blockOffsetTo: number;
}

/** 带 paragraph-relative 偏移的 glyph 条目 */
interface ParaGlyph {
  glyph: Glyph;
  paraphOffsetFrom: number;
  paraphOffsetTo: number;
}

/** 收集段落内所有 glyph，计算 paragraph-relative 偏移 */
function collectGlyphsFromParagraphWithOffset(para: Paragraph): ParaGlyph[] {
  const result: ParaGlyph[] = [];
  for (const seg of para.segments) {
    for (const chunk of seg.chunks) {
      for (const g of chunk.glyphs) {
        result.push({
          glyph: g,
          paraphOffsetFrom: seg.paraphOffsetFrom + chunk.segmentOffsetFrom + g.chunkOffsetFrom,
          paraphOffsetTo: seg.paraphOffsetFrom + chunk.segmentOffsetFrom + g.chunkOffsetTo,
        });
      }
    }
  }
  return result;
}

/** 收集 block 内所有 glyph，计算 block-relative 偏移 */
export function collectGlyphsWithBlockOffset(block: Block): BlockGlyph[] {
  const result: BlockGlyph[] = [];
  for (const para of block.paragraphs!) {
    for (const seg of para.segments) {
      for (const chunk of seg.chunks) {
        for (const g of chunk.glyphs) {
          const paraBase = para.blockOffsetFrom + seg.paraphOffsetFrom + chunk.segmentOffsetFrom;
          result.push({
            glyph: g,
            blockOffsetFrom: paraBase + g.chunkOffsetFrom,
            blockOffsetTo: paraBase + g.chunkOffsetTo,
          });
        }
      }
    }
  }
  return result;
}

/** 兼容：收集 block 内所有原始 glyph 引用 */
export function collectGlyphs(block: Block): Glyph[] {
  const result: Glyph[] = [];
  for (const para of block.paragraphs!) {
    for (const seg of para.segments) {
      for (const chunk of seg.chunks) {
        for (const g of chunk.glyphs) {
          result.push(g);
        }
      }
    }
  }
  return result;
}

// ─── Measure ────────────────────────────────────────────────────────────────

export function measureBlock(block: Block): void {
  const paragraphs = block.paragraphs!;
  let chunkOffset = 0;

  for (let pi = 0; pi < paragraphs.length; pi++) {
    const para = paragraphs[pi];

    measureChunks(
      para.segments,
      para.lineHeight,
      chunkOffset,
    );

    let paraChunkCount = 0;
    for (const seg of para.segments) {
      paraChunkCount += seg.chunks.length;
    }
    chunkOffset += paraChunkCount;

    if (pi < paragraphs.length - 1) {
      outer: for (let si = para.segments.length - 1; si >= 0; si--) {
        const seg = para.segments[si];
        for (let ci = seg.chunks.length - 1; ci >= 0; ci--) {
          const lastChunk = seg.chunks[ci];
          if (lastChunk.glyphs.length > 0) {
            lastChunk.glyphs[lastChunk.glyphs.length - 1].forceBreak = true;
            break outer;
          }
        }
      }
    }
  }
}

function measureChunks(
  segments: Segment[],
  lineHeight: number,
  chunkOffset: number,
): void {
  let globalCi = chunkOffset;

  for (const seg of segments) {
    if (seg.type === "inline-math") {
      const mathPadLeft = 6;
      const mathPadRight = 6;
      for (let ci = 0; ci < seg.chunks.length; ci++) {
        const chunk = seg.chunks[ci];
        chunk.glyphs = [];

        if (chunk.type === "inline-math-render") {
          const latex = seg.latex ?? "";
          const dim = latex ? measureInlineMath(latex) : { width: 0, height: 0 };
          chunk.glyphs.push({
            chunkOffsetIndex: globalCi, chunkOffsetFrom: 0, chunkOffsetTo: 0,
            width: dim.width, height: dim.height, breakable: false, forceBreak: false,
          });
          seg.renderWidth = dim.width;
          seg.renderHeight = dim.height;
        } else {
          const text = chunk.text;
          const font = chunk.font;
          let chunkCharPos = 0;
          let i = 0;
          while (i < text.length) {
            const cp = text.codePointAt(i)!;
            const charLen = cp > 0xffff ? 2 : 1;
            const w = measureCharWidth(font, text.substring(i, i + charLen));
            const nextCp = i + charLen < text.length ? text.codePointAt(i + charLen) : undefined;
            chunk.glyphs.push({
              chunkOffsetIndex: globalCi, chunkOffsetFrom: chunkCharPos, chunkOffsetTo: chunkCharPos + charLen,
              width: w, height: 0, breakable: isBreakableAfter(cp, nextCp), forceBreak: false,
            });
            chunkCharPos += charLen;
            i += charLen;
          }
          if (ci === 0 && chunk.glyphs.length > 0) {
            chunk.glyphs[chunk.glyphs.length - 1].padRight = mathPadLeft;
          } else if (ci === 2 && chunk.glyphs.length > 0) {
            chunk.glyphs[0].padLeft = mathPadRight;
          }
        }
        globalCi++;
      }
    } else if (seg.type === "inline-image") {
      for (let ci = 0; ci < seg.chunks.length; ci++) {
        const chunk = seg.chunks[ci];
        chunk.glyphs = [];

        if (chunk.type === "inline-image-render") {
          chunk.glyphs.push({
            chunkOffsetIndex: globalCi, chunkOffsetFrom: 0, chunkOffsetTo: 0,
            width: lineHeight, height: lineHeight, breakable: false, forceBreak: false,
          });
          seg.renderWidth = lineHeight;
          seg.renderHeight = lineHeight;
        } else {
          const text = chunk.text;
          const font = chunk.font;
          let chunkCharPos = 0;
          let i = 0;
          while (i < text.length) {
            const cp = text.codePointAt(i)!;
            const charLen = cp > 0xffff ? 2 : 1;
            const w = measureCharWidth(font, text.substring(i, i + charLen));
            const nextCp = i + charLen < text.length ? text.codePointAt(i + charLen) : undefined;
            chunk.glyphs.push({
              chunkOffsetIndex: globalCi, chunkOffsetFrom: chunkCharPos, chunkOffsetTo: chunkCharPos + charLen,
              width: w, height: 0, breakable: isBreakableAfter(cp, nextCp), forceBreak: false,
            });
            chunkCharPos += charLen;
            i += charLen;
          }
        }
        globalCi++;
      }
    } else if (seg.type === "inline-code") {
      const codePadLeft = 6;
      const codePadRight = 6;
      for (let ci = 0; ci < seg.chunks.length; ci++) {
        const chunk = seg.chunks[ci];
        chunk.glyphs = [];
        const text = chunk.text;
        const font = chunk.font;
        let chunkCharPos = 0;
        let i = 0;
        while (i < text.length) {
          const cp = text.codePointAt(i)!;
          const charLen = cp > 0xffff ? 2 : 1;
          const w = measureCharWidth(font, text.substring(i, i + charLen));
          const nextCp = i + charLen < text.length ? text.codePointAt(i + charLen) : undefined;
          chunk.glyphs.push({
            chunkOffsetIndex: globalCi, chunkOffsetFrom: chunkCharPos, chunkOffsetTo: chunkCharPos + charLen,
            width: w, height: 0, breakable: isBreakableAfter(cp, nextCp), forceBreak: false,
          });
          chunkCharPos += charLen;
          i += charLen;
        }
        if (ci === 0 && chunk.glyphs.length > 0) {
          chunk.glyphs[chunk.glyphs.length - 1].padRight = codePadLeft;
        } else if (ci === 2 && chunk.glyphs.length > 0) {
          chunk.glyphs[0].padLeft = codePadRight;
        }
        globalCi++;
      }
    } else {
      // text-run：逐 chunk 按字符测量
      for (const chunk of seg.chunks) {
        chunk.glyphs = [];
        const text = chunk.text;
        const font = chunk.font;
        let chunkCharPos = 0;
        let i = 0;
        while (i < text.length) {
          const cp = text.codePointAt(i)!;
          const charLen = cp > 0xffff ? 2 : 1;
          const w = measureCharWidth(font, text.substring(i, i + charLen));
          const nextCp = i + charLen < text.length ? text.codePointAt(i + charLen) : undefined;
          chunk.glyphs.push({
            chunkOffsetIndex: globalCi, chunkOffsetFrom: chunkCharPos, chunkOffsetTo: chunkCharPos + charLen,
            width: w, height: 0, breakable: isBreakableAfter(cp, nextCp), forceBreak: false,
          });
          chunkCharPos += charLen;
          i += charLen;
        }
        globalCi++;
      }
    }
  }
}

export function getParaphBlockOffsets(block: Block): number[] {
  const offsets: number[] = [];
  for (const para of block.paragraphs!) {
    offsets.push(para.blockOffsetFrom);
  }
  return offsets;
}

// ─── Layout ─────────────────────────────────────────────────────────────────

export function layoutBlock(block: Block, maxWidth: number): void {
  for (const para of block.paragraphs!) {
    const paraGlyphs = collectGlyphsFromParagraphWithOffset(para);
    para.visualLines = layoutParagraph(paraGlyphs, maxWidth, para.lineHeight);
  }
}

/** 带 block-relative 偏移的 VisualLine */
export interface BlockVisualLine {
  vl: VisualLine;
  blockOffsetFrom: number;
  blockOffsetTo: number;
}

/** 收集 block 内所有 visual lines，计算 block-relative 偏移 */
export function collectAllVisualLinesWithBlockOffset(block: Block): BlockVisualLine[] {
  const result: BlockVisualLine[] = [];
  for (const para of block.paragraphs!) {
    if (para.visualLines) {
      for (const vl of para.visualLines) {
        result.push({
          vl,
          blockOffsetFrom: para.blockOffsetFrom + vl.paraphOffsetFrom,
          blockOffsetTo: para.blockOffsetFrom + vl.paraphOffsetTo,
        });
      }
    }
  }
  return result;
}

/** 兼容：从各段落的 visualLines 收集为扁平列表 */
export function collectAllVisualLines(block: Block): VisualLine[] {
  const result: VisualLine[] = [];
  for (const para of block.paragraphs!) {
    if (para.visualLines) result.push(...para.visualLines);
  }
  return result;
}

function layoutParagraph(
  paraGlyphs: ParaGlyph[],
  maxWidth: number,
  lineHeight: number,
): VisualLine[] {
  if (paraGlyphs.length === 0) {
    return [{ width: 0, height: lineHeight, paraphOffsetFrom: 0, paraphOffsetTo: 0 }];
  }

  const makeVL = (width: number, height: number, startIdx: number, endIdx: number): VisualLine => ({
    width, height,
    paraphOffsetFrom: paraGlyphs[startIdx]?.paraphOffsetFrom ?? 0,
    paraphOffsetTo: endIdx > 0 ? (paraGlyphs[endIdx - 1]?.paraphOffsetTo ?? 0) : 0,
  });

  const visualLines: VisualLine[] = [];
  let lineStart = 0;
  let lineWidth = 0;
  let lineMaxHeight = lineHeight;
  let lastBreakable = -1;
  let widthAtBreak = 0;
  let heightAtBreak = lineHeight;

  const resetLine = (nextGlyphIdx: number) => {
    lineStart = nextGlyphIdx;
    lineWidth = 0;
    lineMaxHeight = lineHeight;
    lastBreakable = -1;
    widthAtBreak = 0;
    heightAtBreak = lineHeight;
  };

  for (let gi = 0; gi < paraGlyphs.length; gi++) {
    const g = paraGlyphs[gi].glyph;
    const gw = glyphFullWidth(g);
    const newWidth = lineWidth + gw;

    if (newWidth > maxWidth && gi > lineStart) {
      if (lastBreakable >= lineStart) {
        visualLines.push(makeVL(widthAtBreak, heightAtBreak, lineStart, lastBreakable + 1));
        resetLine(lastBreakable + 1);
        for (let k = lineStart; k <= gi; k++) {
          lineWidth += glyphFullWidth(paraGlyphs[k].glyph);
          if (paraGlyphs[k].glyph.height > lineMaxHeight) lineMaxHeight = paraGlyphs[k].glyph.height;
        }
        if (g.breakable) { lastBreakable = gi; widthAtBreak = lineWidth; heightAtBreak = lineMaxHeight; }
        if (g.forceBreak) { visualLines.push(makeVL(lineWidth, lineMaxHeight, lineStart, gi + 1)); resetLine(gi + 1); }
        continue;
      }
      visualLines.push(makeVL(lineWidth, lineMaxHeight, lineStart, gi));
      resetLine(gi);
      lineWidth = gw;
      lineMaxHeight = g.height > lineHeight ? g.height : lineHeight;
      if (g.breakable) { lastBreakable = gi; widthAtBreak = lineWidth; heightAtBreak = lineMaxHeight; }
      if (g.forceBreak) { visualLines.push(makeVL(lineWidth, lineMaxHeight, lineStart, gi + 1)); resetLine(gi + 1); }
      continue;
    }

    if (newWidth > maxWidth && gi === lineStart && gi + 1 < paraGlyphs.length) {
      visualLines.push(makeVL(newWidth, g.height > lineHeight ? g.height : lineHeight, gi, gi + 1));
      resetLine(gi + 1);
      continue;
    }

    lineWidth = newWidth;
    if (g.height > lineMaxHeight) lineMaxHeight = g.height;
    if (g.breakable) { lastBreakable = gi; widthAtBreak = lineWidth; heightAtBreak = lineMaxHeight; }
    if (g.forceBreak) { visualLines.push(makeVL(lineWidth, lineMaxHeight, lineStart, gi + 1)); resetLine(gi + 1); continue; }
  }

  if (lineStart <= paraGlyphs.length - 1) {
    visualLines.push(makeVL(lineWidth, lineMaxHeight, lineStart, paraGlyphs.length));
  }
  if (visualLines.length === 0) {
    visualLines.push(makeVL(0, lineHeight, 0, 0));
  }

  return visualLines;
}

// ─── Coordinate mapping (block-relative) ────────────────────────────────────

/**
 * 找到 blockGlyphs 中 blockOffsetFrom >= from 的第一个索引（左边界）。
 */
function findGlyphStartIndex(blockGlyphs: BlockGlyph[], from: number): number {
  let lo = 0, hi = blockGlyphs.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (blockGlyphs[mid].blockOffsetFrom < from) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/**
 * 找到 blockGlyphs 中 blockOffsetFrom >= to 的第一个索引（右边界，不包含）。
 */
function findGlyphEndIndex(blockGlyphs: BlockGlyph[], to: number): number {
  let lo = 0, hi = blockGlyphs.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (blockGlyphs[mid].blockOffsetFrom < to) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/**
 * 在指定 visual line 中根据 x 坐标查找字符的 block-relative offset。
 */
export function getNewChar_BlockOffsetIndex(
  block: Block,
  visualLine_blockOffsetIndex: number,
  x: number,
): number {
  const blockGlyphs = collectGlyphsWithBlockOffset(block);
  const allBVL = collectAllVisualLinesWithBlockOffset(block);
  const bvl = allBVL[visualLine_blockOffsetIndex];
  if (!bvl) return 0;

  const startGi = findGlyphStartIndex(blockGlyphs, bvl.blockOffsetFrom);
  const endGi = findGlyphEndIndex(blockGlyphs, bvl.blockOffsetTo);

  let accum = 0;
  for (let gi = startGi; gi < endGi; gi++) {
    const g = blockGlyphs[gi];
    const gw = glyphFullWidth(g.glyph);
    const mid = accum + gw / 2;
    if (x <= mid) return g.blockOffsetFrom;
    accum += gw;
  }

  return bvl.blockOffsetTo;
}

/**
 * 根据 block-relative 字符偏移，返回该字符在 block 内的 visual line 索引和 x 坐标。
 */
export function coordsAtChar_blockOffsetIndex(
  block: Block,
  char_blockOffsetIndex: number,
  affinity: 'forward' | 'backward' = 'forward',
): { visualLine: number; char_vlPosIndex: number } {
  const blockGlyphs = collectGlyphsWithBlockOffset(block);
  const allBVL = collectAllVisualLinesWithBlockOffset(block);

  for (let vli = 0; vli < allBVL.length; vli++) {
    const bvl = allBVL[vli];

    const isLastVl = vli === allBVL.length - 1;
    const nextBvl = isLastVl ? undefined : allBVL[vli + 1];
    const hasGap = !nextBvl || nextBvl.blockOffsetFrom > bvl.blockOffsetTo;
    const upperCheck = affinity === 'backward'
      ? char_blockOffsetIndex <= bvl.blockOffsetTo
      : (hasGap ? char_blockOffsetIndex <= bvl.blockOffsetTo : char_blockOffsetIndex < bvl.blockOffsetTo);
    if (char_blockOffsetIndex >= bvl.blockOffsetFrom && (upperCheck || isLastVl)) {
      const startGi = findGlyphStartIndex(blockGlyphs, bvl.blockOffsetFrom);
      const endGi = findGlyphEndIndex(blockGlyphs, bvl.blockOffsetTo);

      let x = 0;
      for (let gi = startGi; gi < endGi; gi++) {
        const bg = blockGlyphs[gi];
        if (char_blockOffsetIndex <= bg.blockOffsetFrom) break;
        x += glyphFullWidth(bg.glyph);
      }
      return { visualLine: vli, char_vlPosIndex: x };
    }
  }
  return { visualLine: 0, char_vlPosIndex: 0 };
}

export function clearMeasureCache() {
  charWidthCache.clear();
  inlineMathWidthCache.clear();
}
