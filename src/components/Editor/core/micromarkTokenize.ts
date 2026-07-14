/**
 * micromark 源码级 tokenizer 封装。
 *
 * 将段落文本通过 micromark 解析为源码级 token 流，
 * 供 InlineParser 消费，替代原有的 regex 匹配。
 */
import { parse, postprocess, preprocess } from "micromark";
import { gfmStrikethrough } from "micromark-extension-gfm-strikethrough";
import { math } from "micromark-extension-math";

// ─── 公开类型 ─────────────────────────────────────────────────────────────────

export interface InlineToken {
  type:
    | "characterEscape"
    | "codeText"
    | "emphasis"
    | "strong"
    | "strong-emphasis"
    | "strikethrough"
    | "link"
    | "image"
    | "mathText";
  /** source offset start (0-based, paragraph-relative) */
  from: number;
  /** source offset end (exclusive) */
  to: number;
  /** link/image sub-tokens */
  children?: InlineToken[];
  /** link/image sub-parts */
  labelText?: { from: number; to: number };
  resourceDestination?: { from: number; to: number };
}

// ─── 内部 ─────────────────────────────────────────────────────────────────────

/** micromark event type alias */
type MmEvent = [string, { type: string; start: { offset: number }; end: { offset: number } }, unknown];

const extensions = [gfmStrikethrough(), math()];

/**
 * 将段落文本 tokenize 为 InlineToken 列表。
 * 返回的 token 按 from 升序排列。
 */
export function tokenizeInline(text: string): InlineToken[] {
  const events = postprocess(
    parse({ extensions }).document().write(preprocess()(text, "utf-8", true)),
  ) as MmEvent[];

  const tokens: InlineToken[] = [];

  // 收集简单 token（无嵌套关系的）
  for (const [eventType, token] of events) {
    if (eventType !== "enter") continue;
    const tType = token.type;
    const from = token.start.offset;
    const to = token.end.offset;

    if (tType === "characterEscape") {
      tokens.push({ type: "characterEscape", from, to });
    } else if (tType === "codeText") {
      tokens.push({ type: "codeText", from, to });
    } else if (tType === "mathText") {
      tokens.push({ type: "mathText", from, to });
    } else if (tType === "strikethrough") {
      tokens.push({ type: "strikethrough", from, to });
    }
  }

  // 处理 emphasis/strong（含嵌套合并）
  const emStrongPairs = extractEmphasisStrong(events);
  for (const p of emStrongPairs) {
    tokens.push({ type: p.type as InlineToken["type"], from: p.from, to: p.to });
  }

  // 处理 link/image
  const linkPairs = extractLinksImages(events);
  for (const lp of linkPairs) {
    tokens.push({
      type: lp.type as "link" | "image",
      from: lp.from,
      to: lp.to,
      labelText: lp.labelText,
      resourceDestination: lp.resourceDestination,
    });
  }

  tokens.sort((a, b) => a.from - b.from);
  return tokens;
}

// ─── 辅助：提取 emphasis/strong 并处理嵌套合并 ──────────────────────────────────

function extractEmphasisStrong(events: MmEvent[]): { type: string; from: number; to: number }[] {
  const result: { type: string; from: number; to: number }[] = [];

  // 用栈追踪当前打开的 emphasis/strong
  type StackEntry = { type: "emphasis" | "strong"; from: number; to: number };
  const stack: StackEntry[] = [];

  for (const [eventType, token] of events) {
    const tType = token.type;
    const from = token.start.offset;
    const to = token.end.offset;

    if (eventType === "enter") {
      if (tType === "emphasis") {
        stack.push({ type: "emphasis", from, to });
      } else if (tType === "strong") {
        stack.push({ type: "strong", from, to });
      }
    } else if (eventType === "exit") {
      if (tType === "emphasis" || tType === "strong") {
        const entry = stack.pop();
        if (!entry) continue;

        // 检查是否与栈中相邻项形成嵌套
        // 如果 emphasis 直接包含 strong（或反过来），合并为 strong-emphasis
        const parent = stack.length > 0 ? stack[stack.length - 1] : null;
        if (parent) {
          const isNested =
            (parent.type === "emphasis" && entry.type === "strong") ||
            (parent.type === "strong" && entry.type === "emphasis");
          if (isNested) {
            // 标记 parent 为 strong-emphasis，跳过当前 entry
            parent.type = "emphasis"; // 保持 parent 在栈中
            // 当 parent exit 时会被输出为 strong-emphasis
            // 标记一下
            (parent as { type: string }).type = "strong-emphasis" as "emphasis";
            continue;
          }
        }

        result.push({ type: entry.type, from: entry.from, to: entry.to });
      }
    }
  }

  return result;
}

// ─── 辅助：提取 link/image 及其子部分 ────────────────────────────────────────────

interface LinkImagePair {
  type: "link" | "image";
  from: number;
  to: number;
  labelText?: { from: number; to: number };
  resourceDestination?: { from: number; to: number };
}

function extractLinksImages(events: MmEvent[]): LinkImagePair[] {
  const result: LinkImagePair[] = [];
  const stack: LinkImagePair[] = [];

  for (const [eventType, token] of events) {
    const tType = token.type;
    const from = token.start.offset;
    const to = token.end.offset;

    if (eventType === "enter") {
      if (tType === "link") {
        stack.push({ type: "link", from, to });
      } else if (tType === "image") {
        stack.push({ type: "image", from, to });
      } else if (tType === "labelText" && stack.length > 0) {
        stack[stack.length - 1].labelText = { from, to };
      } else if (tType === "resourceDestinationString" && stack.length > 0) {
        stack[stack.length - 1].resourceDestination = { from, to };
      }
    } else if (eventType === "exit") {
      if (tType === "link" || tType === "image") {
        const entry = stack.pop();
        if (entry) result.push(entry);
      }
    }
  }

  return result;
}
