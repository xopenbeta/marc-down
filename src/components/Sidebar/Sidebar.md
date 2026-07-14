# Sidebar.tsx

## 作用

左侧面板容器，顶部为工具按钮行（折叠/打开文件夹/搜索），下方为文件列表或搜索面板。

## 为什么这么实现

- 无标题文字，只有图标按钮行，左对齐，最左侧是折叠侧边栏按钮
- 根据 `isSearchPanelOpenAtom` 切换显示文件树或搜索面板，复用同一空间
- 折叠按钮通过设置 `isSidebarCollapsedAtom` 隐藏整个面板，由 Layout 控制渲染

