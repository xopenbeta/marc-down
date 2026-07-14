import type { Document, Change } from "./parsers/types";

interface HistoryEntry {
  changes: Change[];
  selectionBefore: { anchor: number; head: number };
  selectionAfter: { anchor: number; head: number };
  timestamp: number;
}

const MAX_HISTORY = 200;
const MERGE_INTERVAL_MS = 500;

export class History {
  private undoStack: HistoryEntry[] = [];
  private redoStack: HistoryEntry[] = [];
  private doc: Document;
  private getSelection: () => { anchor: number; head: number };

  constructor(
    doc: Document,
    getSelection: () => { anchor: number; head: number },
  ) {
    this.doc = doc;
    this.getSelection = getSelection;
  }

  push(change: Change, selectionAfter: { anchor: number; head: number }) {
    const now = Date.now();
    const last = this.undoStack[this.undoStack.length - 1];

    if (last && this.canMerge(last, change, now)) {
      last.changes.push(change);
      last.selectionAfter = selectionAfter;
      last.timestamp = now;
    } else {
      this.undoStack.push({
        changes: [change],
        selectionBefore: this.getSelection(),
        selectionAfter,
        timestamp: now,
      });
      if (this.undoStack.length > MAX_HISTORY) {
        this.undoStack.shift();
      }
    }

    this.redoStack.length = 0;
  }

  undo(): { anchor: number; head: number } | null {
    const entry = this.undoStack.pop();
    if (!entry) return null;

    const selBefore = this.getSelection();
    for (let i = entry.changes.length - 1; i >= 0; i--) {
      const c = entry.changes[i];
      this.doc.replaceRange(c.documentPosFrom, c.documentPosFrom + c.inserted.length, c.removed);
    }

    this.redoStack.push({
      changes: entry.changes,
      selectionBefore: entry.selectionBefore,
      selectionAfter: selBefore,
      timestamp: entry.timestamp,
    });

    return entry.selectionBefore;
  }

  redo(): { anchor: number; head: number } | null {
    const entry = this.redoStack.pop();
    if (!entry) return null;

    for (const c of entry.changes) {
      this.doc.replaceRange(c.documentPosFrom, c.documentPosFrom + c.removed.length, c.inserted);
    }

    this.undoStack.push({
      changes: entry.changes,
      selectionBefore: entry.selectionBefore,
      selectionAfter: entry.selectionAfter,
      timestamp: entry.timestamp,
    });

    return entry.selectionAfter;
  }

  clear() {
    this.undoStack.length = 0;
    this.redoStack.length = 0;
  }

  private canMerge(last: HistoryEntry, change: Change, now: number): boolean {
    if (now - last.timestamp > MERGE_INTERVAL_MS) return false;
    if (change.removed.length > 0 && change.inserted.length > 0) return false;
    if (change.inserted.includes("\n") || change.removed.includes("\n")) return false;
    const lastChange = last.changes[last.changes.length - 1];
    if (change.inserted.length === 1 && lastChange.inserted.length > 0) {
      const expectedPos = lastChange.documentPosFrom + lastChange.inserted.length;
      return change.documentPosFrom === expectedPos;
    }
    if (change.removed.length === 1 && lastChange.removed.length > 0) {
      return change.documentPosFrom === lastChange.documentPosFrom - 1 || change.documentPosFrom === lastChange.documentPosFrom;
    }
    return false;
  }
}
