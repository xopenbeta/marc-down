
export interface Glyph {
  chunkOffsetIndex: number;
  chunkOffsetFrom: number;
  chunkOffsetTo: number;
  width: number;
  height: number;
  breakable: boolean;
  forceBreak: boolean;
  /** 左侧额外宽度（如 CSS padding/border 补偿） */
  padLeft?: number;
  /** 右侧额外宽度（如 CSS padding/border 补偿） */
  padRight?: number;
}

export interface Chunk {
  segmentOffsetFrom: number;
  segmentOffsetTo: number;
  type: string;
  cssClass: string;
  text: string;
  font: string;
  renderWidth?: number;
  renderHeight?: number;
  glyphs: Glyph[];
  /** 所属 segment 的类型，供渲染侧区分 */
  segmentType?: string;
  /** 可选的 data-* 属性，渲染时会设置到对应 DOM 元素上 */
  dataAttrs?: Record<string, string>;
}

/**
 * Segment 是语义功能单元，介于 Paragraph 和 Chunk 之间。
 *
 * - `text-run`：一段连续的普通文本（内部按样式分出多个 Chunk，如 strong/emphasis 等）
 * - `inline-code`：行内代码（单个 Chunk，等宽字体）
 * - `inline-math`：行内公式（多个 Chunk：标点 + 内容 + 标点），附带 latex / renderWidth / renderHeight
 * - `inline-image`：行内图片链接（单个 Chunk 显示源码），附带 resolvedUrl / renderWidth / renderHeight
 */
export interface Segment {
  type: "text-run" | "inline-code" | "inline-math" | "inline-image";
  paraphOffsetFrom: number;
  paraphOffsetTo: number;
  text: string;
  chunks: Chunk[];
  /** 行内公式的 LaTeX 内容（去掉首尾 $），仅 inline-math 有效 */
  latex?: string;
  /** 行内图片的图片 URL（原始，未 resolve），仅 inline-image 有效 */
  resolvedUrl?: string;
  /** 渲染结果宽度（px），inline-math / inline-image 填充后有效 */
  renderWidth?: number;
  /** 渲染结果高度（px），inline-math / inline-image 填充后有效 */
  renderHeight?: number;
}

export interface Paragraph {
  /** 段落在文档中的行号（0-based） */
  documentOffsetIndex: number;
  /** 段落在文档中的起始位置 */
  documentPosFrom: number;
  /** 段落在文档中的结束位置 */
  documentPosTo: number;
  /** 段落在 block 内的起始偏移 */
  blockOffsetFrom: number;
  /** 段落在 block 内的结束偏移 */
  blockOffsetTo: number;
  /** 段落文本内容（构建时填充，不再需要 sliceContent） */
  text: string;
  /** 所属 block 的反向引用（parseDocumentToBlocks 后填充） */
  block: Block | null;
  /** 段落的 segment 列表，chunks 由 measureBlock 从 segments 中展开，无需外部传入 */
  segments: Segment[];
  lineHeight: number;
  /** 段落的 visual lines，由 layoutBlock 计算并填充 */
  visualLines?: VisualLine[];
}

export interface VisualLine {
  width: number;
  height: number;
  paraphOffsetFrom: number;
  paraphOffsetTo: number;
}

/**
 * Block 是统一的块数据单元，所有字段扁平化。
 * 运行时通过 type 判断使用哪些字段。
 */
export interface Block {
  // 公共结构字段
  type: string;
  id: string;
  documentPosFrom: number;
  documentPosTo: number;

  // 测量/布局字段（渲染阶段填充）
  element?: HTMLDivElement;
  paragraphs?: Paragraph[];
  height?: number;
  widgetHeight?: number;
  y?: number;
  cachedWidgetEl?: HTMLElement;

  // heading 特有
  level?: 1 | 2 | 3 | 4 | 5 | 6;

  // math 特有
  latex?: string;

  // html 特有
  html?: string;

  // image 特有
  url?: string;
  alt?: string;

  // code 特有
  lang?: string;

  // mermaid 特有
  code?: string;
}

export interface Change {
  documentPosFrom: number;
  documentPosTo: number;
  inserted: string;
  removed: string;
}

export class Document {
  private _content = "";
  private _paragraphs: Paragraph[] = [];
  blocks: Block[] = [];

  /** 自上次 reconcile 以来最早被修改的段落索引（用于增量 block 解析） */
  dirtyFromIndex = 0;

  // ─── Public content API ───

  get content(): string {
    return this._content;
  }

  get length(): number {
    return this._content.length;
  }

  setContent(text: string) {
    this._content = text;
    this.dirtyFromIndex = 0;
    this.rebuildParagraphs();
  }

  toString(): string {
    return this._content;
  }

  sliceContent(documentPosFrom: number, documentPosTo: number): string {
    if (documentPosFrom >= documentPosTo) return "";
    return this._content.slice(documentPosFrom, Math.min(documentPosTo, this._content.length));
  }

  replaceRange(documentPosFrom: number, documentPosTo: number, insert: string): Change {
    // 在重建段落前，计算受影响的段落索引用于增量解析
    if (this._paragraphs.length > 0) {
      const affectedIdx = this.getParagraphAtPos(Math.min(documentPosFrom, this._content.length)).documentOffsetIndex;
      this.dirtyFromIndex = Math.min(this.dirtyFromIndex, affectedIdx);
    }

    const removed = this._content.slice(documentPosFrom, documentPosTo);
    this._content = this._content.slice(0, documentPosFrom) + insert + this._content.slice(documentPosTo);
    this.rebuildParagraphs();

    const change: Change = { documentPosFrom, documentPosTo, inserted: insert, removed };
    return change;
  }

  insertText(documentPosIndex: number, text: string): Change {
    return this.replaceRange(documentPosIndex, documentPosIndex, text);
  }

  deleteRange(documentPosFrom: number, documentPosTo: number): Change {
    return this.replaceRange(documentPosFrom, documentPosTo, "");
  }

  // ─── Paragraph index system ───

  /** 重建段落索引，只 split 一次 */
  private rebuildParagraphs(): void {
    const lines = this._content.split("\n");
    this._paragraphs = new Array(lines.length);
    let pos = 0;
    for (let i = 0; i < lines.length; i++) {
      this._paragraphs[i] = {
        documentOffsetIndex: i,
        documentPosFrom: pos,
        documentPosTo: pos + lines[i].length,
        blockOffsetFrom: 0,
        blockOffsetTo: 0,
        text: lines[i],
        block: null,
        segments: [],
        lineHeight: 0,
      };
      pos += lines[i].length + 1;
    }
  }

  /** 获取所有段落实例 */
  get paragraphs(): Paragraph[] {
    return this._paragraphs;
  }

  // ─── paraph-level API ───

  get paraphsLength(): number {
    return this._paragraphs.length;
  }

  /** Get paragraph by 0-based index（返回同一实例） */
  getParagraph(documentOffsetIndex: number): Paragraph {
    if (documentOffsetIndex < 0 || documentOffsetIndex >= this._paragraphs.length) {
      throw new RangeError(`Line ${documentOffsetIndex} out of range [0, ${this._paragraphs.length - 1}]`);
    }
    return this._paragraphs[documentOffsetIndex];
  }

  /** Get the paragraph containing the given character position（二分查找，返回同一实例） */
  getParagraphAtPos(documentPosIndex: number): Paragraph {
    const paras = this._paragraphs;
    let lo = 0;
    let hi = paras.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (paras[mid].documentPosTo < documentPosIndex) {
        lo = mid + 1;
      } else {
        hi = mid;
      }
    }
    return paras[lo];
  }
}
