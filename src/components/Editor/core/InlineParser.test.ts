import { describe, expect, it, beforeAll, vi } from "vitest";

// Mock localStorage for EditorFontManager constructor
beforeAll(() => {
  const store = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => { store.set(key, value); },
    removeItem: (key: string) => { store.delete(key); },
    clear: () => { store.clear(); },
  });
});

import {
  parseSegments,
  flattenSegmentsToChunks,
  parseInlineChunks,
  getParagraphCssClasses,
} from "./InlineParser";

describe("InlineParser", () => {
  // ═══════════════════════════════════════════════════════════════
  // getParagraphCssClasses
  // ═══════════════════════════════════════════════════════════════
  describe("getParagraphCssClasses", () => {
    it("returns heading classes for ATX headings", () => {
      expect(getParagraphCssClasses("# Heading 1")).toContain("cm-heading-1");
      expect(getParagraphCssClasses("## Heading 2")).toContain("cm-heading-2");
      expect(getParagraphCssClasses("###### Heading 6")).toContain("cm-heading-6");
    });

    it("does not return heading class for non-headings", () => {
      expect(getParagraphCssClasses("plain text")).not.toContain("cm-heading-line");
      expect(getParagraphCssClasses("####### seven")).not.toContain("cm-heading-line"); // not valid markdown
    });

    it("returns blockquote class for lines starting with >", () => {
      expect(getParagraphCssClasses("> quoted")).toContain("cm-blockquote-line");
      // ">quoted" also matches /^>\s?/ because \s? matches zero whitespace chars
      expect(getParagraphCssClasses(">quoted")).toContain("cm-blockquote-line");
      // plain text does not match
      expect(getParagraphCssClasses("not a quote")).not.toContain("cm-blockquote-line");
    });

    it("returns hr class for thematic breaks", () => {
      expect(getParagraphCssClasses("---")).toContain("cm-hr-line");
      expect(getParagraphCssClasses("___")).toContain("cm-hr-line");
      expect(getParagraphCssClasses("***")).toContain("cm-hr-line");
      expect(getParagraphCssClasses("----")).toContain("cm-hr-line"); // more than 3
    });

    it("returns list-item class for unordered lists", () => {
      expect(getParagraphCssClasses("- item")).toContain("cm-list-item");
      expect(getParagraphCssClasses("* item")).toContain("cm-list-item");
      expect(getParagraphCssClasses("+ item")).toContain("cm-list-item");
    });

    it("returns list-item class for ordered lists", () => {
      expect(getParagraphCssClasses("1. item")).toContain("cm-list-item");
      expect(getParagraphCssClasses("99. item")).toContain("cm-list-item");
    });

    it("returns empty array for plain paragraphs", () => {
      expect(getParagraphCssClasses("just some text")).toEqual([]);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // parseSegments
  // ═══════════════════════════════════════════════════════════════
  describe("parseSegments", () => {
    it("parses plain text into a single text-run segment", () => {
      const segments = parseSegments("hello world", 0);
      expect(segments).toHaveLength(1);
      expect(segments[0].type).toBe("text-run");
      expect(segments[0].text).toBe("hello world");
    });

    it("parses empty string into a single empty text-run segment", () => {
      const segments = parseSegments("", 0);
      expect(segments).toHaveLength(1);
      expect(segments[0].type).toBe("text-run");
      expect(segments[0].text).toBe("");
    });

    it("parses bold text into styled chunks", () => {
      const segments = parseSegments("this is **bold** text", 0);
      expect(segments.length).toBeGreaterThan(0);
      // Should have chunks with strong styling
      const allChunks = flattenSegmentsToChunks(segments);
      const strongChunks = allChunks.filter(c => c.cssClass.includes("tok-strong"));
      expect(strongChunks.length).toBeGreaterThan(0);
    });

    it("parses italic text into styled chunks", () => {
      const segments = parseSegments("this *is* italic", 0);
      const allChunks = flattenSegmentsToChunks(segments);
      const emChunks = allChunks.filter(c => c.cssClass.includes("tok-emphasis"));
      expect(emChunks.length).toBeGreaterThan(0);
    });

    it("parses inline code into an inline-code segment", () => {
      const segments = parseSegments("use `const x = 1` here", 0);
      const codeSegs = segments.filter(s => s.type === "inline-code");
      expect(codeSegs.length).toBe(1);
      expect(codeSegs[0].text).toBe("`const x = 1`");
    });

    it("parses inline math into an inline-math segment", () => {
      const segments = parseSegments("the formula $a^2+b^2=c^2$ is famous", 0);
      const mathSegs = segments.filter(s => s.type === "inline-math");
      expect(mathSegs.length).toBe(1);
      expect(mathSegs[0].latex).toBe("a^2+b^2=c^2");
    });

    it("parses strikethrough", () => {
      const segments = parseSegments("this is ~~deleted~~ text", 0);
      const allChunks = flattenSegmentsToChunks(segments);
      const strikeChunks = allChunks.filter(c => c.cssClass.includes("tok-strikethrough"));
      expect(strikeChunks.length).toBeGreaterThan(0);
    });

    it("parses link into link chunks", () => {
      const segments = parseSegments("click [here](https://example.com) for more", 0);
      const allChunks = flattenSegmentsToChunks(segments);
      const linkTitleChunks = allChunks.filter(c => c.cssClass.includes("tok-link-title"));
      expect(linkTitleChunks.length).toBe(1);
      const linkUrlChunks = allChunks.filter(c => c.cssClass.includes("tok-link-url"));
      expect(linkUrlChunks.length).toBe(1);
    });

    it("parses inline image", () => {
      const segments = parseSegments("an ![alt](https://img.png) here", 0);
      const imgSegs = segments.filter(s => s.type === "inline-image");
      expect(imgSegs.length).toBe(1);
    });

    it("does not treat standalone image as inline-image", () => {
      // A line that's just an image — micromark won't emit image token or will be filtered
      const segments = parseSegments("![alt](https://img.png)", 0);
      // The image is standalone (whole line = image), so inline parser skips it
      // It becomes a text-run since the block-level parser handles it
      const imgSegs = segments.filter(s => s.type === "inline-image");
      expect(imgSegs.length).toBe(0);
    });

    // ── code block mode ──
    it("code block mode: wraps entire paragraph in a single text-run segment", () => {
      const segments = parseSegments("function foo() {", 0, { isCode: true });
      expect(segments).toHaveLength(1);
      expect(segments[0].type).toBe("text-run");
      expect(segments[0].chunks).toHaveLength(1);
      expect(segments[0].chunks[0].text).toBe("function foo() {");
    });

    it("code block mode: uses the specified font for the chunk", () => {
      const customFont = "400 13px 'JetBrains Mono'";
      const segments = parseSegments("code", 0, {
        isCode: true,
        font: customFont,
      });
      expect(segments[0].chunks[0].font).toBe(customFont);
    });

    // ── list markers ──
    it("detects unordered list bullet markers", () => {
      const segments = parseSegments("- todo item", 0);
      const allChunks = flattenSegmentsToChunks(segments);
      const bulletChunks = allChunks.filter(c => c.cssClass === "cm-bullet-mark");
      expect(bulletChunks.length).toBe(1);
      expect(bulletChunks[0].text).toBe("-");
    });

    it("detects ordered list number markers", () => {
      const segments = parseSegments("42. answer", 0);
      const allChunks = flattenSegmentsToChunks(segments);
      const numChunks = allChunks.filter(c => c.cssClass === "cm-list-number");
      expect(numChunks.length).toBe(1);
      expect(numChunks[0].text).toBe("42.");
    });

    // ── task checkboxes ──
    it("detects unchecked task checkbox", () => {
      const segments = parseSegments("- [ ] todo", 0);
      const allChunks = flattenSegmentsToChunks(segments);
      const cbChunks = allChunks.filter(c =>
        c.cssClass.includes("cm-task-checkbox") && !c.cssClass.includes("cm-task-checked")
      );
      expect(cbChunks.length).toBe(1);
      expect(cbChunks[0].text).toBe("[ ]");
    });

    it("detects checked task checkbox", () => {
      const segments = parseSegments("- [x] done", 0);
      const allChunks = flattenSegmentsToChunks(segments);
      const cbChunks = allChunks.filter(c => c.cssClass.includes("cm-task-checked"));
      expect(cbChunks.length).toBe(1);
      expect(cbChunks[0].text).toBe("[x]");
    });

    it("detects checked task checkbox with uppercase X", () => {
      const segments = parseSegments("- [X] DONE", 0);
      const allChunks = flattenSegmentsToChunks(segments);
      const cbChunks = allChunks.filter(c => c.cssClass.includes("cm-task-checked"));
      expect(cbChunks.length).toBe(1);
    });

    // ── segment boundaries ──
    it("preserves correct ordering across multiple segment types", () => {
      const segments = parseSegments("text `code` and **bold** end", 0);
      // Should have: text-run, inline-code, text-run, text-run (bold is inside text-run)
      const types = segments.map(s => s.type);
      expect(types).toContain("text-run");
      expect(types).toContain("inline-code");
    });

    it("segment paraphOffsetFrom/To are paragraph-relative and contiguous", () => {
      const text = "a `b` c";
      const segments = parseSegments(text, 10); // paraFrom=10 doesn't affect offsets
      expect(segments.length).toBeGreaterThan(0);
      // Segments should cover the entire paragraph without gaps
      let cursor = 0;
      for (const seg of segments) {
        expect(seg.paraphOffsetFrom).toBe(cursor);
        expect(seg.paraphOffsetTo).toBeGreaterThanOrEqual(seg.paraphOffsetFrom);
        cursor = seg.paraphOffsetTo;
      }
      expect(cursor).toBe(text.length);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // flattenSegmentsToChunks
  // ═══════════════════════════════════════════════════════════════
  describe("flattenSegmentsToChunks", () => {
    it("flattens segments into a single chunk array", () => {
      const segments = parseSegments("hello", 0);
      const chunks = flattenSegmentsToChunks(segments);
      expect(chunks.length).toBeGreaterThan(0);
    });

    it("returns empty array for empty segments", () => {
      const chunks = flattenSegmentsToChunks([]);
      expect(chunks).toEqual([]);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // parseInlineChunks (compat)
  // ═══════════════════════════════════════════════════════════════
  describe("parseInlineChunks", () => {
    it("returns flat chunk array directly", () => {
      const chunks = parseInlineChunks("test", 0);
      expect(Array.isArray(chunks)).toBe(true);
      expect(chunks.length).toBeGreaterThan(0);
      // All chunks should have expected fields
      for (const c of chunks) {
        expect(c).toHaveProperty("segmentOffsetFrom");
        expect(c).toHaveProperty("segmentOffsetTo");
        expect(c).toHaveProperty("type");
        expect(c).toHaveProperty("text");
        expect(c).toHaveProperty("glyphs");
      }
    });

    it("passes isCode option through", () => {
      const chunks = parseInlineChunks("code", 0, { isCode: true });
      expect(chunks).toHaveLength(1);
      expect(chunks[0].text).toBe("code");
    });
  });
});
