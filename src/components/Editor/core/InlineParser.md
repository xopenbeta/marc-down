# InlineParser.ts

## 作用

Markdown 行内语法解析器，输出两种数据：
1. `Token[]` — 用于 DOM 渲染（每个 token 含 CSS class）
2. `MeasureSegment[]` — 用于 TextMeasure 文本测量（标记 inline 元素的尺寸）

## 支持的 Token 类型

| Token 类型 | CSS Class | 匹配规则 |
|-----------|-----------|----------|
| inline-code | `tok-monospace` | `` `code` `` |
| inline-math | `tok-processingInstruction` | `$latex$` |
| strong | `tok-strong` | `**bold**` |
| emphasis | `tok-emphasis` | `*italic*` |
| strikethrough | `tok-strikethrough` | `~~text~~` |
| image | `tok-link` | `![alt](url)` |
| link | `tok-link` | `[text](url)` |
| link-url | `tok-url` | 链接中的 URL 部分 |

## 导出函数

| 函数 | 说明 |
|------|------|
| `parseInlineChunks(text, lineFrom, options)` | 解析一行文本，返回 `{ tokens, segments }` |
| `getLineCssClasses(text)` | 根据行内容返回行级 CSS class（heading、blockquote、hr 等） |
| `getHeadingFont(level)` | 返回指定标题级别对应的 Canvas font 字符串 |

## 行级 CSS Classes

- `cm-heading-1` ~ `cm-heading-6`
- `cm-blockquote-line`
- `cm-hr-line`
- `cm-codeblock-line`（通过 `isCode` 选项启用）
