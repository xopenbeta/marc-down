# editor.css

## 作用

编辑器视觉样式（语法高亮、光标、选区、Widget 渲染区、折叠指示器、搜索面板）。

## 样式分区

| 区域 | 说明 |
|------|------|
| 编辑器容器 | `.native-editor`, `.native-editor-scroller`, `.native-editor-content` |
| 隐藏 textarea | `.native-editor-textarea` |
| 光标 + 选区 | `.native-editor-cursor`, `.native-editor-selection-layer`, `.native-editor-selection-rect` |
| Markdown 语法高亮 | `.tok-*` 系列（strong、emphasis、link、url、monospace 等） |
| 标题 | `.cm-heading-1` ~ `.cm-heading-6`（字号递减 + 上下间距） |
| 代码块语法着色 | `.tok-keyword`, `.tok-string`, `.tok-number` 等 |
| 块级元素 | 代码块、引用、HR、表格的背景和边框 |
| Widget 渲染区 | `.cm-math-block-render`, `.cm-image-block-render`, `.cm-table-block-render` 等 |
| 折叠样式 | `.cm-foldable-first`, `.cm-fold-collapsed-first` 的 `::before`/`::after` 伪元素 |
| 搜索面板 | `.cm-panels`, `.cm-textfield`, `.cm-button`, `.cm-searchMatch` |

## 设计决策

- 沿用 `cm-*` class 前缀，保持与 global.css 中弹窗样式的兼容
- 使用 CSS 变量实现 light/dark 主题切换（变量定义在 global.css 的 `:root` 和 `[data-theme="dark"]`）
- 光标闪烁使用 `@keyframes cursor-blink`（530ms 周期）
- 代码块内的 `.tok-monospace` 去除行内代码样式（避免双层背景）
