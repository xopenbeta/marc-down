# markdownParser.ts

## 作用

从 Markdown 文本中提取所有标题（heading）及其层级和行号，用于生成文档大纲。

## 为什么这么实现

- 使用 `unified` + `remark-parse` 解析为 AST，而非正则匹配，因为正则无法正确处理代码块内的 `#` 符号
- 只遍历顶层 `tree.children`（不做深度递归），因为 Markdown AST 中 heading 节点始终位于文档顶层
- 提取 `position.start.line` 用于点击大纲跳转到编辑器对应行
