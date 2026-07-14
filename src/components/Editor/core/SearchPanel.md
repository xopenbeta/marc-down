# SearchPanel.tsx

## 作用

搜索/替换面板，React 组件，通过 Cmd+F 触发。

## 功能

- 搜索框 + 替换框
- 上一个/下一个导航（Enter / Shift+Enter）
- 替换 / 替换全部
- 区分大小写选项
- 正则表达式选项
- Escape 关闭

## 与 EditorCore 的交互

SearchPanel 不直接操作文档，而是通过回调函数与 EditorCore 通信：
- `onSearch(query, options)` → 返回 `SearchMatch[]`
- `onReplace(from, to, replacement)` → 替换单个匹配
- `onReplaceAll(query, replacement, options)` → 替换全部
- `onNavigate(match)` → 跳转到匹配位置
