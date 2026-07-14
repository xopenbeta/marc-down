import { markdownToMdast } from "satteri";
import type { Root } from "mdast";
import { toString } from "mdast-util-to-string";
import type { HeadingItem } from "@/types";

export function extractHeadings(markdown: string): HeadingItem[] {
  const tree = markdownToMdast(markdown, { features: { gfm: true } }) as Root;
  const headings: HeadingItem[] = [];

  for (const node of tree.children) {
    if (node.type === "heading") {
      headings.push({
        text: toString(node),
        level: node.depth,
        paragraph: node.position?.start.line ?? 0,
      });
    }
  }

  return headings;
}
