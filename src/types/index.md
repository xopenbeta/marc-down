# types/index.ts

## 作用

定义应用全局共享的 TypeScript 类型接口（文件节点、打开文件、标题项、搜索结果）。

## 为什么这么实现

- 集中定义核心数据结构，避免类型散落在各模块中导致循环依赖
- `FileNode` 的字段命名（`is_directory`、`children`）与 Rust 后端 serde 序列化对齐，省去前端转换层
- `OpenFile` 中包含 `isDirty` 标记，使 UI 能直接从状态中判断文件是否需要保存
