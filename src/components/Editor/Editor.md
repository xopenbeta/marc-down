# Editor.tsx

## 作用

中间编辑区容器，挂载原生编辑器实例（`useEditorCore`）、文件标签栏和搜索面板，管理面板展开按钮。

## 为什么这么实现

- 固定左右 padding（等于按钮宽度 28px），为展开按钮预留空间
- 侧边栏折叠时左上角出现展开按钮，大纲折叠时右上角出现展开按钮
- 监听 `outline-jump` CustomEvent 实现大纲/搜索结果点击跳转
- 无文件打开时显示单个 "Open" 按钮，支持同时选择文件或文件夹
- 窗口标题栏显示当前文件名（格式 `MarcDown - filename`），无文件时恢复默认
- 支持拖放 .md 文件到编辑区打开，无论当前是否已有文件打开；拖入时显示虚线边框反馈
- 右键菜单通过监听 `editor-contextmenu` 自定义事件实现，使用 Tauri Menu API

## 编辑器集成

- 使用 `useEditorCore` hook 创建编辑器实例
- 集成 `SearchPanel` React 组件（Cmd+F 触发）
- 通过 `options` memo 传递 fileKey、content、onChange、padding 配置
