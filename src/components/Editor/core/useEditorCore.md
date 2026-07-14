# useEditorCore.ts

## 作用

React Hook，将 EditorCore 与 React 生命周期绑定。

## 接口

```ts
useEditorCore(containerRef, options) → {
  editorRef,         // EditorCore 实例引用
  scrollToLine,      // 跳转到指定行
  searchVisible,     // 搜索面板是否可见
  handleSearch,      // 搜索回调
  handleReplace,     // 替换回调
  handleReplaceAll,  // 全部替换回调
  handleNavigate,    // 导航到匹配回调
  handleSearchClose, // 关闭搜索面板回调
}
```

## 生命周期

- **挂载**: 创建 EditorCore 实例，设置内容，恢复缓存的滚动/选区状态
- **文件切换**: 销毁旧实例前保存状态到 `editorViewStateCache`，创建新实例
- **padding 变更**: 调用 `setPadding()` 更新
- **卸载**: 保存状态 → 销毁实例

## 事件监听

- `fold-all-blocks` 自定义事件 → 调用 `foldAll()` / `unfoldAll()`
- `Cmd+F` 键盘事件 → 显示 SearchPanel
