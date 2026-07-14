import hljs from "highlight.js/lib/core";
import javascript from "highlight.js/lib/languages/javascript";
import typescript from "highlight.js/lib/languages/typescript";
import python from "highlight.js/lib/languages/python";
import rust from "highlight.js/lib/languages/rust";
import go from "highlight.js/lib/languages/go";
import css from "highlight.js/lib/languages/css";
import xml from "highlight.js/lib/languages/xml";
import json from "highlight.js/lib/languages/json";
import yaml from "highlight.js/lib/languages/yaml";
import bash from "highlight.js/lib/languages/bash";
import sql from "highlight.js/lib/languages/sql";
import c from "highlight.js/lib/languages/c";
import cpp from "highlight.js/lib/languages/cpp";
import java from "highlight.js/lib/languages/java";
import ruby from "highlight.js/lib/languages/ruby";
import swift from "highlight.js/lib/languages/swift";
import kotlin from "highlight.js/lib/languages/kotlin";
import markdown from "highlight.js/lib/languages/markdown";
import diff from "highlight.js/lib/languages/diff";
import lua from "highlight.js/lib/languages/lua";
import php from "highlight.js/lib/languages/php";
import csharp from "highlight.js/lib/languages/csharp";
import scss from "highlight.js/lib/languages/scss";

hljs.registerLanguage("javascript", javascript);
hljs.registerLanguage("js", javascript);
hljs.registerLanguage("typescript", typescript);
hljs.registerLanguage("ts", typescript);
hljs.registerLanguage("python", python);
hljs.registerLanguage("py", python);
hljs.registerLanguage("rust", rust);
hljs.registerLanguage("rs", rust);
hljs.registerLanguage("go", go);
hljs.registerLanguage("css", css);
hljs.registerLanguage("html", xml);
hljs.registerLanguage("xml", xml);
hljs.registerLanguage("json", json);
hljs.registerLanguage("yaml", yaml);
hljs.registerLanguage("yml", yaml);
hljs.registerLanguage("bash", bash);
hljs.registerLanguage("sh", bash);
hljs.registerLanguage("shell", bash);
hljs.registerLanguage("zsh", bash);
hljs.registerLanguage("sql", sql);
hljs.registerLanguage("c", c);
hljs.registerLanguage("cpp", cpp);
hljs.registerLanguage("c++", cpp);
hljs.registerLanguage("java", java);
hljs.registerLanguage("ruby", ruby);
hljs.registerLanguage("rb", ruby);
hljs.registerLanguage("swift", swift);
hljs.registerLanguage("kotlin", kotlin);
hljs.registerLanguage("kt", kotlin);
hljs.registerLanguage("markdown", markdown);
hljs.registerLanguage("md", markdown);
hljs.registerLanguage("diff", diff);
hljs.registerLanguage("lua", lua);
hljs.registerLanguage("php", php);
hljs.registerLanguage("csharp", csharp);
hljs.registerLanguage("cs", csharp);
hljs.registerLanguage("c#", csharp);
hljs.registerLanguage("scss", scss);

const mermaidLang: import("highlight.js").LanguageFn = () => ({
  name: "Mermaid",
  case_insensitive: false,
  keywords: {
    keyword:
      "graph flowchart sequenceDiagram classDiagram stateDiagram erDiagram gantt pie gitGraph journey mindmap timeline sankey xychart block " +
      "subgraph end " +
      "participant actor note over of left right " +
      "activate deactivate loop alt else opt par and critical break rect " +
      "section title dateFormat axisFormat excludes includes todayMarker " +
      "class style classDef linkStyle click callback " +
      "direction state as",
    literal: "TB TD BT RL LR",
  },
  contains: [
    { scope: "comment", begin: "%%", end: "$" },
    { scope: "string", begin: '"', end: '"' },
    { scope: "string", begin: "'", end: "'" },
    { scope: "string", begin: /\[/, end: /\]/ },
    { scope: "string", begin: /\(\[/, end: /\]\)/ },
    { scope: "operator", begin: /={3,}|={2}>|--+>|--+|\.{2}->?|-\.+->?|~~~|<-->/ },
    { scope: "punctuation", begin: /[{}();|]/ },
    { scope: "number", begin: /\b\d[\d.]*\b/ },
  ],
});
hljs.registerLanguage("mermaid", mermaidLang);

const CLASS_MAP: Record<string, string> = {
  "keyword": "tok-keyword",
  "selector-tag": "tok-keyword",
  "name": "tok-keyword",
  "section": "tok-keyword",
  "string": "tok-string",
  "regexp": "tok-string",
  "number": "tok-number",
  "comment": "tok-comment",
  "doctag": "tok-comment",
  "title.function_": "tok-function",
  "title": "tok-function",
  "title.class_": "tok-typeName",
  "variable": "tok-variableName",
  "built_in": "tok-variableName",
  "params": "tok-variableName",
  "template-variable": "tok-variableName",
  "type": "tok-typeName",
  "selector-class": "tok-typeName",
  "operator": "tok-operator",
  "property": "tok-propertyName",
  "attr": "tok-propertyName",
  "attribute": "tok-propertyName",
  "selector-id": "tok-propertyName",
  "punctuation": "tok-punctuation",
  "meta": "tok-meta",
  "literal": "tok-atom",
  "symbol": "tok-atom",
  "addition": "tok-string",
  "deletion": "tok-comment",
};

function mapClass(hljsClasses: string): string {
  const classes = hljsClasses.replace(/^hljs-/, "").split(" ").map(c => c.replace(/^hljs-/, ""));
  const full = classes.join(".");
  if (CLASS_MAP[full]) return CLASS_MAP[full];
  if (CLASS_MAP[classes[0]]) return CLASS_MAP[classes[0]];
  return "";
}

export interface HighlightStyleChunk {
  text: string;
  cls: string;
}

export function highlightLines(code: string, lang: string): HighlightStyleChunk[][] {
  let html: string;
  try {
    if (lang && hljs.getLanguage(lang)) {
      html = hljs.highlight(code, { language: lang, ignoreIllegals: true }).value;
    } else if (lang) {
      html = hljs.highlightAuto(code).value;
    } else {
      html = escapeHtml(code);
    }
  } catch {
    html = escapeHtml(code);
  }

  const lineHtmls = splitHtmlByLines(html);
  return lineHtmls.map(parseLineHtml);
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function splitHtmlByLines(html: string): string[] {
  const lines: string[] = [];
  let current = "";
  const openTags: string[] = [];
  let i = 0;

  while (i < html.length) {
    if (html[i] === "<") {
      const closeMatch = html.substring(i).match(/^<\/span>/);
      if (closeMatch) {
        current += closeMatch[0];
        openTags.pop();
        i += closeMatch[0].length;
        continue;
      }
      const openMatch = html.substring(i).match(/^<span[^>]*>/);
      if (openMatch) {
        current += openMatch[0];
        openTags.push(openMatch[0]);
        i += openMatch[0].length;
        continue;
      }
    }

    if (html[i] === "\n") {
      for (let j = openTags.length - 1; j >= 0; j--) current += "</span>";
      lines.push(current);
      current = openTags.join("");
      i++;
      continue;
    }

    current += html[i];
    i++;
  }
  lines.push(current);
  return lines;
}

function parseLineHtml(html: string): HighlightStyleChunk[] {
  const styleChunks: HighlightStyleChunk[] = [];

  function walk(src: string, parentCls: string) {
    let pos = 0;
    while (pos < src.length) {
      if (src[pos] === "<") {
        const openMatch = src.substring(pos).match(/^<span class="([^"]*)">/);
        if (openMatch) {
          const cls = openMatch[1];
          pos += openMatch[0].length;
          const inner = extractInner(src, pos);
          const mapped = mapClass(cls) || parentCls;
          walk(inner.content, mapped);
          pos = inner.end;
          continue;
        }
        const closeMatch = src.substring(pos).match(/^<\/span>/);
        if (closeMatch) {
          pos += closeMatch[0].length;
          continue;
        }
      }

      let textEnd = src.indexOf("<", pos);
      if (textEnd === -1) textEnd = src.length;
      const text = unescapeHtml(src.substring(pos, textEnd));
      if (text) {
        styleChunks.push({ text, cls: parentCls });
      }
      pos = textEnd;
    }
  }

  walk(html, "");
  return mergeAdjacentStyleChunks(styleChunks);
}

function extractInner(src: string, startPos: number): { content: string; end: number } {
  let depth = 1;
  let pos = startPos;
  while (pos < src.length && depth > 0) {
    if (src[pos] === "<") {
      if (src.substring(pos).startsWith("</span>")) {
        depth--;
        if (depth === 0) {
          return { content: src.substring(startPos, pos), end: pos + 7 };
        }
        pos += 7;
        continue;
      }
      const open = src.substring(pos).match(/^<span[^>]*>/);
      if (open) {
        depth++;
        pos += open[0].length;
        continue;
      }
    }
    pos++;
  }
  return { content: src.substring(startPos, pos), end: pos };
}

function unescapeHtml(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'");
}

function mergeAdjacentStyleChunks(styleChunks: HighlightStyleChunk[]): HighlightStyleChunk[] {
  if (styleChunks.length === 0) return styleChunks;
  const merged: HighlightStyleChunk[] = [styleChunks[0]];
  for (let i = 1; i < styleChunks.length; i++) {
    const last = merged[merged.length - 1];
    if (last.cls === styleChunks[i].cls) {
      last.text += styleChunks[i].text;
    } else {
      merged.push({ ...styleChunks[i] });
    }
  }
  return merged;
}
