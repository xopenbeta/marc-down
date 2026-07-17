import { Document } from "./parsers/types";
import { History } from "./History";
import { InputHandler } from "./InputHandler";
import { SelectionManager } from "./SelectionManager";
import { MdRenderer } from "./MdRenderer";
import { VirtualScroller } from "./VirtualScroller";
import { EventHandlers } from "./EventHandlers";
import { EditorFontManager } from "./EditorFont";
import type { SearchMatch } from "./SearchPanel";
import type { Block } from "./parsers/types";

export interface EditorOptions {
  content: string;
  fileKey: string;
  onContentChange: (content: string) => void;
  style: {
    paddingTop: number;
    paddingBottom: number;
    paddingLeft: number;
    paddingRight: number;
  }
}

export class EditorCore {
  private container: HTMLElement;
  private scrollLayer: HTMLDivElement;
  private blockLayer: HTMLDivElement;
  private cursorEl: HTMLDivElement;
  private selectionLayer: HTMLDivElement;
  private compositionLayer: HTMLDivElement;

  private doc: Document;
  private history: History;
  private selection: SelectionManager;
  private input: InputHandler;
  private renderer: MdRenderer;
  private scroller: VirtualScroller;
  private events: EventHandlers;

  private scrollbarEl: HTMLDivElement;
  private scrollbarThumb: HTMLDivElement;
  private scrollbarHideTimer = 0;
  private scrollbarDragging = false;
  private scrollbarDragStartY = 0;
  private scrollbarDragStartScrollTop = 0;
  private debugPanel: HTMLDivElement | null = null;

  private baseDir = "";
  private paddingLeft = 0;
  private paddingRight = 0;
  private paddingTop = 0;
  private paddingBottom = 0;
  private resizeObserver: ResizeObserver;
  private destroyed = false;
  private fontsReady = false;

  onContentChange: (content: string) => void;

  constructor(container: HTMLElement, options: EditorOptions) {
    this.onContentChange = options.onContentChange;
    this.container = container;
    this.paddingTop = options.style.paddingTop;
    this.paddingBottom = options.style.paddingBottom;
    this.paddingLeft = options.style.paddingLeft;
    this.paddingRight = options.style.paddingRight;

    this.container.className = (this.container.className + " native-editor").trim();

    this.scrollLayer = document.createElement("div");
    this.scrollLayer.className = "native-editor-scroll-layer";
    this.scrollLayer.style.paddingTop = `${this.paddingTop}px`;
    this.scrollLayer.style.paddingBottom = `${this.paddingBottom}px`;
    this.scrollLayer.style.paddingLeft = `${this.paddingLeft}px`;
    this.scrollLayer.style.paddingRight = `${this.paddingRight}px`;
    container.appendChild(this.scrollLayer);

    this.blockLayer = document.createElement("div");
    this.blockLayer.className = "native-editor-block-layer";
    this.scrollLayer.appendChild(this.blockLayer);

    this.selectionLayer = document.createElement("div");
    this.selectionLayer.className = "native-editor-selection-layer";
    this.scrollLayer.appendChild(this.selectionLayer);

    this.cursorEl = document.createElement("div");
    this.cursorEl.className = "native-editor-cursor";
    this.scrollLayer.appendChild(this.cursorEl);

    this.compositionLayer = document.createElement("div");
    this.compositionLayer.className = "native-editor-composition-layer";
    this.scrollLayer.appendChild(this.compositionLayer);

    this.doc = new Document();
    this.selection = new SelectionManager();
    this.selection.setCursorElement(this.cursorEl);
    this.selection.setSelectionLayer(this.selectionLayer);

    this.history = new History(this.doc, () => this.selection.getSelection());

    this.renderer = new MdRenderer(this.doc, this.blockLayer);
    this.renderer.onContentChanged = () => this.handleContentChanged();
    this.renderer.onAsyncWidgetChanged = (reason) => this.render("onAsyncWidgetChanged " + reason + " ");

    this.input = new InputHandler(this.scrollLayer, this.doc, this.history, this.selection, {
      onContentChanged: () => this.handleContentChanged(true),
      onCursorMoved: () => this.updateCursorVisual(true),
      requestRender: () => this.render("requestRender"),
      visualLineMove: (pos, direction) => this.renderer.visualLineMove(pos, direction),
      resetGoalColumn: () => this.renderer.resetGoalColumn(),
      onCompositionUpdate: (pos, len) => this.handleCompositionUpdate(pos, len),
      onCompositionEnd: () => this.handleCompositionEnd(),
    });

    EditorFontManager.getInstance().applyCSSVariables(this.scrollLayer);
    this.scroller = new VirtualScroller(this.scrollLayer);
    this.scroller.onViewportChange = (from, to) => {
      this.renderer.commit(from, to);
    };

    this.events = new EventHandlers(this.scrollLayer);
    this.events.onContextMenu = (x, y) => {
      window.dispatchEvent(new CustomEvent("editor-contextmenu", { detail: { x, y } }));
    };
    this.events.onLinkClick = (url) => {
      import("@tauri-apps/plugin-opener").then(({ openUrl }) => openUrl(url));
    };
    this.events.onTaskToggle = (paraNum) => this.toggleTask(paraNum);
    this.events.onFoldToggle = (startPos) => this.handleFoldToggle(startPos);

    this.selection.onSelectionChange = () => this.updateCursorVisual();

    this.scrollbarEl = document.createElement("div");
    this.scrollbarEl.className = "native-editor-scrollbar";
    this.scrollbarThumb = document.createElement("div");
    this.scrollbarThumb.className = "native-editor-scrollbar-thumb";
    this.scrollbarEl.appendChild(this.scrollbarThumb);
    this.container.appendChild(this.scrollbarEl);

    this.scrollLayer.addEventListener("mousedown", this.handleMouseDown);
    this.scrollLayer.addEventListener("scroll", this.handleScrollForScrollbar);
    this.scrollLayer.addEventListener("keydown", this.input.handleKeyDown);
    this.scrollbarThumb.addEventListener("mousedown", this.handleScrollbarThumbDown);
    this.scrollbarEl.addEventListener("mousedown", this.handleScrollbarTrackClick);

    this.resizeObserver = new ResizeObserver(() => {
      const newWidth = this.scrollLayer.clientWidth - this.paddingLeft - this.paddingRight;
      this.renderer.setContainerWidth(newWidth);
      this.render("resizeObserver");
    });
    this.resizeObserver.observe(this.scrollLayer);

    this.doc.setContent(options.content);
    this.history.clear();
    this.selection.setSelection(0);

    const normalizedFileKey = options.fileKey.replace(/\\/g, "/");
    this.baseDir = normalizedFileKey ? normalizedFileKey.substring(0, normalizedFileKey.lastIndexOf("/")) : "";
    this.renderer.setBaseDir(this.baseDir);

    const width = this.scrollLayer.clientWidth;
    this.renderer.setContainerWidth(width - this.paddingLeft - this.paddingRight);

    // 字体加载守卫：显式加载编辑器需要的所有字重（400/600/700），
    // document.fonts.ready 只等待已触发的字体，未被 DOM 引用的字重不会被加载。
    // 必须用 document.fonts.load() 主动触发所有字重的下载。
    const fontFamily = EditorFontManager.getInstance().fontFamily;
    Promise.all([
      document.fonts.load(`400 16px ${fontFamily}`),
      document.fonts.load(`600 16px ${fontFamily}`),
      document.fonts.load(`700 16px ${fontFamily}`),
    ]).then(() => {
      if (this.destroyed) return;

      // 【字体验证】确认 canvas 能正确使用已加载的 @font-face 字体
      const verifyCtx = document.createElement("canvas").getContext("2d")!;
      verifyCtx.font = `400 16px ${fontFamily}`;
      const spaceW = verifyCtx.measureText(" ").width;
      console.log(`【字体验证】space width=${spaceW.toFixed(2)} (monospace expected: ~${(16 * 0.6).toFixed(1)})`);

      this.fontsReady = true;
      this.scroller.setScrollEnabled(false);
      this.render("fontsReady");
      this.scroller.setScrollEnabled(true);
      this.input.focus();
    });
  }

  getContent(): string {
    return this.doc.content;
  }

  setPadding(left: number, right: number, top: number, bottom: number) {
    this.paddingLeft = left;
    this.paddingRight = right;
    this.paddingTop = top;
    this.paddingBottom = bottom;
    this.scrollLayer.style.paddingLeft = `${left}px`;
    this.scrollLayer.style.paddingRight = `${right}px`;
    this.scrollLayer.style.paddingTop = `${top}px`;
    this.scrollLayer.style.paddingBottom = `${bottom}px`;
    const width = this.scrollLayer.clientWidth;
    this.renderer.setContainerWidth(width - this.paddingLeft - this.paddingRight);
    this.render("setPadding");
  }

  setShowSpaceDots(show: boolean) {
    this.renderer.setShowSpaceDots(show);
    this.render("setShowSpaceDots");
  }

  setDebugTopLabels(show: boolean) {
    this.renderer.setDebugTopLabels(show);
    this.render("setDebugTopLabels");
  }

  setDebugHeightPanel(show: boolean) {
    if (show && !this.debugPanel) {
      this.debugPanel = document.createElement("div");
      this.debugPanel.className = "native-editor-debug-panel";
      this.container.appendChild(this.debugPanel);
      this.updateDebugPanel();
    } else if (!show && this.debugPanel) {
      this.debugPanel.remove();
      this.debugPanel = null;
    }
  }

  setDebugBackground(show: boolean) {
    this.renderer.setDebugBackground(show);
    this.render("setDebugBackground");
  }

  setDebugUnderline(show: boolean) {
    this.renderer.setDebugUnderline(show);
    this.render("setDebugUnderline");
  }

  setDebugGlyphOverlay(show: boolean) {
    this.renderer.setDebugGlyphOverlay(show);
    this.render("setDebugGlyphOverlay");
  }

  scrollToBlock(blockId: number) {
    const blocks = this.renderer.getBlocks();
    if (blocks.length === 0) return;
    const index = Math.max(0, Math.min(blockId, blocks.length - 1));
    this.selection.setSelection(blocks[index].documentPosFrom);
    this.scroller.scrollIntoView(blocks[index].y! + this.paddingTop);
    this.updateCursorVisual();
    this.input.focus();
  }

  focus() {
    this.input.focus();
  }

  getEditorInstanceState(): { scrollTop: number; anchor: number; head: number } {
    return {
      scrollTop: this.scroller.getScrollTop(),
      anchor: this.selection.anchor,
      head: this.selection.head,
    };
  }

  restoreEditorInstanceState(state: { scrollTop: number; anchor: number; head: number }) {
    const docLen = this.doc.length;
    this.selection.setSelection(
      Math.min(state.anchor, docLen),
      Math.min(state.head, docLen),
    );
    this.scroller.setScrollTop(state.scrollTop);
    this.updateCursorVisual();
  }

  search(query: string, options: { caseSensitive: boolean; regex: boolean }): SearchMatch[] {
    const text = this.doc.content;
    const matches: SearchMatch[] = [];
    if (!query.trim()) return matches;

    let re: RegExp;
    try {
      const flags = options.caseSensitive ? "g" : "gi";
      re = options.regex ? new RegExp(query, flags) : new RegExp(this.escapeRegex(query), flags);
    } catch {
      return matches;
    }

    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const from = m.index;
      const to = from + m[0].length;
      const paragraph = this.doc.getParagraphAtPos(from);
      matches.push({ from, to, paragraphIndex: paragraph.documentOffsetIndex });
      if (m[0].length === 0) re.lastIndex++;
    }
    return matches;
  }

  navigateToMatch(match: SearchMatch) {
    this.selection.setSelection(match.from, match.to);
    const coords = this.renderer.coordsAtDocPos(match.from);
    if (coords) {
      this.scroller.scrollIntoView(coords.y + this.paddingTop);
    }
    this.updateCursorVisual();
  }

  replaceMatch(from: number, to: number, replacement: string) {
    const change = this.doc.replaceRange(from, to, replacement);
    this.history.push(change, { anchor: from + replacement.length, head: from + replacement.length });
    this.selection.setSelection(from + replacement.length);
    this.handleContentChanged();
  }

  replaceAll(query: string, replacement: string, options: { caseSensitive: boolean; regex: boolean }) {
    const matches = this.search(query, options);
    if (matches.length === 0) return;

    for (let i = matches.length - 1; i >= 0; i--) {
      const m = matches[i];
      this.doc.replaceRange(m.from, m.to, replacement);
    }

    this.history.clear();
    this.selection.setSelection(0);
    this.handleContentChanged();
  }

  foldAll() {
    const blocks = this.renderer.getBlocks();
    const foldable = blocks
      .filter(b => this.renderer.isBlockFoldable(b.type));
    const toFold = foldable.filter(b => {
      const paragraph = this.doc.getParagraphAtPos(b.documentPosFrom);
      return !paragraph.text.endsWith(" ");
    });
    if (toFold.length === 0) return;
    for (let i = toFold.length - 1; i >= 0; i--) {
      const paragraphEnd = this.doc.getParagraphAtPos(toFold[i].documentPosFrom).documentPosTo;
      this.doc.insertText(paragraphEnd, " ");
    }
    this.handleContentChanged();
  }

  unfoldAll() {
    const blocks = this.renderer.getBlocks();
    const foldable = blocks
      .filter(b => this.renderer.isBlockFoldable(b.type));
    const toUnfold = foldable
      .filter(b => {
        const paragraph = this.doc.getParagraphAtPos(b.documentPosFrom);
        return paragraph.text.endsWith(" ");
      })
      .sort((a, b) => b.documentPosFrom - a.documentPosFrom);
    if (toUnfold.length === 0) return;
    for (const b of toUnfold) {
      const paragraph = this.doc.getParagraphAtPos(b.documentPosFrom);
      const trimmed = paragraph.text.replace(/\s+$/, "");
      const from = paragraph.documentPosFrom + trimmed.length;
      if (from < paragraph.documentPosTo) {
        this.doc.deleteRange(from, paragraph.documentPosTo);
      }
    }
    this.handleContentChanged();
  }

  private toggleFold(startPos: number) {
    const blocks = this.renderer.getBlocks();
    const block = blocks.find(
      (b) => b.documentPosFrom === startPos && this.renderer.isBlockFoldable(b.type),
    );

    const paragraph = this.doc.getParagraphAtPos(startPos);
    const text = paragraph.text;
    const isFolding = !text.endsWith(" ");

    // 1. 执行文本修改
    let removedCount = 0;
    if (isFolding) {
      this.doc.insertText(paragraph.documentPosTo, " ");
    } else {
      const trimmed = text.replace(/\s+$/, "");
      removedCount = text.length - trimmed.length;
      const from = paragraph.documentPosFrom + trimmed.length;
      if (from < paragraph.documentPosTo) {
        this.doc.deleteRange(from, paragraph.documentPosTo);
      }
    }

    // 2. 先转移光标
    if (block) {
      const { anchor, head } = this.selection.getSelection();
      let newAnchor = anchor;
      let newHead = head;

      if (isFolding) {
        newAnchor = this.adjustPosForFold(newAnchor, block);
        newHead = this.adjustPosForFold(newHead, block);
      } else {
        const removeFrom = paragraph.documentPosFrom + (text.length - removedCount);
        newAnchor = this.adjustPosForUnfold(newAnchor, removeFrom, removedCount);
        newHead = this.adjustPosForUnfold(newHead, removeFrom, removedCount);
      }

      this.selection.setSelection(newAnchor, newHead);
    }

    // 3. 再做其他逻辑（渲染）
    this.handleContentChanged();
  }

  private handleContentChanged(scrollFollow = false) {
    this.render("handleContentChanged", scrollFollow);
    this.onContentChange?.(this.doc.content);
  }

  private getScrollPastEndSpace(): number {
    const viewportHeight = this.scrollLayer.clientHeight;
    const lastBlockHeight = this.scroller.getLastBlockHeight();
    return Math.max(0, viewportHeight - lastBlockHeight - this.paddingTop - this.paddingBottom);
  }

  private render(reason?: string, scrollFollow = false) {
    if (!this.fontsReady) return;
    const t0 = performance.now();

    this.renderer.reconcile();
    const t1 = performance.now();

    this.updateScrollbar();
    const t2 = performance.now();

    const totalHeight = this.scroller.getTotalHeight() + this.getScrollPastEndSpace();
    this.blockLayer.style.minHeight = `${totalHeight}px`;
    const { from, to } = this.scroller.computeVisibleRange();
    this.scroller.visibleFrom = from;
    this.scroller.visibleTo = to;
    this.renderer.commit(from, to);
    const t3 = performance.now();

    this.updateCursorVisual(scrollFollow);
    const t4 = performance.now();

    this.renderer.updateDebugTopLabels();
    this.updateDebugPanel();
    const t5 = performance.now();

    console.log(
      `【测试】[render] start reason=${reason ?? ""} ｜ total=${(t5 - t0).toFixed(2)}ms | ` +
      `reconcile=${(t1 - t0).toFixed(2)}ms | ` +
      `scrollbar=${(t2 - t1).toFixed(2)}ms | ` +
      `commit=${(t3 - t2).toFixed(2)}ms | ` +
      `cursor=${(t4 - t3).toFixed(2)}ms | ` +
      `debug=${(t5 - t4).toFixed(2)}ms`
    );
  }

  private updateScrollbar() {
    const heights = this.renderer.getBlockHeights();
    this.scroller.setBlockHeights(heights);

    const viewportHeight = this.scrollLayer.clientHeight;
    const totalHeight = this.scroller.getTotalHeight() + this.getScrollPastEndSpace();
    if (totalHeight <= viewportHeight) {
      this.scrollbarEl.classList.remove("visible");
      return;
    }

    const trackHeight = viewportHeight;
    const thumbHeight = Math.max(30, (viewportHeight / totalHeight) * trackHeight);
    const scrollTop = this.scrollLayer.scrollTop;
    const maxScroll = totalHeight - viewportHeight;
    const thumbTop = maxScroll > 0 ? (scrollTop / maxScroll) * (trackHeight - thumbHeight) : 0;

    this.scrollbarThumb.style.height = `${thumbHeight}px`;
    this.scrollbarThumb.style.top = `${thumbTop}px`;
  }

  private showScrollbar() {
    this.scrollbarEl.classList.add("visible");
    clearTimeout(this.scrollbarHideTimer);
    this.scrollbarHideTimer = window.setTimeout(() => {
      if (!this.scrollbarDragging) {
        this.scrollbarEl.classList.remove("visible");
      }
    }, 1000);
  }

  private updateDebugPanel() {
    if (!this.debugPanel) return;
    const info = this.scroller.getDebugInfo();
    this.debugPanel.textContent =
      `scrollTop:  ${info.scrollTop.toFixed(0)}\n` +
      `viewport:   ${info.viewportHeight.toFixed(0)}\n` +
      `totalHeight:${info.totalHeight.toFixed(0)}\n` +
      `buffer:     [${info.bufferTop.toFixed(0)}, ${info.bufferBottom.toFixed(0)}]\n` +
      `visible:    [${info.visibleFrom}, ${info.visibleTo}] / ${info.blockCount}`;
  }

  private handleScrollForScrollbar = () => {
    this.updateScrollbar();
    this.updateDebugPanel();
    this.showScrollbar();
  };

  private handleScrollbarThumbDown = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    this.scrollbarDragging = true;
    this.scrollbarDragStartY = e.clientY;
    this.scrollbarDragStartScrollTop = this.scrollLayer.scrollTop;

    const handleMove = (me: MouseEvent) => {
      const deltaY = me.clientY - this.scrollbarDragStartY;
      const viewportHeight = this.scrollLayer.clientHeight;
      const totalHeight = this.scroller.getTotalHeight();
      const thumbHeight = Math.max(30, (viewportHeight / totalHeight) * viewportHeight);
      const maxScroll = totalHeight - viewportHeight;
      const trackRange = viewportHeight - thumbHeight;
      if (trackRange <= 0) return;
      const scrollDelta = (deltaY / trackRange) * maxScroll;
      this.scrollLayer.scrollTop = this.scrollbarDragStartScrollTop + scrollDelta;
    };

    const handleUp = () => {
      this.scrollbarDragging = false;
      document.removeEventListener("mousemove", handleMove);
      document.removeEventListener("mouseup", handleUp);
      this.showScrollbar();
    };

    document.addEventListener("mousemove", handleMove);
    document.addEventListener("mouseup", handleUp);
  };

  private handleScrollbarTrackClick = (e: MouseEvent) => {
    if (e.target === this.scrollbarThumb) return;
    e.preventDefault();

    const rect = this.scrollbarEl.getBoundingClientRect();
    const clickY = e.clientY - rect.top;
    const viewportHeight = this.scrollLayer.clientHeight;
    const totalHeight = this.scroller.getTotalHeight();
    const ratio = clickY / viewportHeight;
    this.scrollLayer.scrollTop = ratio * (totalHeight - viewportHeight);
  };

  private updateCursorVisual(scrollFollow = false) {
    const coords = this.renderer.coordsAtDocPos(this.selection.head);
    if (coords) {
      const x = coords.x + this.paddingLeft;
      const y = coords.y + this.paddingTop;
      this.selection.updateCursorPosition(x, y, coords.height);
      this.input.moveTextareaToCursor(x, y);

      if (scrollFollow) {
        this.ensureCursorVisible(y, coords.height);
      }
    }

    if (this.selection.hasSelection) {
      this.renderSelectionHighlight();
    } else {
      this.selection.clearSelectionRects();
    }
  }

  private ensureCursorVisible(cursorY: number, cursorHeight: number) {
    const scrollTop = this.scrollLayer.scrollTop;
    const viewportHeight = this.scrollLayer.clientHeight;
    const cursorBottom = cursorY + cursorHeight;
    const margin = 8;

    // 光标底部超出视口底部 → 向下滚动
    if (cursorBottom > scrollTop + viewportHeight - margin) {
      this.scrollLayer.scrollTop = cursorBottom - viewportHeight + margin;
    }
    // 光标顶部超出视口顶部 → 向上滚动
    else if (cursorY < scrollTop + margin) {
      this.scrollLayer.scrollTop = cursorY - margin;
    }
  }

  private renderSelectionHighlight() {
    const from = this.selection.documentPosFrom;
    const to = this.selection.documentPosTo;
    const rects: { x: number; y: number; width: number; height: number }[] = [];
    const contentWidth = this.renderer.getContentWidth();
    const pl = this.paddingLeft;
    const pt = this.paddingTop;

    const fromCoords = this.renderer.coordsAtDocPos(from);
    const toCoords = this.renderer.coordsAtDocPos(to, 'backward');
    if (!fromCoords || !toCoords) return;

    const fy = fromCoords.y + pt;
    const ty = toCoords.y + pt;
    const fx = fromCoords.x + pl;
    const tx = toCoords.x + pl;

    if (Math.abs(fromCoords.y - toCoords.y) < 1) {
      rects.push({
        x: fx,
        y: fy,
        width: tx - fx,
        height: fromCoords.height,
      });
    } else {
      rects.push({
        x: fx,
        y: fy,
        width: pl + contentWidth - fx,
        height: fromCoords.height,
      });

      if (ty - fy - fromCoords.height > 1) {
        rects.push({
          x: pl,
          y: fy + fromCoords.height,
          width: contentWidth,
          height: ty - fy - fromCoords.height,
        });
      }

      rects.push({
        x: pl,
        y: ty,
        width: tx - pl,
        height: toCoords.height,
      });
    }

    this.selection.renderSelectionRects(rects);
  }

  private handleCompositionUpdate(pos: number, len: number) {
    // render 已在 onContentChanged 中完成，此处绘制组合范围下划线
    this.renderCompositionDecoration(pos, len);
  }

  private handleCompositionEnd() {
    this.compositionLayer.innerHTML = "";
  }

  private renderCompositionDecoration(pos: number, len: number) {
    this.compositionLayer.innerHTML = "";
    if (len <= 0) return;

    const fromCoords = this.renderer.coordsAtDocPos(pos);
    const toCoords = this.renderer.coordsAtDocPos(pos + len, 'backward');
    if (!fromCoords || !toCoords) return;

    const pl = this.paddingLeft;
    const pt = this.paddingTop;
    const fx = fromCoords.x + pl;
    const fy = fromCoords.y + pt;
    const tx = toCoords.x + pl;

    // 单行组合文本（绝大多数情况）
    const underline = document.createElement("div");
    underline.className = "native-editor-composition-underline";
    underline.style.left = `${fx}px`;
    underline.style.top = `${fy + fromCoords.height - 2}px`;
    underline.style.width = `${tx - fx}px`;
    this.compositionLayer.appendChild(underline);
  }

  private handleMouseDown = (e: MouseEvent) => {
    e.preventDefault();
    const t = e.target as HTMLElement;

    const btn = t.closest(".cm-copy-code-btn, .cm-lang-selector");
    if (btn) {
      this.input.focus();
      return;
    }

    // 点击 block widget 渲染区域时，编辑器失焦
    const widgetRender = t.closest(".cm-table-block-render, .cm-math-block-render, .cm-image-block-render, .cm-html-block-render, .cm-mermaid-block-render");
    if (widgetRender) {
      this.input.blur();
      this.cursorEl.style.display = "none";
      this.selection.clearSelectionRects();
      return;
    }

    if (this.events.handleClick(e)) {
      this.input.focus();
      return;
    }

    const pos = this.renderer.getDocumentPosIndexAtCoords(e.clientX, e.clientY);
    this.renderer.resetGoalColumn();

    if (e.shiftKey) {
      this.selection.setSelection(this.selection.anchor, pos);
    } else {
      this.selection.setSelection(pos);
    }

    this.input.focus();

    let autoScrolling = false;
    let rafId = 0;
    let lastClientX = e.clientX;
    let lastClientY = e.clientY;

    // 记住选区起始时所在的代码块滚动容器，鼠标离开后仍可对其横向滚动
    const initEl = document.elementFromPoint(e.clientX, e.clientY);
    let activeCodeScroll: HTMLElement | null = initEl?.closest('.cm-codeblock-scroll') as HTMLElement | null;

    const autoScrollLoop = () => {
      const rect = this.scrollLayer.getBoundingClientRect();
      let scrolled = false;

      // 垂直自动滚动
      if (lastClientY < rect.top) {
        const dist = rect.top - lastClientY;
        const speed = Math.min(20, dist * 0.2);
        this.scrollLayer.scrollTop -= speed;
        scrolled = true;
      } else if (lastClientY > rect.bottom) {
        const dist = lastClientY - rect.bottom;
        const speed = Math.min(20, dist * 0.2);
        this.scrollLayer.scrollTop += speed;
        scrolled = true;
      }

      // 代码块横向自动滚动
      // 尝试从当前鼠标位置检测代码块，若检测不到则使用记忆的起始代码块
      const clampedY = Math.max(rect.top + 1, Math.min(lastClientY, rect.bottom - 1));
      const clampedX = Math.max(rect.left + 1, Math.min(lastClientX, rect.right - 1));
      const elAtPoint = document.elementFromPoint(clampedX, clampedY);
      const detectedScroll = elAtPoint?.closest('.cm-codeblock-scroll') as HTMLElement | null;
      // 更新活跃代码块：优先使用检测到的，否则保留之前记忆的
      if (detectedScroll) {
        activeCodeScroll = detectedScroll;
      }
      const codeScroll = activeCodeScroll;
      if (codeScroll && codeScroll.scrollWidth > codeScroll.clientWidth) {
        const codeRect = codeScroll.getBoundingClientRect();
        const edgeZone = 30;
        const maxScrollable = codeScroll.scrollWidth - codeScroll.clientWidth;
        // 鼠标超出右边缘 或 在右侧边缘区域内且有更多内容可滚动
        if (lastClientX > codeRect.right) {
          const dist = lastClientX - codeRect.right;
          codeScroll.scrollLeft += Math.min(15, dist * 0.2);
          scrolled = true;
        } else if (lastClientX > codeRect.right - edgeZone && codeScroll.scrollLeft < maxScrollable) {
          const dist = edgeZone - (codeRect.right - lastClientX);
          codeScroll.scrollLeft += Math.min(12, Math.max(1, dist * 0.15));
          scrolled = true;
        }
        // 鼠标超出左边缘 或 在左侧边缘区域内且有更多内容可滚动
        if (lastClientX < codeRect.left) {
          const dist = codeRect.left - lastClientX;
          codeScroll.scrollLeft -= Math.min(15, dist * 0.2);
          scrolled = true;
        } else if (lastClientX < codeRect.left + edgeZone && codeScroll.scrollLeft > 0) {
          const dist = edgeZone - (lastClientX - codeRect.left);
          codeScroll.scrollLeft -= Math.min(12, Math.max(1, dist * 0.15));
          scrolled = true;
        }
      }

      // 滚动后更新选区
      if (scrolled) {
        const movePos = this.renderer.getDocumentPosIndexAtCoords(lastClientX, lastClientY);
        this.selection.setSelection(this.selection.anchor, movePos);
      }

      rafId = requestAnimationFrame(autoScrollLoop);
    };

    const handleMouseMove = (me: MouseEvent) => {
      me.preventDefault();
      lastClientX = me.clientX;
      lastClientY = me.clientY;
      const movePos = this.renderer.getDocumentPosIndexAtCoords(me.clientX, me.clientY);
      this.selection.setSelection(this.selection.anchor, movePos);

      if (!autoScrolling) {
        autoScrolling = true;
        rafId = requestAnimationFrame(autoScrollLoop);
      }
    };

    const handleMouseUp = () => {
      autoScrolling = false;
      cancelAnimationFrame(rafId);
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  private handleFoldToggle(startPos: number) {
    this.toggleFold(startPos);
  }

  private adjustPosForFold(pos: number, block: Block): number {
    if (pos < block.documentPosFrom) return pos;
    if (pos > block.documentPosTo) return pos + 1;

    const endParagraphIndex = this.doc.getParagraphAtPos(block.documentPosTo).documentOffsetIndex;
    if (endParagraphIndex < this.doc.paraphsLength - 1) {
      return this.doc.getParagraph(endParagraphIndex + 1).documentPosFrom;
    }
    // 没有下一行，创建一行
    this.doc.insertText(this.doc.length, "\n");
    return this.doc.getParagraph(this.doc.paraphsLength - 1).documentPosFrom;
  }

  private adjustPosForUnfold(pos: number, removeFrom: number, removedCount: number): number {
    if (pos <= removeFrom) return pos;
    return Math.max(removeFrom, pos - removedCount);
  }

  private toggleTask(paraNum: number) {
    const paragraph = this.doc.getParagraph(paraNum);
    const text = paragraph.text;
    console.log("[TaskToggle] toggleTask called, paraNum:", paraNum, "text:", JSON.stringify(text));
    const unchecked = text.indexOf("[ ]");
    const checkedLower = text.indexOf("[x]");
    const checkedUpper = text.indexOf("[X]");
    const checked = checkedLower >= 0 ? checkedLower : checkedUpper;
    console.log("[TaskToggle] unchecked idx:", unchecked, "checked idx:", checked, "(lower:", checkedLower, "upper:", checkedUpper, ")");

    if (unchecked >= 0) {
      const pos = paragraph.documentPosFrom + unchecked;
      console.log("[TaskToggle] replacing [ ] -> [x] at pos:", pos);
      const change = this.doc.replaceRange(pos, pos + 3, "[x]");
      this.history.push(change, this.selection.getSelection());
      this.handleContentChanged();
    } else if (checked >= 0) {
      const pos = paragraph.documentPosFrom + checked;
      console.log("[TaskToggle] replacing [x]/[X] -> [ ] at pos:", pos);
      const change = this.doc.replaceRange(pos, pos + 3, "[ ]");
      this.history.push(change, this.selection.getSelection());
      this.handleContentChanged();
    } else {
      console.log("[TaskToggle] no checkbox found in text!");
    }
  }

  private escapeRegex(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  destroy() {
    this.destroyed = true;
    this.resizeObserver.disconnect();
    clearTimeout(this.scrollbarHideTimer);
    this.scrollLayer.removeEventListener("mousedown", this.handleMouseDown);
    this.scrollLayer.removeEventListener("scroll", this.handleScrollForScrollbar);
    this.scrollLayer.removeEventListener("keydown", this.input.handleKeyDown);
    this.input.destroy();
    this.events.destroy();
    this.scroller.destroy();
    this.selection.destroy();
    this.renderer.clear();

    this.debugPanel?.remove();
    this.scrollbarEl.remove();
    this.scrollLayer.remove();
  }
}
