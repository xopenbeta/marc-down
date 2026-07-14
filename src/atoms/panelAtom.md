# panelAtom.ts

## 作用

管理侧边栏和大纲面板的折叠/展开状态。

## 为什么这么实现

- 两个独立布尔 atom（`isSidebarCollapsedAtom`、`isOutlineCollapsedAtom`），面板可独立折叠
- 默认都为 false（展开），用户点击折叠按钮设为 true
- 由 Layout 读取决定是否渲染面板，由 Editor 读取决定是否显示展开按钮
