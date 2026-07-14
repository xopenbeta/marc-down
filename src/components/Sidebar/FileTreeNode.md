# FileTreeNode.tsx

## 作用

单个文件/文件夹列表项，使用树状缩进 + lucide icon 展示层级结构。

## 为什么这么实现

- 使用 `level * 16px` 缩进表示树状层级关系
- 文件夹使用 ChevronRight/ChevronDown + Folder/FolderOpen 图标，点击整行展开/收起
- 文件使用 File 图标，额外 16px 左侧偏移与文件夹名对齐
- 文件名超长时 `text-overflow: ellipsis` 截断
- 右键菜单通过 state 控制弹出位置
