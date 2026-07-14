import { markdownToMdast } from "satteri";
import { toString } from "mdast-util-to-string";
import type { HeadingItem } from "@/types";

type HeadingNode = {
  type: "heading";
  depth: number;
  position?: {
    start?: {
      line?: number;
    };
  };
};

type MarkdownRoot = {
  children: Array<HeadingNode | { type: string }>;
};

function isHeadingNode(node: HeadingNode | { type: string }): node is HeadingNode {
  return node.type === "heading" && typeof (node as Partial<HeadingNode>).depth === "number";
}

export function extractHeadings(markdown: string): HeadingItem[] {
  const tree = markdownToMdast(markdown, { features: { gfm: true } }) as MarkdownRoot;
  const headings: HeadingItem[] = [];

  for (const node of tree.children) {
    if (isHeadingNode(node)) {
      headings.push({
        text: toString(node),
        level: node.depth,
        paragraph: node.position?.start?.line ?? 0,
      });
    }
  }

  return headings;
}
