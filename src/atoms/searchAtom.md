# searchAtom.ts

## 作用

管理全局搜索相关状态：搜索关键词、搜索结果、加载状态、面板开关。

## 为什么这么实现

- 搜索状态拆为四个独立 atom，因为它们的变更频率不同（query 随输入变、results 随搜索完成变、isSearching 是短暂中间态）
- `isSearchPanelOpenAtom` 控制侧边栏显示搜索面板还是文件树，用 atom 而非组件 state 是因为快捷键 hook 需要跨组件切换它
