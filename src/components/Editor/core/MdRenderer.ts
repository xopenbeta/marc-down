import type { Paragraph } from "./parsers/types";
import type { Document } from "./parsers/types";
import { parseSegments, getParagraphCssClasses } from "./InlineParser";
import { EditorFontManager } from "./EditorFont";
import { measureBlock, layoutBlock, coordsAtChar_blockOffsetIndex, getNewChar_BlockOffsetIndex, collectAllVisualLinesWithBlockOffset, collectAllVisualLines, glyphFullWidth } from "./TextMeasure";
import type { Block, Chunk, Glyph, Segment, VisualLine } from "./parsers/types";
import { parseDocumentToBlocks } from "./parsers";
import { resolveImageUrl } from "./parsers/image";
import katex from "katex";
import { createCopyCodeButton, createLangSelectorButton } from "./widgets";
import { highlightLines } from "./CodeHighlighter";
import type { HighlightStyleChunk as HighlightChunk } from "./CodeHighlighter";
import { setContainerWidth as setCacheContainerWidth } from "./cache";


const WIDGET_LOADING_HEIGHT = 60;

// 实时计算 block 的 totalChars（从 block 的块范围推导）
function getBlockTotalChars(block: Block): number {
  return block.documentPosTo - block.documentPosFrom;
}

// 实时计算 block 的 totalHeight（从各段落的 visualLines 推导）
function getBlockTotalHeight(block: Block): number {
  const bvls = collectAllVisualLinesWithBlockOffset(block);
  let total = 0;
  for (const bvl of bvls) total += bvl.vl.height;
  return total;
}

// 兼容层：直接返回段落实例上的 text 字段
function getParagraphText(_doc: Document, para: Paragraph): string {
  return para.text;
}

export class MdRenderer {
  private doc: Document;
  private container: HTMLDivElement;
  private containerWidth = 800;
  private baseDir = "";
  private showSpaceDots = false;
  private debugTopLabels = false;
  private debugBackground = false;
  private debugUnderline = false;
  private debugGlyphOverlay = false;
  private readonly fm = EditorFontManager.getInstance();

  onContentChanged: (() => void) | null = null;
  onAsyncWidgetChanged: ((reason?: string) => void) | null = null;

  constructor(
    doc: Document,
    container: HTMLDivElement,
  ) {
    this.doc = doc;
    this.container = container;
  }

  setBaseDir(dir: string) {
    this.baseDir = dir;
  }

  setContainerWidth(width: number) {
    this.containerWidth = width;
    setCacheContainerWidth(width);
  }

  setShowSpaceDots(show: boolean) {
    this.showSpaceDots = show;
  }

  setDebugTopLabels(show: boolean) {
    this.debugTopLabels = show;
  }

  setDebugBackground(show: boolean) {
    this.debugBackground = show;
  }

  setDebugUnderline(show: boolean) {
    this.debugUnderline = show;
  }

  setDebugGlyphOverlay(show: boolean) {
    this.debugGlyphOverlay = show;
  }

  getContentWidth(): number {
    return this.containerWidth;
  }

  getBlocks(): Block[] {
    return this.doc.blocks;
  }

  reconcile(): void {
    const rt0 = performance.now();

    const oldBlocks = this.doc.blocks;
    const nowBlocks = parseDocumentToBlocks(this.doc);
    const rt1 = performance.now();

    const newBlocks: Block[] = [];

    const oldMap = new Map<string, Block[]>();
    for (const b of oldBlocks) {
      const arr = oldMap.get(b.id) ?? [];
      arr.push(b);
      oldMap.set(b.id, arr);
    }
    const rt2 = performance.now();

    let createBlockCount = 0;
    let reuseBlockCount = 0;
    for (let i = 0; i < nowBlocks.length; i++) {
      const nowBlock = nowBlocks[i];
      const oldBlockArr = oldMap.get(nowBlock.id);
      const oldBlockWithSameId = oldBlockArr?.shift();

      if (oldBlockWithSameId) {
        // 复用块：保留已有 element，更新位置
        oldBlockWithSameId.documentPosFrom = nowBlock.documentPosFrom;
        oldBlockWithSameId.documentPosTo = nowBlock.documentPosTo;
        newBlocks.push(oldBlockWithSameId);
        reuseBlockCount++;
      } else {
        // 新块：createBlock 只做测量，不构建 DOM
        const newBlock = this.createBlock(nowBlock, i);
        // 回退：index+type 相同时复用旧 widget DOM 和高度
        const oldAtSameIndex = oldBlocks[i];
        if (oldAtSameIndex && oldAtSameIndex.type === nowBlock.type
            && this.blockHasWidget(nowBlock.type) && oldAtSameIndex.element) {
          const widgetEl = this.extractWidgetEl(oldAtSameIndex.element);
          if (widgetEl) {
            newBlock.cachedWidgetEl = widgetEl;
            newBlock.widgetHeight = oldAtSameIndex.widgetHeight ?? WIDGET_LOADING_HEIGHT;
          }
        }
        newBlocks.push(newBlock);
        createBlockCount++;
      }
    }
    const rt3 = performance.now();

    this.doc.blocks = newBlocks;

    const heights = this.getBlockHeights();
    let y = 0;
    for (let i = 0; i < this.doc.blocks.length; i++) {
      this.doc.blocks[i].y = y;
      y += heights[i];
    }
    const rt4 = performance.now();

    console.log(
      `【测试】[reconcile] parseBlocks=${(rt1 - rt0).toFixed(2)}ms | ` +
      `buildOldMap=${(rt2 - rt1).toFixed(2)}ms | ` +
      `createBlocks=${(rt3 - rt2).toFixed(2)}ms (created=${createBlockCount}, reused=${reuseBlockCount}) | ` +
      `computeY=${(rt4 - rt3).toFixed(2)}ms | ` +
      `total=${(rt4 - rt0).toFixed(2)}ms | blockCount=${newBlocks.length}`
    );
  }

  getBlockHeights(): number[] {
    return this.doc.blocks.map(b => (b.height ?? 0) + (b.widgetHeight ?? 0));
  }

  blockHasWidget(type: string): boolean {
    return type === "math" || type === "html" || type === "table" || type === "image" || type === "mermaid";
  }

  isBlockFoldable(type: string): boolean {
    return this.blockHasWidget(type) || type === "code";
  }

  private isBlockCollapsed(block: Block): boolean {
    if (!this.isBlockFoldable(block.type)) return false;
    const paragraph = this.doc.getParagraphAtPos(block.documentPosFrom);
    return paragraph.text.endsWith(" ");
  }

  private getParagraphLineHeight(paraText: string, isCode: boolean): number {
    if (isCode) return this.fm.createFontStyle("base").lineHeight;
    const headingMatch = paraText.match(/^(#{1,6})\s/);
    if (headingMatch) return this.fm.createFontStyle("heading", { level: headingMatch[1].length }).lineHeight;
    return this.fm.createFontStyle("base").lineHeight;
  }

  private getParagraphFont(paraText: string, isCode: boolean): string {
    if (isCode) return this.fm.createFontStyle("base").font;
    const headingMatch = paraText.match(/^(#{1,6})\s/);
    if (headingMatch) return this.fm.createFontStyle("heading", { level: headingMatch[1].length }).font;
    return this.fm.createFontStyle("base").font;
  }

  private getBlockPadding(blockType: string, options: { paraText?: string } = {}): { left: number; right: number } {
    if (blockType === "code" || blockType === "mermaid" || blockType === "html" || blockType === "math" || blockType === "table") {
      return { left: 8, right: 8 };
    }
    if (options.paraText && /^>\s?/.test(options.paraText)) {
      return { left: 20, right: 4 };
    }
    return { left: 0, right: 0 };
  }

  commit(from: number, to: number) {
    const ct0 = performance.now();
    const visibleElements = new Set<HTMLDivElement>();
    let builtCount = 0;
    let cachedCount = 0;

    for (let i = from; i <= to && i < this.doc.blocks.length; i++) {
      const bd = this.doc.blocks[i];

      // 按需构建 DOM：element 为 null 说明 DOM 未构建
      if (!bd.element) {
        this.buildBlockDom(bd, i);
        builtCount++;
      } else {
        cachedCount++;
      }

      bd.element!.style.top = `${bd.y ?? 0}px`;
      bd.element!.style.height = `${(bd.height ?? 0) + (bd.widgetHeight ?? 0)}px`;
      visibleElements.add(bd.element!);
      this.container.appendChild(bd.element!);
    }

    // 移除不可见块
    const children = Array.from(this.container.children) as HTMLDivElement[];
    for (const child of children) {
      if (!visibleElements.has(child)) {
        child.remove();
      }
    }

    const ct1 = performance.now();
    console.log(
      `【测试】[commit] built=${builtCount}, cached=${cachedCount}, total=${(ct1 - ct0).toFixed(2)}ms`
    );
  }

  updateDebugTopLabels() {
    if (!this.debugTopLabels) return;
    for (let i = 0; i < this.doc.blocks.length; i++) {
      const bd = this.doc.blocks[i];
      if (!bd.element || !bd.element.parentNode) continue;
      const label = bd.element.querySelector(".md-block-top-label") as HTMLDivElement | null;
      if (label) {
        label.textContent = `top: ${(bd.y ?? 0).toFixed(0)}`;
      }
    }
  }

  private createBlock(block: Block, _index: number): Block {
    // Phase 1: 准备段落数据
    const startParagraph = this.doc.getParagraphAtPos(block.documentPosFrom);
    const endParagraph = this.doc.getParagraphAtPos(block.documentPosTo);
    const isCode = block.type === "code" || block.type === "mermaid";
    const isCodeLike = isCode || block.type === "html";
    const hasWidget = this.blockHasWidget(block.type);
    const isCollapsed = this.isBlockCollapsed(block);

    // Phase 2: 填充 segments + lineHeight（直接操作 doc 段落实例）
    block.paragraphs = [];

    for (let i = startParagraph.documentOffsetIndex; i <= endParagraph.documentOffsetIndex; i++) {
      if (isCollapsed && i > startParagraph.documentOffsetIndex) break;

      const para = this.doc.getParagraph(i);
      const paraText = para.text;

      // 设置段落的 block-relative 偏移
      para.blockOffsetFrom = para.documentPosFrom - block.documentPosFrom;
      para.blockOffsetTo = para.documentPosTo - block.documentPosFrom;

      const font = this.getParagraphFont(paraText, isCodeLike);
      const monoFont = this.fm.createFontStyle("mono").font;
      const lineHeight = this.getParagraphLineHeight(paraText, isCodeLike);
      const segments = parseSegments(paraText, para.documentPosFrom, {
        isCode: isCodeLike,
        font,
        monoFont,
      });

      // 直接在实例上填充 segments 和 lineHeight
      para.segments = segments;
      para.lineHeight = lineHeight;
      block.paragraphs.push(para);
    }

    // Phase 3: 测量 + 布局（Canvas 测量，不涉及 DOM）
    const contentWidth = this.getContentWidth();
    const firstParaText = getParagraphText(this.doc, this.doc.getParagraph(startParagraph.documentOffsetIndex));
    const padding = this.getBlockPadding(block.type, { paraText: firstParaText });
    const maxWidth = isCodeLike ? Infinity : contentWidth - padding.left - padding.right;
    measureBlock(block);
    layoutBlock(block, maxWidth);

    // Phase 4: 计算精确高度
    block.height = getBlockTotalHeight(block);

    // 折叠的 widget 块，source 只占一行高度（折叠条 CSS 裁剪为单行）
    if (hasWidget && isCollapsed) {
      block.height = block.paragraphs![0].lineHeight;
    }

    // Phase 5: Widget 高度 → 固定 loading 高度（折叠时仍保留 widget）
    if (hasWidget) {
      block.widgetHeight = WIDGET_LOADING_HEIGHT;
    }

    // 不构建 DOM！element 保持 undefined
    return block;
  }

  private buildBlockDom(block: Block, index: number): void {
    // 1. 创建根元素
    const el = document.createElement("div");
    el.className = "md-block";
    el.dataset.blockIndex = String(index);
    el.dataset.type = block.type;
    el.style.position = "absolute";
    el.style.left = "0";
    el.style.right = "0";
    block.element = el;

    const startParagraph = this.doc.getParagraphAtPos(block.documentPosFrom);
    const endParagraph = this.doc.getParagraphAtPos(block.documentPosTo);
    const isCode = block.type === "code" || block.type === "mermaid";
    const isCodeLike = isCode || block.type === "html";
    const hasWidget = this.blockHasWidget(block.type);
    const isFoldable = hasWidget || isCode;
    const isCollapsed = this.isBlockCollapsed(block);

    // 2. source wrapper（如有 widget）
    let sourceWrapper: HTMLDivElement | null = null;
    if (hasWidget) {
      sourceWrapper = document.createElement("div");
      sourceWrapper.className = "md-block-source";
    }
    const blockTarget = sourceWrapper || el;

    // Scroll wrapper for source blocks (code, mermaid, html, math, table)
    const needsScroll = (isCodeLike || block.type === "math" || block.type === "table") && !isCollapsed;
    let scrollWrapper: HTMLDivElement | null = null;
    let innerWrapper: HTMLDivElement | null = null;
    if (needsScroll) {
      scrollWrapper = document.createElement("div");
      scrollWrapper.className = "cm-codeblock-scroll";
      innerWrapper = document.createElement("div");
      innerWrapper.className = "cm-codeblock-inner";
      scrollWrapper.appendChild(innerWrapper);
    }
    const paragraphTarget = innerWrapper || blockTarget;

    // 3. 代码高亮（如适用）
    let codeHighlight: HighlightChunk[][] | null = null;
    if (isCodeLike && !isCollapsed) {
      let lang: string;
      if (block.type === "code") lang = block.lang ?? "";
      else if (block.type === "mermaid") lang = "mermaid";
      else lang = "xml"; // html
      const codeText = block.type === "html"
        ? this.extractBlockContent(block)
        : this.extractCodeContent(startParagraph.documentOffsetIndex, endParagraph.documentOffsetIndex);
      codeHighlight = highlightLines(codeText, lang);
    }

    // 4. 构建段落 DOM（使用已计算好的 visualLines）
    const codeHighlightPerPara: (HighlightChunk[] | null)[] = [];
    for (let i = startParagraph.documentOffsetIndex; i <= endParagraph.documentOffsetIndex; i++) {
      if (isCollapsed && i > startParagraph.documentOffsetIndex) break;
      if (block.type === "html") {
        // HTML 块所有行都高亮
        const htmlParaIdx = i - startParagraph.documentOffsetIndex;
        codeHighlightPerPara.push(codeHighlight ? codeHighlight[htmlParaIdx] ?? null : null);
      } else {
        // 代码块跳过首尾 fence 行
        const codeParaIdx = i - startParagraph.documentOffsetIndex - 1;
        codeHighlightPerPara.push(
          codeHighlight && i > startParagraph.documentOffsetIndex && i < endParagraph.documentOffsetIndex
            ? codeHighlight[codeParaIdx] ?? null
            : null,
        );
      }
    }

    for (let pi = 0; pi < block.paragraphs!.length; pi++) {
      const paraIdx = block.paragraphs![pi].documentOffsetIndex;
      const paraText = getParagraphText(this.doc, block.paragraphs![pi]);
      const paraEl = document.createElement("div");
      paraEl.className = "cm-paragraph";
      paraEl.dataset.paragraphIndex = String(paraIdx);

      // 由 JS 直接控制段落字体，确保与 canvas 测量一致
      const paraFont = this.getParagraphFont(paraText, isCodeLike);
      const paraLineHeight = this.getParagraphLineHeight(paraText, isCodeLike);
      paraEl.style.font = paraFont;
      paraEl.style.lineHeight = `${paraLineHeight}px`;

      if (!isCodeLike) {
        const cssClasses = getParagraphCssClasses(getParagraphText(this.doc, block.paragraphs![pi]));
        for (const cls of cssClasses) paraEl.classList.add(cls);
      }

      if (isCodeLike) {
        paraEl.classList.add("cm-codeblock-line");
        if (paraIdx === startParagraph.documentOffsetIndex) {
          paraEl.classList.add("cm-codeblock-header");
          if (isCollapsed) {
            paraEl.classList.add("cm-code-collapsed");
            paraEl.classList.add("cm-codeblock-footer");
          }
        }
        if (paraIdx === endParagraph.documentOffsetIndex) paraEl.classList.add("cm-codeblock-footer");
      }

      if (block.type === "math" || block.type === "table") {
        paraEl.classList.add("cm-source-line");
        if (paraIdx === startParagraph.documentOffsetIndex) paraEl.classList.add("cm-source-header");
        if (paraIdx === endParagraph.documentOffsetIndex) paraEl.classList.add("cm-source-footer");
      }

      this.buildParagraphDom(
        paraEl,
        block.paragraphs![pi],
        block,
        codeHighlightPerPara[pi],
      );

      if (isCodeLike && pi === 0) {
        const codeText = block.type === "html"
          ? this.extractBlockContent(block)
          : this.extractCodeContent(startParagraph.documentOffsetIndex, endParagraph.documentOffsetIndex);
        if (needsScroll) {
          // Create toolbar overlay on blockTarget (outside scroll area)
          const toolbar = document.createElement("div");
          toolbar.className = "cm-codeblock-toolbar";
          toolbar.contentEditable = "false";
          toolbar.appendChild(createCopyCodeButton(codeText));
          if (block.type === "code") {
            const lang = block.lang ?? "";
            const langBtn = createLangSelectorButton(lang, (newLang) => {
              const ln = this.doc.getParagraph(startParagraph.documentOffsetIndex);
              const fenceMatch = getParagraphText(this.doc, ln).match(/^(`{3,})(.*)/);
              if (!fenceMatch) return;
              this.doc.replaceRange(ln.documentPosFrom, ln.documentPosTo, fenceMatch[1] + newLang);
              this.onContentChanged?.();
            }, this.container.parentElement as HTMLElement);
            toolbar.appendChild(langBtn);
          }
          blockTarget.appendChild(toolbar);
        } else {
          // Collapsed state: keep button in firstVline
          const firstVline = paraEl.querySelector('.cm-vline') ?? paraEl;
          firstVline.appendChild(createCopyCodeButton(codeText));
        }
      }

      // Copy button for widget blocks (math, table, image) - skip code-like (handled above)
      if (hasWidget && !isCodeLike && pi === 0) {
        if (needsScroll) {
          const toolbar = document.createElement("div");
          toolbar.className = "cm-codeblock-toolbar";
          toolbar.contentEditable = "false";
          const sourceText = this.extractBlockContent(block);
          toolbar.appendChild(createCopyCodeButton(sourceText));
          blockTarget.appendChild(toolbar);
        } else {
          paraEl.style.position = "relative";
          const sourceText = this.extractBlockContent(block);
          paraEl.appendChild(createCopyCodeButton(sourceText));
        }
      }

      paragraphTarget.appendChild(paraEl);
    }

    // Append scroll wrapper to blockTarget after all paragraphs
    if (scrollWrapper) {
      blockTarget.appendChild(scrollWrapper);

      // Custom scroll indicator (positioned on blockTarget, not inside scroll area)
      const scrollbar = document.createElement("div");
      scrollbar.className = "cm-codeblock-scrollbar";
      const thumb = document.createElement("div");
      thumb.className = "cm-codeblock-scrollbar-thumb";
      scrollbar.appendChild(thumb);
      blockTarget.appendChild(scrollbar);

      const updateScrollIndicator = () => {
        const sw = scrollWrapper!.scrollWidth;
        const cw = scrollWrapper!.clientWidth;
        if (sw <= cw) {
          scrollbar.style.display = "none";
          return;
        }
        scrollbar.style.display = "";
        const trackWidth = scrollbar.clientWidth;
        const ratio = cw / sw;
        const thumbWidth = Math.max(24, ratio * trackWidth);
        const maxLeft = trackWidth - thumbWidth;
        const scrollRatio = scrollWrapper!.scrollLeft / (sw - cw);
        thumb.style.width = `${thumbWidth}px`;
        thumb.style.left = `${scrollRatio * maxLeft}px`;
      };

      scrollWrapper.addEventListener("scroll", updateScrollIndicator, { passive: true });
      requestAnimationFrame(updateScrollIndicator);

      // Drag to scroll
      let dragStartX = 0;
      let dragStartScrollLeft = 0;
      const onDragMove = (e: MouseEvent) => {
        const sw = scrollWrapper!.scrollWidth;
        const cw = scrollWrapper!.clientWidth;
        const trackWidth = scrollbar.clientWidth;
        const ratio = cw / sw;
        const thumbWidth = Math.max(24, ratio * trackWidth);
        const maxLeft = trackWidth - thumbWidth;
        const dx = e.clientX - dragStartX;
        const scrollRange = sw - cw;
        scrollWrapper!.scrollLeft = dragStartScrollLeft + (dx / maxLeft) * scrollRange;
      };
      const onDragEnd = () => {
        document.removeEventListener("mousemove", onDragMove);
        document.removeEventListener("mouseup", onDragEnd);
      };
      thumb.addEventListener("mousedown", (e) => {
        e.preventDefault();
        e.stopPropagation();
        dragStartX = e.clientX;
        dragStartScrollLeft = scrollWrapper!.scrollLeft;
        document.addEventListener("mousemove", onDragMove);
        document.addEventListener("mouseup", onDragEnd);
      });
    }

    // 5. 折叠控件
    const foldTarget = sourceWrapper || el;
    if (isFoldable) {
      foldTarget.dataset.documentPosFrom = String(block.documentPosFrom);
      if (isCodeLike && isCollapsed) {
        foldTarget.classList.add("cm-foldable-first");
        foldTarget.classList.add("cm-foldable-collapsed");
      } else if (isCollapsed) {
        foldTarget.classList.add("cm-fold-collapsed-first");
      } else {
        foldTarget.classList.add("cm-foldable-first");
      }
    }

    if (sourceWrapper) {
      el.appendChild(sourceWrapper);
    }

    // 6. Widget 渲染（优先复用缓存的 widget DOM）
    if (hasWidget) {
      if (block.cachedWidgetEl) {
        // 用旧 widget 作为占位避免闪烁，同时异步渲染新 widget 替换它
        const placeholder = block.cachedWidgetEl;
        el.appendChild(placeholder);
        delete block.cachedWidgetEl;
        this.buildWidget(block).then(widgetEl => {
          if (!widgetEl) {
            block.widgetHeight = 0;
            placeholder.remove();
            this.onAsyncWidgetChanged?.(`${block.type} widget ready: 0px`);
            return;
          }
          const wh = this.measureWidgetHeight(widgetEl);
          block.widgetHeight = wh;
          placeholder.replaceWith(widgetEl);
          this.onAsyncWidgetChanged?.(`${block.type} widget ready: ${wh}px`);
        });
      } else {
        this.renderWidgetAsync(block, el);
      }
    }

    // 7. 调试信息
    if (this.debugBackground) {
      el.style.background = index % 2 === 0 ? "rgba(255,0,0,0.06)" : "rgba(0,0,255,0.06)";
    }
    if (this.debugTopLabels) {
      const debugLabel = document.createElement("div");
      debugLabel.className = "md-block-debug";
      debugLabel.style.cssText = "position:absolute;top:0;right:0;font-size:10px;line-height:1.3;color:#888;background:rgba(255,255,255,0.85);padding:1px 4px;border-radius:0 0 0 4px;pointer-events:none;z-index:3;font-family:monospace;white-space:pre;";
      debugLabel.textContent = `calc: ${getBlockTotalHeight(block).toFixed(1)}\ndom:  ...`;
      el.appendChild(debugLabel);

      const topLabel = document.createElement("div");
      topLabel.className = "md-block-top-label";
      topLabel.style.cssText = "position:absolute;top:0;left:0;font-size:10px;line-height:1.3;color:#07c;background:rgba(255,255,255,0.85);padding:1px 4px;border-radius:0 0 4px 0;pointer-events:none;z-index:3;font-family:monospace;";
      topLabel.textContent = "top: ...";
      el.appendChild(topLabel);
    }
  }

  private buildParagraphDom(
    paraEl: HTMLDivElement,
    paragraph: Paragraph,
    block: Block,
    codeHighlightChunks?: HighlightChunk[] | null,
  ): void {
    const paraAbsStart = block.documentPosFrom + paragraph.blockOffsetFrom;

    for (const visualLine of paragraph.visualLines!) {
      const vlEl = document.createElement("div");
      vlEl.className = "cm-vline";
      vlEl.style.height = `${visualLine.height}px`;
      vlEl.style.width = "100%";
    
      if (codeHighlightChunks) {
        this.renderHighlightedParagraphForRange(vlEl, codeHighlightChunks, paragraph, visualLine);
      } else {
        this.renderSegmentsForRange(vlEl, paragraph, visualLine, paraAbsStart);
      }

      // Debug: 按 glyph 测量宽度画彩色下划线
      if (this.debugUnderline) {
        this.appendGlyphDebugUnderlines(vlEl, paragraph, visualLine);
      }

      // Debug: 按 glyph 内部数据渲染半透明红色覆盖层
      if (this.debugGlyphOverlay) {
        this.appendGlyphDebugOverlay(vlEl, paragraph, visualLine, paraAbsStart);
      }
    
      paraEl.appendChild(vlEl);
    }
  }

  /**
   * 调试用：在 visual line 底部按 glyph 测量宽度画彩色下划线。
   * 每个 glyph 一段下划线，颜色随机且相邻不同色。
   */
  private appendGlyphDebugUnderlines(
    vlEl: HTMLDivElement,
    paragraph: Paragraph,
    visualLine: VisualLine,
  ): void {
    // 收集属于此 visual line 范围的 glyphs
    const vlGlyphs: Glyph[] = [];
    for (const seg of paragraph.segments) {
      for (const chunk of seg.chunks) {
        for (const g of chunk.glyphs) {
          const glyphParaphOffset = seg.paraphOffsetFrom + chunk.segmentOffsetFrom + g.chunkOffsetFrom;
          if (glyphParaphOffset >= visualLine.paraphOffsetFrom && glyphParaphOffset < visualLine.paraphOffsetTo) {
            vlGlyphs.push(g);
          }
        }
      }
    }
    if (vlGlyphs.length === 0) return;

    // 预定义一组高对比颜色
    const palette = [
      "#e6194b", "#3cb44b", "#4363d8", "#f58231", "#911eb4",
      "#42d4f4", "#f032e6", "#bfef45", "#fabed4", "#469990",
      "#dcbeff", "#9a6324", "#800000", "#aaffc3", "#808000",
      "#000075", "#a9a9a9",
    ];

    vlEl.style.position = "relative";

    const overlay = document.createElement("div");
    overlay.style.cssText = "position:absolute;bottom:0;left:0;height:2px;display:flex;pointer-events:none;z-index:10;";

    let lastColorIdx = -1;
    for (const g of vlGlyphs) {
      let colorIdx: number;
      do {
        colorIdx = Math.floor(Math.random() * palette.length);
      } while (colorIdx === lastColorIdx);
      lastColorIdx = colorIdx;

      const bar = document.createElement("div");
      bar.style.width = `${glyphFullWidth(g)}px`;
      bar.style.height = "2px";
      bar.style.background = palette[colorIdx];
      bar.style.flexShrink = "0";
      overlay.appendChild(bar);
    }

    vlEl.appendChild(overlay);
  }

  /**
   * 调试用：在 visual line 上方按 glyph 内部数据渲染半透明红色覆盖层。
   * 每个 glyph 一个红色方块，宽度 = glyph.width，高度 = glyph.height，
   * 显示 glyph 的字符文本，方便检查测量数据是否正确。
   */
  private appendGlyphDebugOverlay(
    vlEl: HTMLDivElement,
    paragraph: Paragraph,
    visualLine: VisualLine,
    paraAbsStart: number,
  ): void {
    // 收集属于此 visual line 范围的 glyphs（带所属 chunk 的 font）
    const vlGlyphs: { glyph: Glyph; char: string; font: string }[] = [];
    for (const seg of paragraph.segments) {
      for (const chunk of seg.chunks) {
        for (const g of chunk.glyphs) {
          const glyphParaphOffset = seg.paraphOffsetFrom + chunk.segmentOffsetFrom + g.chunkOffsetFrom;
          if (glyphParaphOffset >= visualLine.paraphOffsetFrom && glyphParaphOffset < visualLine.paraphOffsetTo) {
            const absFrom = paraAbsStart + glyphParaphOffset;
            const absTo = paraAbsStart + seg.paraphOffsetFrom + chunk.segmentOffsetFrom + g.chunkOffsetTo;
            const char = this.doc.sliceContent(absFrom, absTo);
            vlGlyphs.push({ glyph: g, char, font: chunk.font });
          }
        }
      }
    }
    if (vlGlyphs.length === 0) return;

    vlEl.style.position = "relative";

    const overlay = document.createElement("div");
    const offsetY = 0 ; // paragraph.lineHeight / 2;
    overlay.style.cssText = `position:absolute;top:${offsetY}px;left:0;display:flex;pointer-events:none;z-index:11;`;

    for (const { glyph, char, font } of vlGlyphs) {
      const totalW = glyphFullWidth(glyph);
      const pL = glyph.padLeft ?? 0;
      const cell = document.createElement("div");
      cell.style.width = `${totalW}px`;
      cell.style.height = `${paragraph.lineHeight}px`;
      cell.style.color = "red";
      cell.style.opacity = "0.5";
      cell.style.border = "0.5px solid red";
      cell.style.boxSizing = "border-box";
      cell.style.flexShrink = "0";
      cell.style.font = font;
      cell.style.lineHeight = `${paragraph.lineHeight}px`;
      cell.style.textAlign = "left";
      if (pL > 0) cell.style.paddingLeft = `${pL}px`;
      cell.style.overflow = "hidden";
      cell.textContent = char;
      cell.title = `w:${glyph.width.toFixed(1)} pL:${pL} pR:${glyph.padRight ?? 0} chunk:[${glyph.chunkOffsetFrom},${glyph.chunkOffsetTo}) brk:${glyph.breakable ? "Y" : "N"}`;
      overlay.appendChild(cell);
    }

    vlEl.appendChild(overlay);
  }

  /**
   * 将 [rangeStart, rangeEnd) 范围内的段落内容渲染到 container 中。
   *
   * 外层按 Segment 迭代（text-run / inline-code / inline-math / inline-image），
   * 内层按各 segment 的 Chunk 渲染，不再依赖 chunk.type 特判。
   */
  private renderSegmentsForRange(
    container: HTMLElement,
    paragraph: Paragraph,
    visualLine: VisualLine,
    paraAbsStart: number,
  ): void {
    const segments = paragraph.segments;
    const vlFrom = visualLine.paraphOffsetFrom;
    const vlTo = visualLine.paraphOffsetTo;

    if (vlFrom >= vlTo) {
      container.textContent = "\u200b";
      return;
    }

    // 只保留与目标范围有交集的 segment（paragraph-relative 坐标比较）
    const relevantSegments = segments.filter(seg => {
        if (seg.paraphOffsetFrom <= vlFrom || seg.paraphOffsetTo > vlFrom) {
          return true;
        } else if (seg.paraphOffsetFrom >= vlFrom && seg.paraphOffsetTo <= vlTo) {
          return true;
        } else if (seg.paraphOffsetFrom < vlTo && seg.paraphOffsetTo >= vlTo) {
          return true;
        } else if (seg.paraphOffsetFrom <= vlFrom && seg.paraphOffsetTo >= vlTo) {
          return true;
        }
        return false;
      }
    );

    if (relevantSegments.length === 0) {
      const rangeText = this.doc.sliceContent(paraAbsStart + vlFrom, paraAbsStart + vlTo);
      container.appendChild(document.createTextNode(rangeText || "\u200b"));
      return;
    }

    let cursor = vlFrom;

    for (const seg of relevantSegments) {
      // 填补 segment 前的间隙（不应出现，但作为保护）
      if (cursor < seg.paraphOffsetFrom) {
        const gapText = this.doc.sliceContent(paraAbsStart + cursor, paraAbsStart + seg.paraphOffsetFrom);
        container.appendChild(document.createTextNode(gapText || "\u200b"));
      }

      const clipFrom = Math.max(seg.paraphOffsetFrom, vlFrom);
      const clipTo = Math.min(seg.paraphOffsetTo, vlTo);

      if (clipFrom < clipTo) {
        if (seg.type === "inline-math") {
          this.renderInlineMathSegment(container, seg, clipFrom, clipTo, paraAbsStart);
        } else if (seg.type === "inline-image") {
          this.renderInlineImageSegment(container, seg, clipFrom, clipTo, paraAbsStart);
        } else {
          // text-run 和 inline-code：按 chunk 渲染（转为 segment-relative 范围）
          const segRelFrom = clipFrom - seg.paraphOffsetFrom;
          const segRelTo = clipTo - seg.paraphOffsetFrom;
          this.renderChunksForRange(container, seg.chunks, segRelFrom, segRelTo, paraAbsStart, seg.paraphOffsetFrom);
        }
      }

      cursor = seg.paraphOffsetTo;
    }

    // 末尾剩余（不应出现，但作为保护）
    if (cursor < vlTo) {
      const gapText = this.doc.sliceContent(paraAbsStart + cursor, paraAbsStart + vlTo);
      container.appendChild(document.createTextNode(gapText || "\u200b"));
    }

    if (!container.childNodes.length) {
      container.textContent = "\u200b";
    }
  }

  /**
   * 渲染单个 inline-math segment 到 container。
   * segment 的 chunks 已经分好了标点+内容+标点，直接按 chunk 写入源码文本；
   * 同时在整个 segment 完整可见时附加渲染结果 span。
   */
  private renderInlineMathSegment(
    container: HTMLElement,
    seg: Segment,
    clipFrom: number,
    clipTo: number,
    paraAbsStart: number,
  ): void {
    const isFullyVisible = clipFrom === seg.paraphOffsetFrom && clipTo === seg.paraphOffsetTo;

    // 源码 span（包含标点和公式原文）
    const sourceSpan = document.createElement("span");
    sourceSpan.className = "cm-math-inline-source";
    if (seg.latex) sourceSpan.dataset.latex = seg.latex;
    const segRelFrom = clipFrom - seg.paraphOffsetFrom;
    const segRelTo = clipTo - seg.paraphOffsetFrom;
    this.renderChunksForRange(sourceSpan, seg.chunks, segRelFrom, segRelTo, paraAbsStart, seg.paraphOffsetFrom);

    // 渲染结果：只在整个 segment 完全在当前 visual line 范围内时才挂载
    if (isFullyVisible && seg.latex) {
      const renderSpan = document.createElement("span");
      renderSpan.className = "cm-math-inline-render";
      renderSpan.dataset.latex = seg.latex;
      renderSpan.style.display = "inline-block";
      renderSpan.style.verticalAlign = "middle";
      renderSpan.style.overflow = "hidden";
      if (seg.renderWidth !== undefined) {
        renderSpan.style.maxWidth = `${seg.renderWidth}px`;
      }
      try {
        katex.render(seg.latex, renderSpan, { displayMode: false, throwOnError: false, output: "html" });
      } catch {
        renderSpan.textContent = seg.latex;
      }
      sourceSpan.appendChild(renderSpan);
    }

    container.appendChild(sourceSpan);
  }

  /**
   * 渲染单个 inline-image segment 到 container。
   * 整个 segment 完整可见时附加图片预览 span。
   */
  private renderInlineImageSegment(
    container: HTMLElement,
    seg: Segment,
    clipFrom: number,
    clipTo: number,
    paraAbsStart: number,
  ): void {
    const isFullyVisible = clipFrom === seg.paraphOffsetFrom && clipTo === seg.paraphOffsetTo;

    const sourceSpan = document.createElement("span");
    sourceSpan.className = "cm-image-link";
    const rawUrl = seg.resolvedUrl ?? "";
    const resolvedUrl = rawUrl ? resolveImageUrl(rawUrl, this.baseDir) : "";
    console.log("[MdRenderer] inline image src", {
      rawUrl,
      resolvedUrl,
      baseDir: this.baseDir,
      documentBaseURI: document.baseURI,
      locationHref: window.location.href,
      locationOrigin: window.location.origin,
    });
    if (resolvedUrl) sourceSpan.dataset.url = resolvedUrl;
    const segRelFrom = clipFrom - seg.paraphOffsetFrom;
    const segRelTo = clipTo - seg.paraphOffsetFrom;
    this.renderChunksForRange(sourceSpan, seg.chunks, segRelFrom, segRelTo, paraAbsStart, seg.paraphOffsetFrom);

    if (isFullyVisible && rawUrl) {
      const previewSpan = document.createElement("span");
      previewSpan.className = "cm-image-inline-preview";
      if (seg.renderWidth !== undefined) {
        previewSpan.style.width = `${seg.renderWidth}px`;
        previewSpan.style.height = `${seg.renderHeight ?? seg.renderWidth}px`;
      }
      const img = document.createElement("img");
      img.src = resolvedUrl;
      img.draggable = false;
      img.onerror = (e) => {
        this.logImageLoadError("inline-preview", rawUrl, resolvedUrl, img, e);
      };
      previewSpan.appendChild(img);
      sourceSpan.appendChild(previewSpan);
    }

    container.appendChild(sourceSpan);
  }

  /**
   * 将文本追加到容器，当 showSpaceDots 启用时空格字符包裹在 cm-space span 中以显示可见标记。
   */
  private appendTextWithVisibleSpaces(container: HTMLElement, text: string, cssClass?: string, dataAttrs?: Record<string, string>): void {
    if (!text) return;

    if (!this.showSpaceDots) {
      // 不显示空格点：直接作为纯文本插入
      if (cssClass) {
        const span = document.createElement("span");
        span.className = cssClass;
        if (dataAttrs) {
          for (const [key, value] of Object.entries(dataAttrs)) {
            span.dataset[key] = value;
          }
        }
        span.appendChild(document.createTextNode(text));
        container.appendChild(span);
      } else {
        container.appendChild(document.createTextNode(text));
      }
      return;
    }

    const parts = text.split(/([ \t]+)/);
    if (cssClass) {
      const span = document.createElement("span");
      span.className = cssClass;
      if (dataAttrs) {
        for (const [key, value] of Object.entries(dataAttrs)) {
          span.dataset[key] = value;
        }
      }
      for (const part of parts) {
        if (!part) continue;
        if (/^[ \t]+$/.test(part)) {
          for (const ch of part) {
            const s = document.createElement("span");
            s.className = "cm-space";
            s.textContent = ch;
            span.appendChild(s);
          }
        } else {
          span.appendChild(document.createTextNode(part));
        }
      }
      container.appendChild(span);
    } else {
      for (const part of parts) {
        if (!part) continue;
        if (/^[ \t]+$/.test(part)) {
          for (const ch of part) {
            const s = document.createElement("span");
            s.className = "cm-space";
            s.textContent = ch;
            container.appendChild(s);
          }
        } else {
          container.appendChild(document.createTextNode(part));
        }
      }
    }
  }

  /**
   * 按 Chunk 列表将 [rangeStart, rangeEnd) 范围的文本渲染到 container。
   * 用于 text-run 和 inline-code segment 的内部渲染。
   */
  private renderChunksForRange(
    container: HTMLElement,
    styleChunks: Chunk[],
    segRelFrom: number,
    segRelTo: number,
    paraAbsStart: number,
    segParaphOffset: number,
  ): void {
    const relevantChunks = styleChunks.filter(chunk => {
        if (chunk.segmentOffsetFrom <= segRelFrom && chunk.segmentOffsetTo > segRelFrom) {
          return true;
        } else if (chunk.segmentOffsetFrom >= segRelFrom && chunk.segmentOffsetTo <= segRelTo) {
          return true;
        } else if (chunk.segmentOffsetFrom < segRelTo && chunk.segmentOffsetTo >= segRelTo) {
          return true;
        } else if (chunk.segmentOffsetFrom <= segRelFrom && chunk.segmentOffsetTo >= segRelTo) {
          return true;
        }
        return false;
      }
    );

    let cursor = segRelFrom;

    for (const chunk of relevantChunks) {
      const chunkClipFrom = Math.max(chunk.segmentOffsetFrom, segRelFrom);
      const chunkClipTo = Math.min(chunk.segmentOffsetTo, segRelTo);

      // 填补 chunk 前的间隙文本（无样式）
      if (cursor < chunkClipFrom) {
        const absFrom = paraAbsStart + segParaphOffset + cursor;
        const absTo = paraAbsStart + segParaphOffset + chunkClipFrom;
        this.appendTextWithVisibleSpaces(container, this.doc.sliceContent(absFrom, absTo));
      }

      if (chunkClipFrom < chunkClipTo) {
        const absFrom = paraAbsStart + segParaphOffset + chunkClipFrom;
        const absTo = paraAbsStart + segParaphOffset + chunkClipTo;
        const text = this.doc.sliceContent(absFrom, absTo);
        this.appendTextWithVisibleSpaces(container, text, chunk.cssClass || undefined, chunk.dataAttrs);
      }

      cursor = Math.max(cursor, chunkClipTo);
    }

    // 末尾剩余无样式文本
    if (cursor < segRelTo) {
      const absFrom = paraAbsStart + segParaphOffset + cursor;
      const absTo = paraAbsStart + segParaphOffset + segRelTo;
      this.appendTextWithVisibleSpaces(container, this.doc.sliceContent(absFrom, absTo));
    }

    if (!container.childNodes.length) {
      container.textContent = "\u200b";
    }
  }

  private renderHighlightedParagraphForRange(
    container: HTMLElement,
    styleChunks: HighlightChunk[],
    _paragraph: Paragraph,
    visualLine: VisualLine,
  ): void {
    const charStart = visualLine.paraphOffsetFrom;
    const charEnd = visualLine.paraphOffsetTo;
  
    let pos = 0;
    for (const t of styleChunks) {
      const tEnd = pos + t.text.length;
      const cs = Math.max(pos, charStart);
      const ce = Math.min(tEnd, charEnd);
  
      if (cs < ce) {
        const clippedText = t.text.substring(cs - pos, ce - pos);
        this.appendTextWithVisibleSpaces(container, clippedText, t.cls || undefined);
      }
  
      pos = tEnd;
      if (pos >= charEnd) break;
    }
  
    if (!container.childNodes.length) {
      container.textContent = "\u200b";
    }
  }

  private renderWidgetAsync(block: Block, container: HTMLDivElement): void {
    // 1. 先挂 loading 占位
    const loading = document.createElement("div");
    loading.className = `cm-${block.type}-block-render cm-widget-loading`;
    loading.style.height = `${WIDGET_LOADING_HEIGHT}px`;
    loading.style.display = "flex";
    loading.style.alignItems = "center";
    loading.style.justifyContent = "center";
    loading.textContent = "Loading...";
    loading.contentEditable = "false";
    container.appendChild(loading);

    // 2. 异步构建真实 widget
    this.buildWidget(block).then(widgetEl => {
      if (!widgetEl) {
        block.widgetHeight = 0;
        loading.remove();
        this.onAsyncWidgetChanged?.(`${block.type} widget ready: 0px`);
        return;
      }
      // 3. 插入编辑器同宽 tmp div 测量高度
      const wh = this.measureWidgetHeight(widgetEl);
      block.widgetHeight = wh;
      // 4. 替换 loading，插入真实 DOM
      loading.replaceWith(widgetEl);
      // 5. 通知更新
      this.onAsyncWidgetChanged?.(`${block.type} widget ready: ${wh}px`);
    });
  }

  private extractWidgetEl(el: HTMLDivElement): HTMLElement | null {
    for (const child of Array.from(el.children)) {
      if (!child.classList.contains("md-block-source")
          && !child.classList.contains("md-block-debug")
          && !child.classList.contains("md-block-top-label")
          && child.getAttribute("contenteditable") === "false") {
        return child as HTMLElement;
      }
    }
    return null;
  }

  private measureWidgetHeight(el: HTMLDivElement): number {
    const probe = document.createElement("div");
    probe.style.cssText = `position:fixed;visibility:hidden;pointer-events:none;top:-9999px;left:-9999px;width:${this.containerWidth}px;`;
    probe.appendChild(el);
    document.body.appendChild(probe);
    const wh = Math.ceil(el.getBoundingClientRect().height);
    document.body.removeChild(probe);
    return wh;
  }

  private buildWidget(block: Block): Promise<HTMLDivElement | null> {
    switch (block.type) {
      case "math":
        return Promise.resolve(this.buildMathWidget(block));
      case "image":
        return this.buildImageWidget(block);
      case "table":
        return Promise.resolve(this.buildTableWidget(block));
      case "html":
        return Promise.resolve(this.buildHtmlWidget(block));
      case "mermaid":
        return this.buildMermaidWidget(block);
      default:
        return Promise.resolve(null);
    }
  }

  private buildMathWidget(block: Block): HTMLDivElement {
    const div = document.createElement("div");
    div.className = "cm-math-block-render";
    div.contentEditable = "false";
    try {
      katex.render(block.latex!, div, { displayMode: true, throwOnError: false, output: "html" });
    } catch {
      div.textContent = "Invalid formula";
    }
    return div;
  }

  private logImageLoadError(
    scope: "inline-preview" | "block-widget",
    rawUrl: string,
    resolvedUrl: string,
    img: HTMLImageElement,
    event: Event | string,
  ): void {
    let parsedHref = resolvedUrl;
    let sameOrigin = false;
    try {
      const parsed = new URL(resolvedUrl, window.location.href);
      parsedHref = parsed.href;
      sameOrigin = parsed.origin === window.location.origin;
    } catch {
      // Keep original resolved URL when URL parsing fails.
    }

    console.log("[MdRenderer] image load failed", {
      scope,
      rawUrl,
      resolvedUrl,
      parsedHref,
      sameOrigin,
      imgSrc: img.src,
      currentSrc: img.currentSrc,
      complete: img.complete,
      naturalWidth: img.naturalWidth,
      naturalHeight: img.naturalHeight,
      documentBaseURI: document.baseURI,
      locationHref: window.location.href,
      locationOrigin: window.location.origin,
      event,
    });
  }

  private buildImageWidget(block: Block): Promise<HTMLDivElement> {
    return new Promise((resolve) => {
      const div = document.createElement("div");
      div.className = "cm-image-block-render";
      div.contentEditable = "false";

      const rawUrl = block.url!;
      const resolvedUrl = resolveImageUrl(rawUrl, this.baseDir);
      console.log("[MdRenderer] block image src", {
        rawUrl,
        resolvedUrl,
        baseDir: this.baseDir,
        documentBaseURI: document.baseURI,
        locationHref: window.location.href,
        locationOrigin: window.location.origin,
      });
      const img = document.createElement("img");
      img.src = resolvedUrl;
      img.alt = block.alt!;
      img.style.maxWidth = "100%";
      img.style.borderRadius = "4px";
      div.appendChild(img);
      img.onload = () => resolve(div);
      img.onerror = (e) => {
        this.logImageLoadError("block-widget", rawUrl, resolvedUrl, img, e);
        resolve(div);
      };
    });
  }

  private buildTableWidget(block: Block): HTMLDivElement {
    const startParagraph = this.doc.getParagraphAtPos(block.documentPosFrom);
    const endParagraph = this.doc.getParagraphAtPos(block.documentPosTo);

    const div = document.createElement("div");
    div.className = "cm-table-block-render";
    div.contentEditable = "false";
    this.buildTableDOM(div, startParagraph.documentOffsetIndex, endParagraph.documentOffsetIndex);
    return div;
  }

  private buildTableDOM(container: HTMLElement, startLineNum: number, endLineNum: number) {
    const table = document.createElement("table");
    const thead = document.createElement("thead");
    const headerParagraph = this.doc.getParagraph(startLineNum);
    const headerText = getParagraphText(this.doc, headerParagraph);
    const headerCells = this.parseTableRow(headerText);
    const separatorParagraph = this.doc.getParagraph(startLineNum + 1);
    const alignments = this.parseAlignments(getParagraphText(this.doc, separatorParagraph));

    const headerRow = document.createElement("tr");
    for (let i = 0; i < headerCells.length; i++) {
      const th = document.createElement("th");
      th.textContent = headerCells[i];
      if (alignments[i]) th.style.textAlign = alignments[i]!;
      headerRow.appendChild(th);
    }
    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = document.createElement("tbody");
    for (let j = startLineNum + 2; j <= endLineNum; j++) {
      const rowParagraph = this.doc.getParagraph(j);
      const cells = this.parseTableRow(getParagraphText(this.doc, rowParagraph));
      const tr = document.createElement("tr");
      for (let c = 0; c < cells.length; c++) {
        const td = document.createElement("td");
        td.textContent = cells[c];
        if (alignments[c]) td.style.textAlign = alignments[c]!;
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    container.appendChild(table);
  }

  private buildHtmlWidget(block: Block): HTMLDivElement {
    const div = document.createElement("div");
    div.className = "cm-html-block-render";
    div.contentEditable = "false";
    div.innerHTML = block.html!;
    return div;
  }

  private buildMermaidWidget(block: Block): Promise<HTMLDivElement> {
    const div = document.createElement("div");
    div.className = "cm-mermaid-block-render";
    div.contentEditable = "false";

    return import("mermaid").then(({ default: mermaid }) => {
      mermaid.initialize({ startOnLoad: false, theme: "default" });
      const id = `mermaid-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      return mermaid.render(id, block.code!).then(({ svg }) => {
        div.innerHTML = svg;
        return div;
      }).catch(() => {
        div.textContent = "Invalid mermaid diagram";
        return div;
      });
    });
  }

  private extractCodeContent(startLineNum: number, endLineNum: number): string {
    const lines: string[] = [];
    for (let i = startLineNum + 1; i < endLineNum; i++) {
      const para = this.doc.getParagraph(i);
      lines.push(getParagraphText(this.doc, para));
    }
    return lines.join("\n");
  }

  private extractBlockContent(block: Block): string {
    const startPara = this.doc.getParagraphAtPos(block.documentPosFrom);
    const endPara = this.doc.getParagraphAtPos(block.documentPosTo);
    const isCode = block.type === "code" || block.type === "mermaid";
    const isMath = block.type === "math";

    if (isCode || isMath) {
      // Skip fence/delimiter lines
      return this.extractCodeContent(startPara.documentOffsetIndex, endPara.documentOffsetIndex);
    }

    // For table, html, image: include all lines
    const lines: string[] = [];
    for (let i = startPara.documentOffsetIndex; i <= endPara.documentOffsetIndex; i++) {
      const para = this.doc.getParagraph(i);
      lines.push(getParagraphText(this.doc, para));
    }
    return lines.join("\n");
  }

  private parseTableRow(para: string): string[] {
    return para.split("|").map(c => c.trim()).filter((_, i, arr) => i > 0 && i < arr.length - 1);
  }

  private parseAlignments(para: string): (string | null)[] {
    return para.split("|").filter(c => c.trim()).map(cell => {
      const trimmed = cell.trim();
      if (trimmed.startsWith(":") && trimmed.endsWith(":")) return "center";
      if (trimmed.endsWith(":")) return "right";
      if (trimmed.startsWith(":")) return "left";
      return null;
    });
  }

  getDocumentPosIndexAtCoords(clientX: number, clientY: number): number {
    const rect = this.container.getBoundingClientRect();
    const inLeftPadding = clientX < rect.left;
    const inRightPadding = clientX > rect.right;

    if (inLeftPadding || inRightPadding) {
      const y = clientY - rect.top;
      let blockIdx = 0;
      for (let i = 0; i < this.doc.blocks.length; i++) {
        if ((this.doc.blocks[i].y ?? 0) <= y) blockIdx = i;
        else break;
      }
      const rb = this.doc.blocks[blockIdx];
      if (rb) {
        const rbBVL = collectAllVisualLinesWithBlockOffset(rb);
        if (rbBVL.length > 0) {
          const blockY = rb.y ?? 0;
          const localY = y - blockY;
          let vlIdx = 0;
          let accY = 0;
          for (let i = 0; i < rbBVL.length; i++) {
            if (accY + rbBVL[i].vl.height > localY) { vlIdx = i; break; }
            accY += rbBVL[i].vl.height;
            vlIdx = i;
          }
          const bvl = rbBVL[vlIdx];
          return rb.documentPosFrom + (inLeftPadding ? bvl.blockOffsetFrom : bvl.blockOffsetTo);
        }
        // fallback: 无 visual line 信息时退回段落级定位
        const para = this.getParagraphAtClientY(clientY);
        if (para) {
          return inLeftPadding ? para.documentPosFrom : para.documentPosFrom + para.text.length;
        }
      }
    }

    const contentX = clientX - rect.left;
    const y = clientY - rect.top;

    let blockIdx = 0;
    for (let i = 0; i < this.doc.blocks.length; i++) {
      if ((this.doc.blocks[i].y ?? 0) <= y) blockIdx = i;
      else break;
    }

    const rb = this.doc.blocks[blockIdx];
    const rbVLs = rb ? collectAllVisualLines(rb) : [];
    if (!rb || rbVLs.length === 0) {
      return rb ? rb.documentPosFrom : 0;
    }

    const blockY = rb.y ?? 0;
    const localY = y - blockY;

    let visualLine_blockOffsetIndex = 0;
    let vAccum = 0;
    for (let i = 0; i < rbVLs.length; i++) {
      if (vAccum + rbVLs[i].height > localY) {
        visualLine_blockOffsetIndex = i;
        break;
      }
      vAccum += rbVLs[i].height;
      visualLine_blockOffsetIndex = i;
    }

    const padding = this.getBlockPadding(rb.type, { paraText: getParagraphText(this.doc, this.doc.getParagraphAtPos(rb.documentPosFrom)) });
    const blockOffset = getNewChar_BlockOffsetIndex(rb, visualLine_blockOffsetIndex, Math.max(0, contentX - padding.left));

    return rb.documentPosFrom + blockOffset;
  }

  private getParagraphAtClientY(clientY: number): { documentPosFrom: number; text: string } | null {
    const rect = this.container.getBoundingClientRect();
    const y = clientY - rect.top;

    let blockIdx = 0;
    for (let i = 0; i < this.doc.blocks.length; i++) {
      if ((this.doc.blocks[i].y ?? 0) <= y) blockIdx = i;
      else break;
    }

    const rb = this.doc.blocks[blockIdx];
    const rbBVL = rb ? collectAllVisualLinesWithBlockOffset(rb) : [];
    if (!rb || rbBVL.length === 0) {
      if (!rb) return null;
      const paragraph = this.doc.getParagraphAtPos(rb.documentPosFrom);
      return { documentPosFrom: paragraph.documentPosFrom, text: getParagraphText(this.doc, paragraph) };
    }

    const blockY = rb.y ?? 0;
    const localY = y - blockY;
    let accY = 0;
    let vlIdx = 0;
    for (let i = 0; i < rbBVL.length; i++) {
      if (accY + rbBVL[i].vl.height > localY) { vlIdx = i; break; }
      accY += rbBVL[i].vl.height;
      vlIdx = i;
    }
    const docPos = rb.documentPosFrom + rbBVL[vlIdx].blockOffsetFrom;
    const targetParagraph = this.doc.getParagraphAtPos(docPos);
    return { documentPosFrom: targetParagraph.documentPosFrom, text: getParagraphText(this.doc, targetParagraph) };
  }

  coordsAtDocPos(char_documentPosIndex: number, affinity: 'forward' | 'backward' = 'forward'): { x: number; y: number; height: number } | null {
    const docParagraph = this.doc.getParagraphAtPos(char_documentPosIndex);

    // 始终使用 canvas 测量路径，与 getDocumentPosIndexAtCoords 保持一致，
    // 避免 DOM Range 与 canvas measureText 之间的累积偏移导致选区漂移。
    for (let bi = 0; bi < this.doc.blocks.length; bi++) {
      const rb = this.doc.blocks[bi];
      if (!rb) continue;
      if (char_documentPosIndex < rb.documentPosFrom || char_documentPosIndex > rb.documentPosTo) continue;
      if (!rb || getBlockTotalChars(rb) === 0) {
        const fallbackHeight = rb.paragraphs?.[0]?.lineHeight ?? this.fm.createFontStyle("base").lineHeight;
        return { x: 0, y: rb.y ?? 0, height: fallbackHeight };
      }

      const blockRelOffset = char_documentPosIndex - rb.documentPosFrom;
      const coords = coordsAtChar_blockOffsetIndex(rb, blockRelOffset, affinity);
      const rbVL = collectAllVisualLines(rb);

      let yInBlock = 0;
      for (let v = 0; v < coords.visualLine; v++) {
        yInBlock += rbVL[v].height;
      }

      const vlHeight = rbVL[coords.visualLine]?.height ?? this.fm.createFontStyle("base").lineHeight;
      const padding = this.getBlockPadding(rb.type, { paraText: getParagraphText(this.doc, docParagraph) });

      return {
        x: coords.char_vlPosIndex + padding.left,
        y: (rb.y ?? 0) + yInBlock,
        height: vlHeight,
      };
    }

    return null;
  }

  /** 粘滞列：记住上下移动时的目标 x 坐标，水平操作时重置 */
  private goalX: number | null = null;

  resetGoalColumn() {
    this.goalX = null;
  }

  visualLineMove(char_documentPosIndex: number, direction: "up" | "down"): number {
    const docParagraph = this.doc.getParagraphAtPos(char_documentPosIndex);

    let blockIdx = -1;
    for (let bi = 0; bi < this.doc.blocks.length; bi++) {
      const block = this.doc.blocks[bi];
      if (char_documentPosIndex >= block.documentPosFrom && char_documentPosIndex <= block.documentPosTo) {
        blockIdx = bi;
        break;
      }
    }

    if (blockIdx < 0) return char_documentPosIndex;

    const rb = this.doc.blocks[blockIdx];
    if (!rb || getBlockTotalChars(rb) === 0) {
      return this.fallbackParagraphMove(char_documentPosIndex, docParagraph, direction);
    }

    const blockRelOffset = char_documentPosIndex - rb.documentPosFrom;
    const coords = coordsAtChar_blockOffsetIndex(rb, blockRelOffset);

    // 使用粘滞列：首次上下移动时记住 x，后续沿用
    if (this.goalX === null) {
      this.goalX = coords.char_vlPosIndex;
    }
    const targetX = this.goalX;

    if (direction === "down") {
      const rbVL = collectAllVisualLines(rb);
      if (coords.visualLine + 1 < rbVL.length) {
        const blockOff = getNewChar_BlockOffsetIndex(rb, coords.visualLine + 1, targetX);
        return rb.documentPosFrom + blockOff;
      }
      return this.moveToAdjacentBlock(blockIdx, targetX, "next");
    } else {
      if (coords.visualLine > 0) {
        const blockOff = getNewChar_BlockOffsetIndex(rb, coords.visualLine - 1, targetX);
        return rb.documentPosFrom + blockOff;
      }
      return this.moveToAdjacentBlock(blockIdx, targetX, "prev");
    }
  }

  private moveToAdjacentBlock(blockIdx: number, x: number, dir: "next" | "prev"): number {
    if (dir === "next") {
      for (let bi = blockIdx + 1; bi < this.doc.blocks.length; bi++) {
        const nextRb = this.doc.blocks[bi];
        if (nextRb && getBlockTotalChars(nextRb) > 0) {
          const blockOff = getNewChar_BlockOffsetIndex(nextRb, 0, x);
          return nextRb.documentPosFrom + blockOff;
        }
        return this.doc.blocks[bi]?.documentPosFrom;
      }
      return this.doc.length;
    } else {
      for (let bi = blockIdx - 1; bi >= 0; bi--) {
        const prevRb = this.doc.blocks[bi];
        if (prevRb && getBlockTotalChars(prevRb) > 0) {
          const prevVL = collectAllVisualLines(prevRb);
          const lastVL = (prevVL.length ?? 1) - 1;
          const blockOff = getNewChar_BlockOffsetIndex(prevRb, lastVL, x);
          return prevRb.documentPosFrom + blockOff;
        }
        return this.doc.blocks[bi]?.documentPosTo;
      }
      return 0;
    }
  }

  private fallbackParagraphMove(pos: number, docParagraph: ReturnType<Document["getParagraphAtPos"]>, direction: "up" | "down"): number {
    const col = pos - docParagraph.documentPosFrom;
    if (direction === "down") {
      if (docParagraph.documentOffsetIndex >= this.doc.paraphsLength - 1) return this.doc.length;
      const next = this.doc.getParagraph(docParagraph.documentOffsetIndex + 1);
      return next.documentPosFrom + Math.min(col, getParagraphText(this.doc, next).length);
    } else {
      if (docParagraph.documentOffsetIndex <= 0) return 0;
      const prev = this.doc.getParagraph(docParagraph.documentOffsetIndex - 1);
      return prev.documentPosFrom + Math.min(col, getParagraphText(this.doc, prev).length);
    }
  }
  clear() {
    for (const bd of this.doc.blocks) {
      bd.element?.remove();
    }
    this.doc.blocks = [];
  }
}
