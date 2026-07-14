# History.ts

## 作用

编辑器的 Undo/Redo 历史管理。

## 设计

- 最大 200 条历史记录
- 500ms 内的连续单字符输入/删除自动合并为一个 entry
- 每个 entry 存储：变更列表、操作前选区、操作后选区、时间戳

## 合并条件

两次编辑在以下条件下合并：
1. 间隔 < 500ms
2. 都是单字符插入或单字符删除
3. 位置连续（插入紧跟上一次末尾，删除紧邻上一次位置）
4. 不包含换行符
5. 不是同时有插入和删除（即不是替换操作）

## Undo/Redo 实现

- `undo()`: 从 undoStack 弹出 entry，逆序还原所有变更，push 到 redoStack
- `redo()`: 从 redoStack 弹出 entry，正序重放所有变更，push 回 undoStack
- 任何新的 push 操作会清空 redoStack
