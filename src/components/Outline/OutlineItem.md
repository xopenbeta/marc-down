# OutlineItem.tsx

## 作用

单个大纲标题项，左对齐树状缩进显示，点击整行跳转编辑器对应行并折叠/展开子标题。

## 为什么这么实现

- 左对齐 + 树状缩进（`(level - 1) * 12 + 8` px），ChevronRight/Down 图标在左侧表示折叠状态
- 点击整行同时触发跳转和折叠，简化交互（单一操作完成两件事）
- 跳转通过 `CustomEvent("outline-jump")` 通知编辑器，解耦组件间通信
- 文本超长时使用右侧 `mask-image` 渐隐（而非 ellipsis），视觉更柔和
