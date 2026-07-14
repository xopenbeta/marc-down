# EventHandlers.ts

## 作用

编辑器交互事件处理，包括链接点击、hover 预览、右键菜单和修饰键跟踪。

## 功能

### 链接点击
- 普通链接 `.tok-link` — 直接打开 URL
- URL 文本 `.tok-url` — 需 ⌘/Ctrl+点击打开

### Hover 预览弹窗
- inline 数学公式 `.cm-math-inline-render` → 显示 displayMode 预览
- inline 图片 `.cm-image-inline-preview` → 显示大图预览
- 链接 `.tok-link` → 显示"点击打开链接"提示
- URL `.tok-url` → 显示"⌘+点击打开链接"提示

### 其他交互
- 任务列表点击 `.cm-task-checkbox` → 切换 `[ ]`/`[x]`
- 折叠指示器点击 → 触发 FoldManager
- 右键菜单 → 转发为 `editor-contextmenu` 自定义事件
- 修饰键跟踪 → 添加/移除 `.cm-mod-key-held` CSS class

## 弹窗定位

弹窗优先显示在目标元素下方，空间不足时显示在上方。水平位置自动调整避免超出窗口边界。
