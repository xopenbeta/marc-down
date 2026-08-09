import { describe, expect, it, beforeEach } from "vitest";
import { History } from "./History";
import { Document } from "./parsers/types";
import type { Change } from "./parsers/types";

function setup() {
  const doc = new Document();
  let sel: { anchor: number; head: number } = { anchor: 0, head: 0 };
  const history = new History(doc, () => sel);
  const updateSel = (anchor: number, head?: number) => {
    sel = { anchor, head: head ?? anchor };
  };
  // helper: apply a change to the doc and push to history
  // IMPORTANT: push first (to capture selection-before), then update sel after
  const type = (text: string, at: number) => {
    const change = doc.insertText(at, text);
    const newPos = at + text.length;
    history.push(change, { anchor: newPos, head: newPos });
    updateSel(newPos);
    return change;
  };
  const backspace = (at: number) => {
    if (at <= 0) return;
    const change = doc.deleteRange(at - 1, at);
    history.push(change, { anchor: at - 1, head: at - 1 });
    updateSel(at - 1);
    return change;
  };
  const del = (at: number) => {
    if (at >= doc.length) return;
    const change = doc.deleteRange(at, at + 1);
    history.push(change, { anchor: at, head: at });
    updateSel(at);
    return change;
  };
  const replace = (from: number, to: number, insertion: string) => {
    const change = doc.replaceRange(from, to, insertion);
    const newPos = from + insertion.length;
    history.push(change, { anchor: newPos, head: newPos });
    updateSel(newPos);
    return change;
  };
  return { doc, history, updateSel, type, backspace, del, replace };
}

describe("History", () => {
  let ctx: ReturnType<typeof setup>;

  beforeEach(() => {
    ctx = setup();
  });

  // ── basic undo/redo ──
  it("undo reverses a single insertion", () => {
    ctx.doc.setContent("hello");
    ctx.updateSel(5);
    ctx.history.clear();

    ctx.type(" world", 5);
    expect(ctx.doc.content).toBe("hello world");

    const sel = ctx.history.undo();
    expect(ctx.doc.content).toBe("hello");
    expect(sel).toEqual({ anchor: 5, head: 5 });
  });

  it("undo reverses a single deletion", () => {
    ctx.doc.setContent("hello");
    ctx.updateSel(5);
    ctx.history.clear();

    ctx.backspace(5); // delete 'o'
    expect(ctx.doc.content).toBe("hell");

    const sel = ctx.history.undo();
    expect(ctx.doc.content).toBe("hello");
    // selectionBefore captured before push: cursor was at position 5
    expect(sel).toEqual({ anchor: 5, head: 5 });
  });

  it("redo reapplies an undone insertion", () => {
    ctx.doc.setContent("hello");
    ctx.updateSel(5);
    ctx.history.clear();

    ctx.type(" world", 5);

    ctx.history.undo();
    expect(ctx.doc.content).toBe("hello");

    const sel = ctx.history.redo();
    expect(ctx.doc.content).toBe("hello world");
    expect(sel).toEqual({ anchor: 11, head: 11 });
  });

  it("redo reapplies an undone deletion", () => {
    ctx.doc.setContent("hello");
    ctx.updateSel(5);
    ctx.history.clear();

    ctx.backspace(5);

    ctx.history.undo();
    expect(ctx.doc.content).toBe("hello");

    const sel = ctx.history.redo();
    expect(ctx.doc.content).toBe("hell");
    expect(sel).toEqual({ anchor: 4, head: 4 });
  });

  // ── multi-step undo ──
  it("undo multiple operations in reverse order", () => {
    ctx.doc.setContent("abc");
    ctx.updateSel(3);
    ctx.history.clear();

    // Use multi-char insertions so they don't merge (merge only for single-char)
    ctx.type("de", 3); // abcde
    ctx.type("fg", 5); // abcdefg
    ctx.type("hi", 7); // abcdefghi

    ctx.history.undo(); // remove hi
    expect(ctx.doc.content).toBe("abcdefg");
    ctx.history.undo(); // remove fg
    expect(ctx.doc.content).toBe("abcde");
    ctx.history.undo(); // remove de
    expect(ctx.doc.content).toBe("abc");
  });

  it("redo after multi-undo replays in order", () => {
    ctx.doc.setContent("abc");
    ctx.updateSel(3);
    ctx.history.clear();

    // Use multi-char insertions so they don't merge
    ctx.type("de", 3);
    ctx.type("fg", 5);

    ctx.history.undo();
    ctx.history.undo();
    expect(ctx.doc.content).toBe("abc");

    ctx.history.redo(); // redo 'de'
    expect(ctx.doc.content).toBe("abcde");
    ctx.history.redo(); // redo 'fg'
    expect(ctx.doc.content).toBe("abcdefg");
  });

  // ── undo clears redo stack on new edit ──
  it("new edit after undo clears the redo stack", () => {
    ctx.doc.setContent("hello");
    ctx.updateSel(5);
    ctx.history.clear();

    ctx.type(" world", 5);
    ctx.history.undo();
    expect(ctx.doc.content).toBe("hello");

    ctx.type(" there", 5); // new edit → redo stack cleared
    expect(ctx.doc.content).toBe("hello there");

    const sel = ctx.history.redo();
    expect(sel).toBeNull(); // nothing to redo
    expect(ctx.doc.content).toBe("hello there");
  });

  // ── merge logic: sequential same-type single-char inserts merge ──
  it("merges consecutive single-character insertions", () => {
    ctx.doc.setContent("");
    ctx.updateSel(0);
    ctx.history.clear();

    ctx.type("a", 0);
    ctx.type("b", 1);
    ctx.type("c", 2);

    // All three should be a single history entry (merged)
    const sel = ctx.history.undo();
    expect(ctx.doc.content).toBe("");
    expect(sel).toEqual({ anchor: 0, head: 0 });
  });

  // ── merge logic: sequential backspaces merge ──
  it("merges consecutive single-character backspaces", () => {
    ctx.doc.setContent("abc");
    ctx.updateSel(3);
    ctx.history.clear();

    ctx.backspace(3); // remove c
    ctx.backspace(2); // remove b
    ctx.backspace(1); // remove a

    const sel = ctx.history.undo();
    expect(ctx.doc.content).toBe("abc");
    expect(sel).toEqual({ anchor: 3, head: 3 });
  });

  // ── merge logic: newline breaks merge ──
  it("does not merge insertions containing newlines", () => {
    ctx.doc.setContent("line1line2");
    ctx.updateSel(5);
    ctx.history.clear();

    // Insert a newline (won't merge with future changes since canMerge
    // checks the NEW change for newlines, not the last. So we use a
    // multi-char insert that won't merge with the newline entry by
    // the single-char merge rule.)
    ctx.type("X\nY", 5); // contains newline → doesn't merge with anything
    ctx.type("ZZ", 9);   // multi-char → doesn't merge with newline entry

    ctx.history.undo(); // remove ZZ
    expect(ctx.doc.content).toBe("line1X\nYline2");
    ctx.history.undo(); // remove X\nY
    expect(ctx.doc.content).toBe("line1line2");
  });

  // ── merge logic: insert-then-delete doesn't merge ──
  it("does not merge insertion followed by deletion", () => {
    ctx.doc.setContent("ab");
    ctx.updateSel(2);
    ctx.history.clear();

    ctx.type("c", 2); // abc
    ctx.backspace(3); // ab

    ctx.history.undo();
    expect(ctx.doc.content).toBe("abc"); // undo delete
    ctx.history.undo();
    expect(ctx.doc.content).toBe("ab"); // undo insert
  });

  // ── max history ──
  it("evicts oldest entries when history exceeds MAX_HISTORY", () => {
    ctx.doc.setContent("x");
    ctx.updateSel(1);
    ctx.history.clear();

    // Generate 210 separate (non-mergeable) entries by typing multi-char strings
    for (let i = 0; i < 210; i++) {
      ctx.type("ab", i * 2 + 1); // "ab" is 2 chars → won't merge with single-char rules
    }

    // Undo all the way — should only be able to undo 200 entries max
    let undoCount = 0;
    while (ctx.history.undo()) {
      undoCount++;
    }
    // We made 210 pushes but max is 200, so the first 10 are evicted
    // We can undo at most 200
    expect(undoCount).toBeLessThanOrEqual(200);
    // Should not be able to undo back to the original "x"
    // The document content length should indicate partial undo
    expect(ctx.doc.length).toBeGreaterThan(1); // some entries remain
  });

  // ── clear ──
  it("clear empties both undo and redo stacks", () => {
    ctx.doc.setContent("hello");
    ctx.updateSel(5);
    ctx.history.clear();

    ctx.type(" world", 5);
    ctx.history.clear();

    expect(ctx.history.undo()).toBeNull();
    expect(ctx.history.redo()).toBeNull();
  });

  // ── undo returns null when stack is empty ──
  it("undo returns null when nothing to undo", () => {
    expect(ctx.history.undo()).toBeNull();
  });

  it("redo returns null when nothing to redo", () => {
    expect(ctx.history.redo()).toBeNull();
  });

  // ── selection tracking ──
  it("undo restores selection-before", () => {
    ctx.doc.setContent("hello");
    ctx.updateSel(5);
    ctx.history.clear();

    ctx.type(" world", 5); // selection after: 11
    ctx.updateSel(8, 11);  // user manually selected "rld"

    const sel = ctx.history.undo();
    // selection-before was {anchor:5, head:5} stored when push was called
    expect(sel).toEqual({ anchor: 5, head: 5 });
  });

  // ── replaceRange (both insert and remove) doesn't merge ──
  it("does not merge replace operations (both insert and remove)", () => {
    ctx.doc.setContent("hello");
    ctx.updateSel(5);
    ctx.history.clear();

    ctx.replace(0, 5, "hi"); // hello → hi
    ctx.replace(0, 2, "bye"); // hi → bye

    ctx.history.undo();
    expect(ctx.doc.content).toBe("hi");
    ctx.history.undo();
    expect(ctx.doc.content).toBe("hello");
  });
});
