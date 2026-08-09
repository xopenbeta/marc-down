import { describe, expect, it, beforeEach, vi, afterEach } from "vitest";
import { SelectionManager } from "./SelectionManager";

// SelectionManager uses window.setInterval for cursor blink in node env
vi.stubGlobal("window", {
  setInterval: (fn: () => void, _ms: number) => {
    return setInterval(fn, 1000000); // never actually fire in tests
  },
  clearInterval: (id: number) => clearInterval(id),
});

describe("SelectionManager", () => {
  let sel: SelectionManager;

  beforeEach(() => {
    sel = new SelectionManager();
  });

  afterEach(() => {
    sel.destroy();
  });

  // ── initial state ──
  it("initializes with anchor and head both at 0", () => {
    expect(sel.anchor).toBe(0);
    expect(sel.head).toBe(0);
    expect(sel.hasSelection).toBe(false);
  });

  it("documentPosFrom and documentPosTo return min/max of anchor and head", () => {
    expect(sel.documentPosFrom).toBe(0);
    expect(sel.documentPosTo).toBe(0);
  });

  // ── setSelection ──
  it("setSelection with one argument sets both anchor and head to same position", () => {
    sel.setSelection(5);
    expect(sel.anchor).toBe(5);
    expect(sel.head).toBe(5);
    expect(sel.hasSelection).toBe(false);
  });

  it("setSelection with two arguments creates a selection range", () => {
    sel.setSelection(3, 8);
    expect(sel.anchor).toBe(3);
    expect(sel.head).toBe(8);
    expect(sel.hasSelection).toBe(true);
  });

  it("setSelection works with reversed anchor/head order", () => {
    sel.setSelection(10, 2);
    expect(sel.anchor).toBe(10);
    expect(sel.head).toBe(2);
  });

  it("documentPosFrom returns the lower bound regardless of order", () => {
    sel.setSelection(10, 2);
    expect(sel.documentPosFrom).toBe(2);
    expect(sel.documentPosTo).toBe(10);
    expect(sel.hasSelection).toBe(true);
  });

  // ── getSelection ──
  it("getSelection returns the current anchor and head", () => {
    sel.setSelection(4, 9);
    expect(sel.getSelection()).toEqual({ anchor: 4, head: 9 });
  });

  it("getSelection returns same values for cursor (no selection)", () => {
    sel.setSelection(7);
    expect(sel.getSelection()).toEqual({ anchor: 7, head: 7 });
  });

  // ── hasSelection ──
  it("hasSelection is false when anchor equals head", () => {
    sel.setSelection(5);
    expect(sel.hasSelection).toBe(false);

    sel.setSelection(3, 3);
    expect(sel.hasSelection).toBe(false);
  });

  it("hasSelection is true when anchor differs from head", () => {
    sel.setSelection(1, 4);
    expect(sel.hasSelection).toBe(true);
  });

  // ── selection at zero ──
  it("handles selection at position 0 correctly", () => {
    sel.setSelection(0);
    expect(sel.documentPosFrom).toBe(0);
    expect(sel.documentPosTo).toBe(0);
    expect(sel.hasSelection).toBe(false);
  });

  it("handles selection spanning from 0", () => {
    sel.setSelection(0, 5);
    expect(sel.documentPosFrom).toBe(0);
    expect(sel.documentPosTo).toBe(5);
    expect(sel.hasSelection).toBe(true);
  });

  // ── consecutive setSelection calls ──
  it("consecutive setSelection calls replace previous selection", () => {
    sel.setSelection(1, 5);
    expect(sel.hasSelection).toBe(true);

    sel.setSelection(3);
    expect(sel.hasSelection).toBe(false);
    expect(sel.anchor).toBe(3);
    expect(sel.head).toBe(3);
  });

  // ── onSelectionChange callback ──
  it("fires onSelectionChange when selection is set", () => {
    const callback = vi.fn();
    sel.onSelectionChange = callback;

    sel.setSelection(1, 3);
    expect(callback).toHaveBeenCalledTimes(1);

    sel.setSelection(5);
    expect(callback).toHaveBeenCalledTimes(2);
  });

  it("does not fire onSelectionChange if callback is null", () => {
    sel.onSelectionChange = null;
    // Should not throw
    expect(() => sel.setSelection(1, 5)).not.toThrow();
  });
});
