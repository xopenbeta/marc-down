export class VirtualScroller {
  private scrollContainer: HTMLDivElement;
  private blockHeights: number[] = [];
  private blockYs: number[] = [];
  private totalHeight = 0;
  private viewportHeight = 0;
  private bufferRatio = 3;

  visibleFrom = 0;
  visibleTo = 0;

  onViewportChange: ((from: number, to: number) => void) | null = null;

  constructor(scrollContainer: HTMLDivElement) {
    this.scrollContainer = scrollContainer;
    this.scrollContainer.addEventListener("scroll", this.handleScroll);
  }

  setBlockHeights(heights: number[]) {
    this.blockHeights = heights;
    this.recomputeYs();
  }

  private recomputeYs() {
    this.blockYs = new Array(this.blockHeights.length);
    let y = 0;
    for (let i = 0; i < this.blockHeights.length; i++) {
      this.blockYs[i] = y;
      y += this.blockHeights[i];
    }
    this.totalHeight = y;
  }

  getBlockY(index: number): number {
    return this.blockYs[index] ?? 0;
  }

  getTotalHeight(): number {
    return this.totalHeight;
  }

  getLastBlockHeight(): number {
    if (this.blockHeights.length === 0) return 0;
    return this.blockHeights[this.blockHeights.length - 1];
  }

  getScrollTop(): number {
    return this.scrollContainer.scrollTop;
  }

  setScrollTop(top: number) {
    this.scrollContainer.scrollTop = top;
  }

  blockIndexAtY(y: number): number {
    let lo = 0;
    let hi = this.blockYs.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (this.blockYs[mid] <= y) {
        lo = mid;
      } else {
        hi = mid - 1;
      }
    }
    return lo;
  }

  computeVisibleRange(): { from: number; to: number } {
    this.viewportHeight = this.scrollContainer.clientHeight;
    const scrollTop = this.scrollContainer.scrollTop;
    const buf = this.viewportHeight * this.bufferRatio;
    const rangeTop = Math.max(0, scrollTop - buf);
    const rangeBottom = scrollTop + this.viewportHeight + buf;

    const from = this.blockIndexAtY(rangeTop);
    let to = this.blockIndexAtY(rangeBottom);
    if (to < this.blockHeights.length - 1) to++;

    return { from, to };
  }

  private handleScroll = () => {
    const { from, to } = this.computeVisibleRange();
    if (from !== this.visibleFrom || to !== this.visibleTo) {
      this.visibleFrom = from;
      this.visibleTo = to;
      this.onViewportChange?.(from, to);
    }
  };

  scrollIntoView(y: number) {
    this.scrollContainer.scrollTop = y;
  }

  setScrollEnabled(enabled: boolean) {
    this.scrollContainer.style.overflowY = enabled ? "scroll" : "hidden";
  }

  getDebugInfo() {
    const viewportHeight = this.scrollContainer.clientHeight;
    const scrollTop = this.scrollContainer.scrollTop;
    const buf = viewportHeight * this.bufferRatio;
    return {
      scrollTop,
      viewportHeight,
      totalHeight: this.totalHeight,
      bufferTop: Math.max(0, scrollTop - buf),
      bufferBottom: scrollTop + viewportHeight + buf,
      visibleFrom: this.visibleFrom,
      visibleTo: this.visibleTo,
      blockCount: this.blockHeights.length,
    };
  }

  destroy() {
    this.scrollContainer.removeEventListener("scroll", this.handleScroll);
  }
}
