import { EditorFontManager } from "./EditorFont";
import type { Chunk, Segment } from "./parsers/types";
import { tokenizeInline, type InlineToken } from "./micromarkTokenize";

// ─── 内部工具类型与辅助函数 ────────────────────────────────────────────────────

/** segment 边界条目类型 */
type RawMatchEntry = {
  from: number;
  to: number;
  type: string;
  cssClass: string;
  segType?: "inline-math" | "inline-image" | "inline-code";
  dataAttrs?: Record<string, string>;
  /** image token 的 labelText 位置（paragraph-relative） */
  labelText?: { from: number; to: number };
  /** image token 的 resourceDestination 位置（paragraph-relative） */
  resourceDestination?: { from: number; to: number };
};

/** 去除重叠匹配，保留排在前面的（贪心）。要求入参已按 from 升序排列。 */
function removeOverlapping<T extends { from: number; to: number }>(matches: T[]): T[] {
  const result: T[] = [];
  let lastEnd = -1;
  for (const m of matches) {
    if (m.from >= lastEnd) {
      result.push(m);
      lastEnd = m.to;
    }
  }
  return result;
}

/** 从 micromark tokens 中提取 segment 级边界（codeText / mathText / image） */
function extractSegmentBoundaries(tokens: InlineToken[], paraText: string): RawMatchEntry[] {
  const raw: RawMatchEntry[] = [];
  for (const tok of tokens) {
    if (tok.type === "codeText") {
      raw.push({ from: tok.from, to: tok.to, type: "inline-code", cssClass: "tok-monospace", segType: "inline-code" });
    } else if (tok.type === "mathText") {
      raw.push({ from: tok.from, to: tok.to, type: "inline-math", cssClass: "tok-monospace", segType: "inline-math" });
    } else if (tok.type === "image") {
      // 块级图片（整行只有该图片）由 block-level image widget 渲染，不参与 inline 解析
      const imgText = paraText.substring(tok.from, tok.to);
      if (paraText.trim() !== imgText) {
        raw.push({ from: tok.from, to: tok.to, type: "inline-image", cssClass: "cm-image-link", segType: "inline-image", labelText: tok.labelText, resourceDestination: tok.resourceDestination });
      }
    }
  }
  raw.sort((a, b) => a.from - b.from);
  return removeOverlapping(raw);
}

/** 从 micromark tokens 中提取 text-run 内部样式匹配（段落坐标偏移转为 segment-relative） */
function extractStyleMatches(
  tokens: InlineToken[],
  runFrom: number,
  runTo: number,
  paraText: string,
): { from: number; to: number; type: string; cssClass: string; dataAttrs?: Record<string, string> }[] {
  const matches: { from: number; to: number; type: string; cssClass: string; dataAttrs?: Record<string, string> }[] = [];

  for (const tok of tokens) {
    // 只处理落在 [runFrom, runTo) 范围内的 token
    if (tok.from < runFrom || tok.to > runTo) continue;
    const relFrom = tok.from - runFrom;
    const relTo = tok.to - runFrom;

    switch (tok.type) {
      case "strong":
        matches.push({ from: relFrom, to: relTo, type: "strong", cssClass: "tok-strong" });
        break;
      case "emphasis":
        matches.push({ from: relFrom, to: relTo, type: "emphasis", cssClass: "tok-emphasis" });
        break;
      case "strong-emphasis":
        matches.push({ from: relFrom, to: relTo, type: "strong-emphasis", cssClass: "tok-strong tok-emphasis" });
        break;
      case "strikethrough":
        matches.push({ from: relFrom, to: relTo, type: "strikethrough", cssClass: "tok-strikethrough" });
        break;
      case "characterEscape":
        // 反斜杠部分浅色显示（只标记 \ 这一个字符）
        matches.push({ from: relFrom, to: relFrom + 1, type: "escape-backslash", cssClass: "tok-escape-backslash" });
        break;
      case "link": {
        // 拆分为 bracket / title / url 子 chunk
        const labelText = tok.labelText;
        const resDest = tok.resourceDestination;
        if (labelText && resDest) {
          const url = paraText.substring(resDest.from, resDest.to);
          // [
          matches.push({ from: relFrom, to: relFrom + 1, type: "link-bracket", cssClass: "tok-link-bracket" });
          // title
          matches.push({
            from: labelText.from - runFrom,
            to: labelText.to - runFrom,
            type: "link-title",
            cssClass: "tok-link-title",
            dataAttrs: { href: url },
          });
          // ](
          matches.push({
            from: labelText.to - runFrom,
            to: labelText.to - runFrom + 2,
            type: "link-bracket",
            cssClass: "tok-link-bracket",
          });
          // url
          matches.push({
            from: resDest.from - runFrom,
            to: resDest.to - runFrom,
            type: "link-url",
            cssClass: "tok-link-url",
          });
          // )
          matches.push({
            from: relTo - 1,
            to: relTo,
            type: "link-bracket",
            cssClass: "tok-link-bracket",
          });
        }
        break;
      }
      default:
        break;
    }
  }

  return matches;
}

// ─── 公开解析函数 ────────────────────────────────────────────────────────────

/**
 * 将一段段落文本解析为 Segment 列表。
 *
 * 层级：Paragraph → Segment → Chunk → Glyph
 *
 * 每个 Segment 是一个语义功能单元：
 * - `text-run`    连续的普通/格式化文本，内部按样式分出多个 Chunk
 * - `inline-code` 行内代码，单个 Chunk（等宽字体）
 * - `inline-math` 行内公式，三个 Chunk（标点+内容+标点），附带 latex 字段
 * - `inline-image` 行内图片，单个 Chunk 显示源码，附带 resolvedUrl 字段
 */
export function parseSegments(
  paraText: string,
  _paraFrom: number,
  options?: {
    isCode?: boolean;
    font?: string;
    monoFont?: string;
  },
): Segment[] {
  const font = options?.font ?? EditorFontManager.getInstance().createFontStyle("base").font;
  const monoFont = options?.monoFont ?? EditorFontManager.getInstance().createFontStyle("mono").font;

  // 代码块内的段落：整行作为一个 text-run segment，单个 chunk
  if (options?.isCode) {
    const chunk: Chunk = {
      segmentOffsetFrom: 0,
      segmentOffsetTo: paraText.length,
      type: "text",
      cssClass: "",
      text: paraText,
      font,
      glyphs: [],
      segmentType: "text-run",
    };
    return [{
      type: "text-run",
      paraphOffsetFrom: 0,
      paraphOffsetTo: paraText.length,
      text: paraText,
      chunks: [chunk],
    }];
  }

  // 使用 micromark 进行源码级 tokenize
  const tokens = tokenizeInline(paraText);

  // 提取 segment 级边界（codeText / mathText / image）
  const segmentBoundaries = extractSegmentBoundaries(tokens, paraText);

  const segments: Segment[] = [];
  let cursor = 0; // 相对于 paraText 的光标

  /**
   * 将 [runFrom, runTo) 这段普通文本区间解析为含内部样式 chunk 的 Chunk[]。
   * 内部样式包括 strong/emphasis/strikethrough/link/escape，相互不重叠的部分保持为纯文本 chunk。
   * Chunk 位置为 segment-relative（0-based within segment text）。
   */
  const buildTextRunChunks = (runFrom: number, runTo: number): Chunk[] => {
    const runText = paraText.substring(runFrom, runTo);

    type StyleMatch = { from: number; to: number; type: string; cssClass: string; dataAttrs?: Record<string, string> };
    // 从 micromark tokens 中提取落在此 text-run 范围内的样式
    const styleMatches: StyleMatch[] = extractStyleMatches(tokens, runFrom, runTo, paraText);

    // 检测列表标记（无序/有序）并赋予样式
    const listMarkerMatch = paraText.match(/^(\s*)([-*+]|\d+\.)\s/);
    if (listMarkerMatch) {
      const markerStart = listMarkerMatch[1].length;
      const markerEnd = markerStart + listMarkerMatch[2].length;
      if (markerStart >= runFrom && markerEnd <= runTo) {
        const isOrdered = /^\d+\.$/.test(listMarkerMatch[2]);
        styleMatches.push({
          from: markerStart - runFrom,
          to: markerEnd - runFrom,
          type: isOrdered ? "list-number" : "bullet-mark",
          cssClass: isOrdered ? "cm-list-number" : "cm-bullet-mark",
        });
      }
    }

    // 检测任务复选框 [ ] 或 [x]，仅在段落为任务列表项时匹配
    const taskMatch = paraText.match(/^((?:>\s?)*\s*(?:[-*+]|\d+\.)\s+)\[[ xX]\]/);
    if (taskMatch) {
      const checkboxStartInPara = taskMatch[1].length;
      const checkboxEndInPara = checkboxStartInPara + 3;
      if (checkboxStartInPara >= runFrom && checkboxEndInPara <= runTo) {
        const checkboxChar = paraText[checkboxStartInPara + 1];
        const isChecked = checkboxChar === 'x' || checkboxChar === 'X';
        styleMatches.push({
          from: checkboxStartInPara - runFrom,
          to: checkboxEndInPara - runFrom,
          type: "task-checkbox",
          cssClass: isChecked ? "cm-task-checkbox cm-task-checked" : "cm-task-checkbox",
        });
      }
    }

    styleMatches.sort((a, b) => a.from - b.from || b.to - a.to);
    const mergedStyles = removeOverlapping(styleMatches);

    const chunks: Chunk[] = [];
    let pos = 0; // 相对于 runText (= segment text) 的光标

    const pushPlain = (localFrom: number, localTo: number) => {
      if (localFrom >= localTo) return;
      chunks.push({
        segmentOffsetFrom: localFrom,
        segmentOffsetTo: localTo,
        type: "text",
        cssClass: "",
        text: runText.substring(localFrom, localTo),
        font,
        glyphs: [],
        segmentType: "text-run",
      });
    };

    for (const sm of mergedStyles) {
      // sm.from/to 已经是 segment-relative（0-based in runText）
      pushPlain(pos, sm.from);
      chunks.push({
        segmentOffsetFrom: sm.from,
        segmentOffsetTo: sm.to,
        type: sm.type,
        cssClass: sm.cssClass,
        text: runText.substring(sm.from, sm.to),
        font,
        glyphs: [],
        segmentType: "text-run",
        dataAttrs: sm.dataAttrs,
      });
      pos = sm.to;
    }
    pushPlain(pos, runText.length);

    // 整个区间没有任何内部样式时，产生单个纯文本 chunk
    if (chunks.length === 0) {
      chunks.push({
        segmentOffsetFrom: 0,
        segmentOffsetTo: runText.length,
        type: "text",
        cssClass: "",
        text: runText,
        font,
        glyphs: [],
        segmentType: "text-run",
      });
    }
    return chunks;
  };

  for (const boundary of segmentBoundaries) {
    // boundary.from/to 是 paragraph-relative (0-based)
    const localFrom = boundary.from;
    const localTo = boundary.to;

    // 把 boundary 之前的间隙文本打包为 text-run segment
    if (cursor < localFrom) {
      segments.push({
        type: "text-run",
        paraphOffsetFrom: cursor,
        paraphOffsetTo: localFrom,
        text: paraText.substring(cursor, localFrom),
        chunks: buildTextRunChunks(cursor, localFrom),
      });
    }

    const segText = paraText.substring(localFrom, localTo);
    const segLen = segText.length;

    if (boundary.segType === "inline-math") {
      // Chunk 位置为 segment-relative
      const openPunct: Chunk = {
        segmentOffsetFrom: 0,
        segmentOffsetTo: 1,
        type: "punctuation",
        cssClass: "tok-punctuation",
        text: "$",
        font,
        glyphs: [],
        segmentType: "inline-math",
      };
      const contentChunk: Chunk = {
        segmentOffsetFrom: 1,
        segmentOffsetTo: segLen - 1,
        type: "inline-math-content",
        cssClass: "tok-monospace",
        text: segText.substring(1, segLen - 1),
        font,
        glyphs: [],
        segmentType: "inline-math",
      };
      const closePunct: Chunk = {
        segmentOffsetFrom: segLen - 1,
        segmentOffsetTo: segLen,
        type: "punctuation",
        cssClass: "tok-punctuation",
        text: "$",
        font,
        glyphs: [],
        segmentType: "inline-math",
      };
      const renderChunk: Chunk = {
        segmentOffsetFrom: segLen,
        segmentOffsetTo: segLen,
        type: "inline-math-render",
        cssClass: "",
        text: "",
        font,
        glyphs: [],
        segmentType: "inline-math",
      };
      segments.push({
        type: "inline-math",
        paraphOffsetFrom: localFrom,
        paraphOffsetTo: localTo,
        text: segText,
        chunks: [openPunct, contentChunk, closePunct, renderChunk],
        latex: contentChunk.text.trim(),
      });
    } else if (boundary.segType === "inline-image") {
      // 使用 micromark 解析的 labelText / resourceDestination 提取 URL 并拆分子 chunk
      const rawUrl = boundary.resourceDestination
        ? paraText.substring(boundary.resourceDestination.from, boundary.resourceDestination.to)
        : "";

      const chunks: Chunk[] = [];
      if (boundary.labelText && boundary.resourceDestination) {
        // 拆分为 ! / [ / alt / ]( / url / ) 子 chunk
        const lblFrom = boundary.labelText.from - localFrom;
        const lblTo = boundary.labelText.to - localFrom;
        const resFrom = boundary.resourceDestination.from - localFrom;
        const resTo = boundary.resourceDestination.to - localFrom;

        // !
        chunks.push({ segmentOffsetFrom: 0, segmentOffsetTo: 1, type: "punctuation", cssClass: "tok-image-excl", text: "!", font, glyphs: [], segmentType: "inline-image" });
        // [
        chunks.push({ segmentOffsetFrom: 1, segmentOffsetTo: 2, type: "punctuation", cssClass: "tok-image-bracket", text: "[", font, glyphs: [], segmentType: "inline-image" });
        // alt text
        chunks.push({ segmentOffsetFrom: lblFrom, segmentOffsetTo: lblTo, type: "image-alt", cssClass: "tok-image-alt", text: segText.substring(lblFrom, lblTo), font, glyphs: [], segmentType: "inline-image" });
        // ](
        chunks.push({ segmentOffsetFrom: lblTo, segmentOffsetTo: lblTo + 2, type: "punctuation", cssClass: "tok-image-bracket", text: "](", font, glyphs: [], segmentType: "inline-image" });
        // url
        chunks.push({ segmentOffsetFrom: resFrom, segmentOffsetTo: resTo, type: "image-url", cssClass: "tok-image-url", text: segText.substring(resFrom, resTo), font, glyphs: [], segmentType: "inline-image" });
        // )
        chunks.push({ segmentOffsetFrom: segLen - 1, segmentOffsetTo: segLen, type: "punctuation", cssClass: "tok-image-bracket", text: ")", font, glyphs: [], segmentType: "inline-image" });
      } else {
        // fallback: 单个 source chunk
        chunks.push({ segmentOffsetFrom: 0, segmentOffsetTo: segLen, type: "inline-image", cssClass: "cm-image-link", text: segText, font, glyphs: [], segmentType: "inline-image" });
      }

      // render chunk（图片预览占位）
      chunks.push({
        segmentOffsetFrom: segLen,
        segmentOffsetTo: segLen,
        type: "inline-image-render",
        cssClass: "",
        text: "",
        font,
        glyphs: [],
        segmentType: "inline-image",
      });

      segments.push({
        type: "inline-image",
        paraphOffsetFrom: localFrom,
        paraphOffsetTo: localTo,
        text: segText,
        chunks,
        resolvedUrl: rawUrl,
      });
    } else if (boundary.segType === "inline-code") {
      const openPunct: Chunk = {
        segmentOffsetFrom: 0,
        segmentOffsetTo: 1,
        type: "punctuation",
        cssClass: "tok-punctuation",
        text: "`",
        font,
        glyphs: [],
        segmentType: "inline-code",
      };
      const contentChunk: Chunk = {
        segmentOffsetFrom: 1,
        segmentOffsetTo: segLen - 1,
        type: "inline-code",
        cssClass: "tok-monospace",
        text: segText.substring(1, segLen - 1),
        font: monoFont,
        glyphs: [],
        segmentType: "inline-code",
      };
      const closePunct: Chunk = {
        segmentOffsetFrom: segLen - 1,
        segmentOffsetTo: segLen,
        type: "punctuation",
        cssClass: "tok-punctuation",
        text: "`",
        font,
        glyphs: [],
        segmentType: "inline-code",
      };
      segments.push({
        type: "inline-code",
        paraphOffsetFrom: localFrom,
        paraphOffsetTo: localTo,
        text: segText,
        chunks: [openPunct, contentChunk, closePunct],
      });
    }

    cursor = localTo;
  }

  // 末尾剩余文本作为 text-run
  if (cursor < paraText.length) {
    segments.push({
      type: "text-run",
      paraphOffsetFrom: cursor,
      paraphOffsetTo: paraText.length,
      text: paraText.substring(cursor),
      chunks: buildTextRunChunks(cursor, paraText.length),
    });
  }

  // 保底：空段落（或整行无任何匹配的段落）产生一个空 text-run
  if (segments.length === 0) {
    segments.push({
      type: "text-run",
      paraphOffsetFrom: 0,
      paraphOffsetTo: paraText.length,
      text: paraText,
      chunks: [{
        segmentOffsetFrom: 0,
        segmentOffsetTo: paraText.length,
        type: "text",
        cssClass: "",
        text: paraText,
        font,
        glyphs: [],
        segmentType: "text-run",
      }],
    });
  }

  return segments;
}

/**
 * 将 Segment 列表展开为扁平的 Chunk 列表。
 * 保持向后兼容，供 TextMeasure 等模块直接消费。
 */
export function flattenSegmentsToChunks(segments: Segment[]): Chunk[] {
  const result: Chunk[] = [];
  for (const seg of segments) {
    for (const chunk of seg.chunks) {
      result.push(chunk);
    }
  }
  return result;
}

/**
 * 向后兼容入口：解析段落文本并直接返回扁平 Chunk 列表。
 * 内部委托给 parseSegments + flattenSegmentsToChunks。
 */
export function parseInlineChunks(
  paraText: string,
  paraFrom: number,
  options?: {
    isCode?: boolean;
    font?: string;
    monoFont?: string;
  },
): Chunk[] {
  return flattenSegmentsToChunks(parseSegments(paraText, paraFrom, options));
}

export function getParagraphCssClasses(paraText: string): string[] {
  const classes: string[] = [];
  const headingMatch = paraText.match(/^(#{1,6})\s/);
  if (headingMatch) {
    const level = headingMatch[1].length;
    classes.push("cm-heading-line", `cm-heading-${level}`);
  }
  if (/^>\s?/.test(paraText)) {
    classes.push("cm-blockquote-line");
  }
  if (/^(?:---+|___+|\*\*\*+)\s*$/.test(paraText)) {
    classes.push("cm-hr-line");
  }
  const listMatch = paraText.match(/^(\s*)([-*+]|\d+\.)\s/);
  if (listMatch) {
    classes.push("cm-list-item");
  }
  return classes;
}

