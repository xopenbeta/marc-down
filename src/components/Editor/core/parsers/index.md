# parsers/

块级 Markdown 解析器，完全独立于编辑器实现（使用 `DocLike` 接口）。

## 文件结构

```
parsers/
  index.ts            - 统一导出
  types.ts            - 所有 Block 接口 + DocumentBlock 联合类型
  documentBlocks.ts   - parseDocumentToBlocks 主解析函数（单次遍历 O(行数)）
  math.ts             - findMathBlocks
  html.ts             - findHtmlBlocks
  image.ts            - findImageBlocks + resolveImageUrl
  table.ts            - findTableBoundaries + parseTableRow + parseAlignments
  mermaid.ts          - findMermaidBlocks + ensureMermaidInit
  codeBlock.ts        - findCodeBlocks
```

## 主入口

`parseDocumentToBlocks(doc, fromLine?, toLine?)` 是主解析函数，一次遍历识别所有块类型（code、math、html、table、image、heading、hr、blockquote、paragraph、gap）。

## 消费方

- `MdRenderer.ts` -- 每次渲染时调用 `parseDocumentToBlocks()` 获取块列表
