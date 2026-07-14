# fileTreeAtom.ts

## 作用

存储当前工作区的文件目录树结构。

## 为什么这么实现

- 整棵目录树作为单一 atom 存储，因为 Rust 后端一次性返回完整树结构（`read_directory_tree`），前端无需增量更新
- 类型为 `FileNode | null`，null 表示未加载，组件可直接用此值做条件渲染
