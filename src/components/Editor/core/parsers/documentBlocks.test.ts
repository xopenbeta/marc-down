import { describe, expect, it } from "vitest";
import { parseDocumentToBlocks } from "./documentBlocks";
import { Document } from "./types";

function parse(content: string) {
  const doc = new Document();
  doc.setContent(content);
  const blocks = parseDocumentToBlocks(doc);
  return { doc, blocks };
}

describe("parseDocumentToBlocks (satteri)", () => {
  it("parses gfm table into table block", () => {
    const { blocks } = parse(["|a|b|", "|-|-|", "|1|2|"].join("\n"));

    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe("table");
  });

  it("parses $$ fenced math into math block", () => {
    const { doc, blocks } = parse(["$$", "a+b", "$$"].join("\n"));

    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe("math");
    expect(blocks[0].latex).toBe("a+b");

    const startLine = doc.getParagraphAtPos(blocks[0].documentPosFrom).text;
    const endLine = doc.getParagraphAtPos(blocks[0].documentPosTo).text;
    expect(startLine).toBe("$$");
    expect(endLine).toBe("$$");
  });

  it("extracts block math between paragraphs", () => {
    const { blocks } = parse(["before", "$$", "a+b", "$$", "after"].join("\n"));

    expect(blocks.map(b => b.type)).toEqual(["paragraph", "math", "paragraph"]);
    expect(blocks[1].latex).toBe("a+b");
  });

  it("parses mermaid fenced code into mermaid block", () => {
    const { blocks } = parse(["```mermaid", "graph TD;A-->B", "```"].join("\n"));

    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe("mermaid");
    expect(blocks[0].code).toBe("graph TD;A-->B");
  });

  it("keeps blank lines as gap blocks", () => {
    const { blocks } = parse(["a", "", "", "b"].join("\n"));

    expect(blocks.map(b => b.type)).toEqual(["paragraph", "gap", "gap", "paragraph"]);
  });
});
