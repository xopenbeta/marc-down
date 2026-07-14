# useKeyboardShortcuts.ts

## 作用

注册全局键盘快捷键（Cmd+S 保存、Cmd+Shift+F 切换搜索面板）。

## 为什么这么实现

- 使用 `window` 级事件监听而非组件级，确保快捷键在任何焦点状态下都能响应
- 通过 `e.metaKey || e.ctrlKey` 兼容 macOS 和 Windows/Linux
- 放在 App 顶层，生命周期与应用一致，无需担心组件卸载导致快捷键失效
