# useSearch.ts

## 作用

封装全局搜索逻辑的自定义 hook，管理搜索关键词输入和调用后端搜索。

## 为什么这么实现

- 搜索通过 Rust 后端 `invoke` 执行（`searchInFiles`），因为全文搜索需要遍历文件系统，在原生侧执行比 JS 快几个数量级
- `performSearch` 支持传入可选参数覆盖当前 query，为将来"搜索选中文本"等快捷操作预留接口
- 搜索前检查 `query.trim()` 和 `workspacePath`，避免无效请求
