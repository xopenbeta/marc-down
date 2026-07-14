# VirtualScroller.ts

## 作用

虚拟滚动管理器，维护块高度数组和 Y 偏移量，计算可见块范围，供光标定位和滚动条使用。

## 核心设计

- 维护 `blockHeights: number[]` 和 `blockYs: number[]`（前缀和）
- 总高度 `totalHeight` = Σ blockHeights，用于自定义滚动条计算和光标坐标映射
- 滚动事件 → 计算可见范围 → 通知 MdRenderer 添加/移除块 DOM
- **不控制 DOM 布局**：块元素在 contentLayer 中以普通文档流排列，VirtualScroller 只负责逻辑高度计算

## 在 EditorCore 中的使用方式

```
EditorCore.init()
  ├─ parseAndRenderFirstScreen()         // 首屏渲染
  └─ measureAllBlocks() → callback:
       ├─ scroller.setBlockHeights(heights)  // 初始化所有块高度
       └─ fullRender()

EditorCore.fullRender()
  ├─ renderer.incrementalUpdate()           // 重新解析文档、更新块列表
  ├─ scroller.setBlockHeights(heights)      // 同步高度数组
  ├─ scroller.computeVisibleRange()         // 计算可见块范围 [from, to]
  ├─ renderer.renderBlockRange(from, to)    // 只渲染可见范围内的块 DOM
  ├─ updateCursorVisual()                   // 用 scroller.getBlockY() 定位光标
  └─ updateScrollbar()                      // 用 scroller.getTotalHeight() 计算滚动条
```

## totalHeight 的消费者

| 消费者 | 用途 |
|--------|------|
| `EditorCore.updateScrollbar()` | 计算自定义滚动条 thumb 大小和位置 |
| `EditorCore.updateCursorVisual()` | 通过 `getBlockY(i)` 获取块 Y 坐标，定位光标 |
| `EditorCore.renderSelectionHighlight()` | 通过 blockYs 计算选区矩形坐标 |
| `MdRenderer.getDocumentPosIndexAtCoords()` | 点击坐标 → 文档位置映射 |
| `MdRenderer.coordsAtDocPos()` | 文档位置 → 像素坐标映射 |

## 滚动时发生了什么

```
用户滚动 scrollContainer
  │
  ▼
handleScroll()
  │
  ├─ computeVisibleRange()
  │    ├─ 读取 scrollTop 和 viewportHeight
  │    ├─ 计算缓冲范围: [scrollTop - 3×viewport, scrollTop + viewport + 3×viewport]
  │    ├─ blockIndexAtY(rangeTop)  → from（二分查找）
  │    └─ blockIndexAtY(rangeBottom) → to（二分查找）
  │
  └─ 如果 [from, to] 与上次不同:
       │
       ▼
     onViewportChange(from, to)  →  EditorCore 收到回调
       │
       ▼
     MdRenderer.renderBlockRange(from, to)
       ├─ 渲染新进入范围的块（创建 DOM 元素）
       ├─ 移除离开范围的块（remove DOM 元素）
       └─ reconcileHeights()（下一帧对比 DOM 高度与计算高度）
```

**关键细节：**
- 只有 `[from, to]` 变化时才触发回调，避免每帧都重渲染
- `bufferRatio=3` 意味着视口上下各预渲染 3 屏内容，减少快速滚动时的白屏
- 对于短文档（总高度 < 7×视口），所有块始终在渲染范围内，滚动不会触发 DOM 增删

## 可见范围计算

- 缓冲区：视口上下各 `bufferRatio`(=3) × 视口高度
- `blockIndexAtY(y)`: 二分查找 Y 偏移量数组
- `computeVisibleRange()`: 返回 `{ from, to }` 块索引范围

## API

| 方法 | 说明 |
|------|------|
| `setBlockHeights(heights)` | 设置所有块高度，重算 Y 偏移 |
| `getBlockY(index)` | 获取块的 Y 偏移（用于光标和坐标计算） |
| `getTotalHeight()` | 获取文档总高度（用于滚动条） |
| `computeVisibleRange()` | 计算当前应渲染的块索引范围 |
| `scrollIntoView(y)` | 滚动指定区域到视口内 |
| `getScrollTop()` / `setScrollTop(top)` | 读写滚动位置 |
| `setScrollEnabled(enabled)` | 初始化期间禁用/启用滚动 |
