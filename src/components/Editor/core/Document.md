# Document.ts

## 作用

基于行数组的文档数据模型，兼容现有 `DocLike` 接口，供解析器直接使用。

## 核心设计

- 内部存储：`string[]`（按行分割）+ `number[]`（行起始偏移量数组）
- 位置查找：`_lineIndexAt(pos)` 使用二分查找，O(log n)
- 编辑操作：`replaceRange(from, to, text)` 是所有修改的唯一入口，返回 `Change` 对象供 History 使用
- 每次编辑后自动重建 `_lineStarts` 数组

## API

| 方法 | 说明 |
|------|------|
| `setContent(text)` | 设置全文（文件加载时） |
| `toString()` | 获取全文 |
| `sliceContent(from, to)` | 获取指定范围文本 |
| `line(n)` | 按行号获取行（1-based） |
| `lineAt(pos)` | 按文档位置获取行 |
| `replaceRange(from, to, text)` | 替换范围内文本 |
| `insertText(pos, text)` | 在指定位置插入文本 |
| `deleteRange(from, to)` | 删除范围内文本 |

## DocLike 兼容

实现了 parsers 所需的接口：`line(n)`, `lineAt(pos)`, `lines`（行数）, `toString()`, `sliceContent(from, to)`，因此 `parseDocumentToBlocks()` 可直接传入。
