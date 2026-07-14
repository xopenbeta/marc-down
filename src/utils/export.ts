import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import { invoke } from "@tauri-apps/api/core";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { markdownToHtml as satteriToHtml } from "satteri";

function markdownToHtml(content: string, title: string): string {
  const { html: body } = satteriToHtml(content, { features: { gfm: true, math: true } });
  return `<!doctype html>
<html>
<head><meta charset="utf-8"><title>${title}</title></head>
<body>${body}</body>
</html>`;
}

function markdownToHtmlBody(content: string): string {
  const { html } = satteriToHtml(content, { features: { gfm: true, math: true } });
  return html;
}

export async function exportAs(
  format: "txt" | "md" | "html" | "pdf" | "epub",
  content: string,
  fileName: string
): Promise<void> {
  const baseName = fileName.replace(/\.[^.]+$/, "");

  switch (format) {
    case "txt": {
      const path = await save({
        defaultPath: `${baseName}.txt`,
        filters: [{ name: "Text", extensions: ["txt"] }],
      });
      if (path) await writeTextFile(path, content);
      break;
    }
    case "md": {
      const path = await save({
        defaultPath: `${baseName}.md`,
        filters: [{ name: "Markdown", extensions: ["md"] }],
      });
      if (path) await writeTextFile(path, content);
      break;
    }
    case "html": {
      const html = markdownToHtml(content, baseName);
      const path = await save({
        defaultPath: `${baseName}.html`,
        filters: [{ name: "HTML", extensions: ["html"] }],
      });
      if (path) await writeTextFile(path, html);
      break;
    }
    case "pdf": {
      const html = markdownToHtml(content, baseName);
      const styledHtml = html.replace(
        "</head>",
        `<style>
body { font-family: system-ui, sans-serif; max-width: 800px; margin: 0 auto; padding: 40px; line-height: 1.6; color: #1a1a1a; }
h1, h2, h3, h4, h5, h6 { margin-top: 1.5em; margin-bottom: 0.5em; }
code { background: #f5f5f5; padding: 2px 4px; border-radius: 3px; font-size: 0.9em; }
pre { background: #f5f5f5; padding: 16px; border-radius: 6px; overflow-x: auto; }
pre code { background: none; padding: 0; }
blockquote { border-left: 3px solid #ddd; margin-left: 0; padding-left: 16px; color: #666; }
table { border-collapse: collapse; width: 100%; }
th, td { border: 1px solid #ddd; padding: 8px 12px; }
th { background: #f5f5f5; font-weight: 600; }
img { max-width: 100%; }
</style>
<script>window.onload = () => { setTimeout(() => window.print(), 300); }</script>
</head>`
      );
      const encoded = encodeURIComponent(styledHtml);
      new WebviewWindow("print-preview", {
        url: `data:text/html,${encoded}`,
        title: `Print - ${baseName}`,
        width: 800,
        height: 600,
      });
      break;
    }
    case "epub": {
      const htmlBody = markdownToHtmlBody(content);
      const path = await save({
        defaultPath: `${baseName}.epub`,
        filters: [{ name: "EPUB", extensions: ["epub"] }],
      });
      if (path) {
        await invoke("export_epub", {
          title: baseName,
          htmlContent: htmlBody,
          outputPath: path,
        });
      }
      break;
    }
  }
}
