import { convertFileSrc } from "@tauri-apps/api/core";
import type { Block } from "./types";
import { hashBlockId } from "../cache";

export function resolveImageUrl(url: string, baseDir: string): string {
  if (/^(https?:\/\/|data:)/.test(url)) return url;
  if (url.startsWith("/")) return convertFileSrc(url);
  const cleaned = url.replace(/^\.\//, "");
  const parts = (baseDir + "/" + cleaned).split("/");
  const resolved: string[] = [];
  for (const part of parts) {
    if (part === "..") resolved.pop();
    else if (part !== "." && part !== "") resolved.push(part);
  }
  return convertFileSrc("/" + resolved.join("/"));
}

export function findImageBlocks(doc: { getParagraph(n: number): { documentPosFrom: number; documentPosTo: number }; sliceContent(from: number, to: number): string; paraphsLength: number }, 
  fromLine = 0, 
  toLine = doc.paraphsLength - 1): Block[] {
  const blocks: Block[] = [];
  const imageRe = /^!\[([^\]]*)\]\(([^)]+)\)\s*$/;
  for (let i = fromLine; i <= toLine; i++) {
    const ln = doc.getParagraph(i);
    const lnText = doc.sliceContent(ln.documentPosFrom, ln.documentPosTo);
    const m = imageRe.exec(lnText);
    if (m) {
      blocks.push({
        type: "image",
        id: hashBlockId(lnText),
        url: m[2].trim(),
        alt: m[1],
        documentPosFrom: ln.documentPosFrom,
        documentPosTo: ln.documentPosTo,
      });
    }
  }
  return blocks;
}
