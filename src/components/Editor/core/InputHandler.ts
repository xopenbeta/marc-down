import type { Document } from "./parsers/types";
import type { History } from "./History";
import type { SelectionManager } from "./SelectionManager";

export interface InputHandlerCallbacks {
  onContentChanged: () => void;
  onCursorMoved: () => void;
  requestRender: () => void;
  visualLineMove: (pos: number, direction: "up" | "down") => number;
  resetGoalColumn: () => void;
  onCompositionUpdate: (pos: number, len: number) => void;
  onCompositionEnd: () => void;
}

export class InputHandler {
  private textarea: HTMLTextAreaElement;
  private doc: Document;
  private history: History;
  private selection: SelectionManager;
  private callbacks: InputHandlerCallbacks;
  private composing = false;
  private compositionJustEnded = false;
  private suppressInput = false;
  private compositionPos = 0;
  private compositionLen = 0;

  constructor(
    container: HTMLElement,
    doc: Document,
    history: History,
    selection: SelectionManager,
    callbacks: InputHandlerCallbacks,
  ) {
    this.doc = doc;
    this.history = history;
    this.selection = selection;
    this.callbacks = callbacks;

    this.textarea = document.createElement("textarea");
    this.textarea.className = "md-hidden-textarea";
    this.textarea.setAttribute("autocorrect", "off");
    this.textarea.setAttribute("autocapitalize", "off");
    this.textarea.setAttribute("spellcheck", "false");
    this.textarea.setAttribute("tabindex", "0");
    this.textarea.style.cssText = `
      position: absolute;
      opacity: 0;
      width: 1px;
      height: 1em;
      padding: 0;
      border: none;
      outline: none;
      resize: none;
      overflow: hidden;
      white-space: pre;
      z-index: 1;
      pointer-events: none;
    `;
    container.appendChild(this.textarea);

    this.textarea.addEventListener("input", this.handleInput);
    this.textarea.addEventListener("compositionstart", this.handleCompositionStart);
    this.textarea.addEventListener("compositionend", this.handleCompositionEnd);
    this.textarea.addEventListener("paste", this.handlePaste);
    this.textarea.addEventListener("copy", this.handleCopy);
    this.textarea.addEventListener("cut", this.handleCut);
  }

  focus() {
    this.textarea.focus({ preventScroll: true });
  }

  blur() {
    this.textarea.blur();
  }

  isFocused(): boolean {
    return document.activeElement === this.textarea;
  }

  moveTextareaToCursor(x: number, y: number) {
    this.textarea.style.left = `${x}px`;
    this.textarea.style.top = `${y}px`;
  }

  handleKeyDown = (e: KeyboardEvent) => {
    // IME 组合期间或刚结束时不处理按键（Enter/Backspace 等由 IME 自行管理）
    if (this.composing || e.isComposing || this.compositionJustEnded) return;

    const isMod = e.metaKey || e.ctrlKey;

    if (isMod && e.key === "z" && !e.shiftKey) {
      e.preventDefault();
      const sel = this.history.undo();
      if (sel) {
        this.selection.setSelection(sel.anchor, sel.head);
        this.callbacks.onContentChanged();
      }
      return;
    }

    if (isMod && e.key === "z" && e.shiftKey) {
      e.preventDefault();
      const sel = this.history.redo();
      if (sel) {
        this.selection.setSelection(sel.anchor, sel.head);
        this.callbacks.onContentChanged();
      }
      return;
    }

    if (isMod && e.key === "a") {
      e.preventDefault();
      this.selection.setSelection(0, this.doc.length);
      this.callbacks.onCursorMoved();
      return;
    }

    if (e.key === "Enter") {
      e.preventDefault();
      this.deleteSelectionIfAny();
      const pos = this.selection.head;
      const para = this.doc.getParagraphAtPos(pos);
      let insert = "\n";
      const paraText = para.text;
      const listMatch = paraText.match(/^(\s*(?:[-*+]|\d+\.)\s+)/);
      if (listMatch && pos === para.documentPosTo) {
        if (paraText.trim() === listMatch[0].trim()) {
          const change = this.doc.replaceRange(para.documentPosFrom, para.documentPosTo, "");
          this.pushHistory(change, pos);
          return;
        }
        const numMatch = listMatch[1].match(/^(\s*)(\d+)(\.)\s+/);
        if (numMatch) {
          const nextNum = parseInt(numMatch[2]) + 1;
          insert = `\n${numMatch[1]}${nextNum}${numMatch[3]} `;
        } else {
          insert = `\n${listMatch[1]}`;
        }
      }
      const change = this.doc.insertText(pos, insert);
      const newPos = pos + insert.length;
      this.pushHistory(change, newPos);
      return;
    }

    if (e.key === "Backspace") {
      e.preventDefault();
      if (this.selection.hasSelection) {
        this.deleteSelectionIfAny();
      } else {
        const pos = this.selection.head;
        if (pos > 0) {
          const change = this.doc.deleteRange(pos - 1, pos);
          this.pushHistory(change, pos - 1);
        }
      }
      return;
    }

    if (e.key === "Delete") {
      e.preventDefault();
      if (this.selection.hasSelection) {
        this.deleteSelectionIfAny();
      } else {
        const pos = this.selection.head;
        if (pos < this.doc.length) {
          const change = this.doc.deleteRange(pos, pos + 1);
          this.pushHistory(change, pos);
        }
      }
      return;
    }

    if (e.key === "Tab") {
      e.preventDefault();
      if (e.shiftKey) {
        this.dedent();
      } else {
        this.indent();
      }
      return;
    }

    if (e.key === "ArrowLeft" || e.key === "ArrowRight" || e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      const pos = this.selection.head;
      let newPos: number;

      switch (e.key) {
        case "ArrowLeft":
          this.callbacks.resetGoalColumn();
          if (isMod) {
            newPos = this.doc.getParagraphAtPos(pos).documentPosFrom;
          } else if (e.altKey) {
            newPos = this.prevWordBoundary(pos);
          } else if (this.selection.hasSelection && !e.shiftKey) {
            newPos = this.selection.documentPosFrom;
          } else {
            newPos = Math.max(0, pos - 1);
          }
          break;
        case "ArrowRight":
          this.callbacks.resetGoalColumn();
          if (isMod) {
            newPos = this.doc.getParagraphAtPos(pos).documentPosTo;
          } else if (e.altKey) {
            newPos = this.nextWordBoundary(pos);
          } else if (this.selection.hasSelection && !e.shiftKey) {
            newPos = this.selection.documentPosTo;
          } else {
            newPos = Math.min(this.doc.length, pos + 1);
          }
          break;
        case "ArrowUp":
          if (isMod) {
            this.callbacks.resetGoalColumn();
            newPos = 0;
          } else {
            newPos = this.callbacks.visualLineMove(pos, "up");
          }
          break;
        case "ArrowDown":
          if (isMod) {
            this.callbacks.resetGoalColumn();
            newPos = this.doc.length;
          } else {
            newPos = this.callbacks.visualLineMove(pos, "down");
          }
          break;
        default:
          newPos = pos;
      }

      if (e.shiftKey) {
        this.selection.setSelection(this.selection.anchor, newPos);
      } else {
        this.selection.setSelection(newPos);
      }
      this.callbacks.onCursorMoved();
      return;
    }

    if (isMod && (e.key === "c" || e.key === "x")) {
      if (this.selection.hasSelection) {
        const text = this.doc.sliceContent(this.selection.documentPosFrom, this.selection.documentPosTo);
        this.textarea.value = text;
        this.textarea.select();
        this.suppressInput = true;
      }
      if (e.key === "x" && this.selection.hasSelection) {
        setTimeout(() => {
          this.deleteSelectionIfAny();
        }, 10);
      }
      return;
    }
  };

  private handleInput = () => {
    if (this.suppressInput) {
      this.suppressInput = false;
      return;
    }

    if (this.composing) {
      // IME 组合中：将组合文本直接写入文档，走正常 render 流程
      const text = this.textarea.value;
      this.doc.replaceRange(
        this.compositionPos,
        this.compositionPos + this.compositionLen,
        text,
      );
      this.compositionLen = text.length;
      this.selection.setSelection(this.compositionPos + this.compositionLen);
      this.callbacks.onContentChanged();
      this.callbacks.onCompositionUpdate(this.compositionPos, this.compositionLen);
      return;
    }

    const text = this.textarea.value;
    if (!text) return;
    this.textarea.value = "";

    this.deleteSelectionIfAny();
    const pos = this.selection.head;
    const change = this.doc.insertText(pos, text);
    const newPos = pos + text.length;
    this.pushHistory(change, newPos);
  };

  private handleCompositionStart = () => {
    this.composing = true;
    this.deleteSelectionIfAny();
    this.compositionPos = this.selection.head;
    this.compositionLen = 0;
  };

  private handleCompositionEnd = () => {
    this.composing = false;
    this.compositionJustEnded = true;
    setTimeout(() => { this.compositionJustEnded = false; }, 0);

    const finalText = this.textarea.value;
    this.textarea.value = "";

    // 先移除组合期间临时写入的文本
    if (this.compositionLen > 0) {
      this.doc.replaceRange(
        this.compositionPos,
        this.compositionPos + this.compositionLen,
        "",
      );
    }

    // 再通过正常路径插入最终文本（带历史记录）
    if (finalText) {
      const change = this.doc.insertText(this.compositionPos, finalText);
      const newPos = this.compositionPos + finalText.length;
      const sel = { anchor: newPos, head: newPos };
      this.history.push(change, sel);
      this.selection.setSelection(newPos);
    } else {
      this.selection.setSelection(this.compositionPos);
    }

    this.compositionLen = 0;
    this.callbacks.onCompositionEnd();
    this.callbacks.onContentChanged();
  };

  private handlePaste = (e: ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData?.getData("text/plain");
    if (!text) return;
    this.deleteSelectionIfAny();
    const pos = this.selection.head;
    const change = this.doc.insertText(pos, text);
    const newPos = pos + text.length;
    this.pushHistory(change, newPos);
  };

  private handleCopy = () => {
    if (this.selection.hasSelection) {
      const text = this.doc.sliceContent(this.selection.documentPosFrom, this.selection.documentPosTo);
      this.textarea.value = text;
      this.textarea.select();
    }
  };

  private handleCut = () => {
    if (this.selection.hasSelection) {
      const text = this.doc.sliceContent(this.selection.documentPosFrom, this.selection.documentPosTo);
      this.textarea.value = text;
      this.textarea.select();
      setTimeout(() => {
        this.deleteSelectionIfAny();
      }, 10);
    }
  };

  private deleteSelectionIfAny() {
    if (!this.selection.hasSelection) return;
    const from = this.selection.documentPosFrom;
    const to = this.selection.documentPosTo;
    const change = this.doc.deleteRange(from, to);
    this.selection.setSelection(from);
    this.history.push(change, { anchor: from, head: from });
    this.callbacks.onContentChanged();
  }

  private indent() {
    const pos = this.selection.head;
    const change = this.doc.insertText(pos, "  ");
    this.pushHistory(change, pos + 2);
  }

  private prevWordBoundary(pos: number): number {
    const text = this.doc.content;
    if (pos <= 0) return 0;
    let p = pos - 1;
    while (p > 0 && /\s/.test(text[p])) p--;
    if (p > 0 && /\W/.test(text[p])) {
      while (p > 0 && /\W/.test(text[p - 1]) && !/\s/.test(text[p - 1])) p--;
      return p;
    }
    while (p > 0 && /\w/.test(text[p - 1])) p--;
    return p;
  }

  private nextWordBoundary(pos: number): number {
    const text = this.doc.content;
    const len = text.length;
    if (pos >= len) return len;
    let p = pos;
    if (/\w/.test(text[p])) {
      while (p < len && /\w/.test(text[p])) p++;
    } else if (!/\s/.test(text[p])) {
      while (p < len && /\W/.test(text[p]) && !/\s/.test(text[p])) p++;
    }
    while (p < len && /\s/.test(text[p])) p++;
    return p;
  }

  private dedent() {
    const pos = this.selection.head;
    const paragraph = this.doc.getParagraphAtPos(pos);
    const paraText = paragraph.text;
    if (paraText.startsWith("  ")) {
      const change = this.doc.deleteRange(paragraph.documentPosFrom, paragraph.documentPosFrom + 2);
      this.pushHistory(change, Math.max(pos - 2, paragraph.documentPosFrom));
    } else if (paraText.startsWith("\t")) {
      const change = this.doc.deleteRange(paragraph.documentPosFrom, paragraph.documentPosFrom + 1);
      this.pushHistory(change, Math.max(pos - 1, paragraph.documentPosFrom));
    }
  }

  private pushHistory(change: ReturnType<Document["replaceRange"]>, newPos: number) {
    const sel = { anchor: newPos, head: newPos };
    this.history.push(change, sel);
    this.selection.setSelection(newPos);
    this.callbacks.onContentChanged();
  }

  destroy() {
    this.textarea.removeEventListener("input", this.handleInput);
    this.textarea.removeEventListener("compositionstart", this.handleCompositionStart);
    this.textarea.removeEventListener("compositionend", this.handleCompositionEnd);
    this.textarea.removeEventListener("paste", this.handlePaste);
    this.textarea.removeEventListener("copy", this.handleCopy);
    this.textarea.removeEventListener("cut", this.handleCut);
    this.textarea.remove();
  }
}
