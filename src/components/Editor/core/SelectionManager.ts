export interface EditorSelection {
  anchor: number;
  head: number;
}

export class SelectionManager {
  anchor = 0;
  head = 0;
  private cursorEl: HTMLDivElement | null = null;
  private selectionLayer: HTMLDivElement | null = null;
  private blinkTimer = 0;
  private blinkVisible = true;

  onSelectionChange: (() => void) | null = null;

  get documentPosFrom(): number {
    return Math.min(this.anchor, this.head);
  }

  get documentPosTo(): number {
    return Math.max(this.anchor, this.head);
  }

  get hasSelection(): boolean {
    return this.anchor !== this.head;
  }

  getSelection(): EditorSelection {
    return { anchor: this.anchor, head: this.head };
  }

  setSelection(anchor: number, head?: number) {
    this.anchor = anchor;
    this.head = head ?? anchor;
    this.restartBlink();
    this.onSelectionChange?.();
  }

  setCursorElement(el: HTMLDivElement) {
    this.cursorEl = el;
    this.startBlink();
  }

  setSelectionLayer(el: HTMLDivElement) {
    this.selectionLayer = el;
  }

  updateCursorPosition(x: number, y: number, height: number) {
    if (!this.cursorEl) return;
    this.cursorEl.style.left = `${x}px`;
    this.cursorEl.style.top = `${y}px`;
    this.cursorEl.style.height = `${height}px`;
    this.cursorEl.style.display = this.hasSelection ? "none" : "";
    this.blinkVisible = true;
    this.cursorEl.style.opacity = "1";
  }

  renderSelectionRects(rects: { x: number; y: number; width: number; height: number }[]) {
    if (!this.selectionLayer) return;
    this.selectionLayer.innerHTML = "";
    for (const r of rects) {
      const div = document.createElement("div");
      div.className = "cm-selectionBackground";
      div.style.cssText = `position:absolute;left:${r.x}px;top:${r.y}px;width:${r.width}px;height:${r.height}px;`;
      this.selectionLayer.appendChild(div);
    }
  }

  clearSelectionRects() {
    if (this.selectionLayer) this.selectionLayer.innerHTML = "";
  }

  private startBlink() {
    this.stopBlink();
    this.blinkVisible = true;
    this.blinkTimer = window.setInterval(() => {
      this.blinkVisible = !this.blinkVisible;
      if (this.cursorEl) {
        this.cursorEl.style.opacity = this.blinkVisible ? "1" : "0";
      }
    }, 530);
  }

  private restartBlink() {
    if (this.cursorEl) {
      this.blinkVisible = true;
      this.cursorEl.style.opacity = "1";
    }
    this.startBlink();
  }

  private stopBlink() {
    if (this.blinkTimer) {
      clearInterval(this.blinkTimer);
      this.blinkTimer = 0;
    }
  }

  destroy() {
    this.stopBlink();
  }
}
