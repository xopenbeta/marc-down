import { describe, expect, it } from "vitest";
import { Document } from "./types";

function makeDoc(text: string) {
  const doc = new Document();
  doc.setContent(text);
  return doc;
}

describe("Document", () => {
  // ── content / length ──
  it("returns empty content for a fresh document", () => {
    const doc = new Document();
    expect(doc.content).toBe("");
    expect(doc.length).toBe(0);
  });

  it("setContent updates content and rebuilds paragraphs", () => {
    const doc = makeDoc("hello\nworld");
    expect(doc.content).toBe("hello\nworld");
    expect(doc.length).toBe(11);
    expect(doc.paraphsLength).toBe(2);
  });

  it("toString returns the same as content", () => {
    const doc = makeDoc("abc");
    expect(doc.toString()).toBe("abc");
  });

  // ── sliceContent ──
  it("sliceContent returns substring by document positions", () => {
    const doc = makeDoc("0123456789");
    expect(doc.sliceContent(2, 5)).toBe("234");
  });

  it("sliceContent returns empty string for empty or reversed range", () => {
    const doc = makeDoc("abc");
    expect(doc.sliceContent(1, 1)).toBe("");
    expect(doc.sliceContent(3, 1)).toBe("");
  });

  it("sliceContent clamps end to document length", () => {
    const doc = makeDoc("abc");
    expect(doc.sliceContent(1, 99)).toBe("bc");
  });

  // ── replaceRange ──
  it("replaceRange replaces text and returns a Change", () => {
    const doc = makeDoc("hello world");
    const change = doc.replaceRange(6, 11, "there");
    expect(doc.content).toBe("hello there");
    expect(change).toEqual({
      documentPosFrom: 6,
      documentPosTo: 11,
      inserted: "there",
      removed: "world",
    });
  });

  it("replaceRange handles insertion at end", () => {
    const doc = makeDoc("abc");
    doc.replaceRange(3, 3, "def");
    expect(doc.content).toBe("abcdef");
  });

  it("replaceRange handles deletion at start", () => {
    const doc = makeDoc("abcdef");
    doc.replaceRange(0, 3, "");
    expect(doc.content).toBe("def");
  });

  // ── insertText / deleteRange ──
  it("insertText inserts at position", () => {
    const doc = makeDoc("ab");
    doc.insertText(1, "X");
    expect(doc.content).toBe("aXb");
  });

  it("deleteRange deletes a range", () => {
    const doc = makeDoc("aXXXb");
    doc.deleteRange(1, 4);
    expect(doc.content).toBe("ab");
  });

  // ── paragraph indexing ──
  it("paraphsLength counts newline-separated lines", () => {
    const doc = makeDoc("a\nb\nc");
    expect(doc.paraphsLength).toBe(3);
  });

  it("single-line document has one paragraph", () => {
    const doc = makeDoc("only one line");
    expect(doc.paraphsLength).toBe(1);
  });

  it("empty document has one empty paragraph", () => {
    const doc = makeDoc("");
    expect(doc.paraphsLength).toBe(1);
    expect(doc.getParagraph(0).text).toBe("");
  });

  it("getParagraph returns correct paragraph by index", () => {
    const doc = makeDoc("first\nsecond\nthird");
    expect(doc.getParagraph(0).text).toBe("first");
    expect(doc.getParagraph(1).text).toBe("second");
    expect(doc.getParagraph(2).text).toBe("third");
  });

  it("getParagraph throws RangeError for out-of-bounds index", () => {
    const doc = makeDoc("line");
    expect(() => doc.getParagraph(-1)).toThrow(RangeError);
    expect(() => doc.getParagraph(99)).toThrow(RangeError);
  });

  it("getParagraphAtPos uses binary search to find paragraph containing a position", () => {
    const doc = makeDoc("aaa\nbbb\nccc");
    // pos 0-2 → paragraph 0, pos 4-6 → paragraph 1, pos 8-10 → paragraph 2
    expect(doc.getParagraphAtPos(0).text).toBe("aaa");
    expect(doc.getParagraphAtPos(2).text).toBe("aaa");
    expect(doc.getParagraphAtPos(4).text).toBe("bbb");
    expect(doc.getParagraphAtPos(7).text).toBe("bbb");
    expect(doc.getParagraphAtPos(8).text).toBe("ccc");
    expect(doc.getParagraphAtPos(11).text).toBe("ccc"); // last position, at the end
  });

  it("getParagraphAtPos works at paragraph boundaries", () => {
    const doc = makeDoc("a\nb");
    // pos 1 is the "\n" (belongs to line 0's documentPosTo, which is 1)
    // getParagraphAtPos: when pos <= paragraph[pos].documentPosTo, returns that paragraph
    // Actually line 0 has documentPosFrom=0, documentPosTo=1 ("a")
    // The \n is at position 1. Let's see what getParagraphAtPos returns.
    expect(doc.getParagraphAtPos(1).text).toBe("a");
    // pos 2 is the start of "b"
    expect(doc.getParagraphAtPos(2).text).toBe("b");
  });

  // ── paragraph fields ──
  it("paragraph has correct documentPosFrom and documentPosTo", () => {
    const doc = makeDoc("hello\nworld");
    const p0 = doc.getParagraph(0);
    expect(p0.documentPosFrom).toBe(0);
    expect(p0.documentPosTo).toBe(5); // "hello"

    const p1 = doc.getParagraph(1);
    expect(p1.documentPosFrom).toBe(6); // after \n
    expect(p1.documentPosTo).toBe(11); // "world"
  });

  it("paragraph has documentOffsetIndex matching its index", () => {
    const doc = makeDoc("a\nb\nc");
    for (let i = 0; i < doc.paraphsLength; i++) {
      expect(doc.getParagraph(i).documentOffsetIndex).toBe(i);
    }
  });

  // ── dirty tracking ──
  it("tracks dirtyFromIndex after mutations", () => {
    const doc = makeDoc("aaa\nbbb\nccc\nddd");
    expect(doc.dirtyFromIndex).toBe(0); // after full setContent

    // Modify a later line and check dirtyFromIndex
    const p2 = doc.getParagraph(2);
    doc.replaceRange(p2.documentPosFrom, p2.documentPosTo, "XXX");
    // dirtyFromIndex should be <= 2 (the affected paragraph index)
    expect(doc.dirtyFromIndex).toBeLessThanOrEqual(2);
  });

  // ── paragraphs getter ──
  it("paragraphs getter returns all paragraphs", () => {
    const doc = makeDoc("a\nb");
    const all = doc.paragraphs;
    expect(all).toHaveLength(2);
    expect(all[0].text).toBe("a");
    expect(all[1].text).toBe("b");
  });

  // ── multi-line mutations keep paragraphs in sync ──
  it("inserting a newline creates new paragraphs", () => {
    const doc = makeDoc("ab");
    doc.insertText(1, "\n");
    expect(doc.paraphsLength).toBe(2);
    expect(doc.getParagraph(0).text).toBe("a");
    expect(doc.getParagraph(1).text).toBe("b");
  });

  it("deleting a newline merges paragraphs", () => {
    const doc = makeDoc("a\nb");
    expect(doc.paraphsLength).toBe(2);
    doc.deleteRange(1, 2); // delete the \n between "a" and "b"
    expect(doc.paraphsLength).toBe(1);
    expect(doc.getParagraph(0).text).toBe("ab");
  });

  it("setContent with multiline text produces correct paragraph positions", () => {
    const doc = makeDoc("foo\nbar\nbaz");
    expect(doc.paraphsLength).toBe(3);
    expect(doc.content).toBe("foo\nbar\nbaz");
    // verify positions are contiguous
    for (let i = 1; i < doc.paraphsLength; i++) {
      const prev = doc.getParagraph(i - 1);
      const curr = doc.getParagraph(i);
      // curr.documentPosFrom = prev.documentPosTo + 1 (the \n)
      expect(curr.documentPosFrom).toBe(prev.documentPosTo + 1);
    }
  });
});
