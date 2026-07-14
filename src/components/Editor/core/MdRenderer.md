# MdRenderer.ts

## 作用

将 DocumentBlock 数组渲染为 DOM，管理块的增量添加/移除，提供坐标映射。

## 核心流程

```
incrementalUpdate()
  → parseDocumentToBlocks() — 重新解析文档得到新 blockList
  → 复用旧块的 height 缓存（按 block.id 匹配）
  → 对新块调用 measureSingleBlock()：
      文本块(paragraph/heading/blockquote/gap/hr/code) → 精确计算高度
      widget 块(math/image/table/html/mermaid) → 返回 null，不设置高度

renderBlockRange(from, to)
  → 只渲染可见范围内的块，移除不可见的块
  → 渲染后调用 reconcileHeights() 异步校正

reconcileHeights() — rAF 回调
  → 读取已渲染块的真实 DOM 高度 (getBoundingClientRect)
  → 偏差 > 0.5px 时更新 block.height
  → 触发 onAsyncWidgetChanged 通知外部重新布局
```

## 高度计算策略

| 块类型 | 策略 |
|--------|------|
| paragraph/heading/blockquote/gap/hr | `measureTextBlock()` 精确计算（基于 TextMeasure 布局） |
| code | `measureCodeBlock()` 精确计算（行数 × LINE_HEIGHT） |
| math/image/table/html/mermaid | 不预设高度，等待渲染后由 `reconcileHeights()` 获取真实 DOM 高度 |

异步高度来源：
- **image** — `img.onload` 后触发 `onAsyncWidgetChanged`
- **mermaid** — `mermaid.render()` 完成后触发 `onAsyncWidgetChanged`
- **其他 widget** — `reconcileHeights()` 在下一帧读取 DOM 高度

## 块渲染

每个块生成一个 `div.md-block`，内含：
- 每一行 → `div.cm-line[data-line-number]` + InlineParser 生成的 token spans
- 代码块行添加 `cm-codeblock-line` / `cm-codeblock-header` / `cm-codeblock-footer`
- Widget 渲染区 → KaTeX/图片/表格/Mermaid/HTML 的 `div[contenteditable=false]`

## Widget 渲染

| 块类型 | 渲染方式 |
|--------|----------|
| math | KaTeX displayMode 渲染 |
| image | `<img>` 标签 + 缓存尺寸 |
| table | `<table>` HTML 表格 |
| html | innerHTML 直接渲染 |
| mermaid | 异步 mermaid.render() 生成 SVG |

## 坐标映射

| 方法 | 说明 |
|------|------|
| `getDocumentPosIndexAtCoords(clientX, clientY, blockYs)` | 鼠标坐标 → 文档位置 |
| `coordsAtDocPos(pos, blockYs)` | 文档位置 → 屏幕坐标 (x, y, height) |

坐标映射依赖 TextMeasure 的 `posAtX()` / `coordsAtChar_documentPosIndex()` 做精确的字符级定位。

## 公开 API

| 方法/属性 | 说明 |
|------|------|
| `incrementalUpdate()` | 增量更新 blockList（解析 + 高度计算） |
| `renderBlockRange(from, to)` | 渲染指定范围的块 DOM |
| `getBlockHeights()` | 返回所有块高度数组（未测量的为 0） |
| `getBlocks()` | 获取当前 blockList |
| `getContentWidth()` | 获取内容区宽度 |
| `setContainerWidth(width)` | 设置容器宽度，触发重新布局 |
| `setPadding(left, right, top)` | 设置内边距 |
| `setBaseDir(dir)` | 设置资源相对路径基准目录，当 Markdown 写 ![alt](./image.png) 时，需要知道这个文件相对于谁。baseDir 就是当前文档所在目录，resolveUrl 用它拼出 Tauri 的本地资源协议地址 |
| `measureAllBlocks(onComplete)` | 异步测量所有块高度（image/mermaid 等待加载） |
| `parseAndRenderFirstScreen(viewportHeight)` | 首屏渲染 |
| `clear()` | 清理所有渲染的 DOM |
| `onAsyncWidgetChanged` | 回调，异步高度变化时触发 |
| `onCodeLangChange` | 回调，代码块语言选择变化时触发 |

## 字体

字体配置统一由 `EditorFont.ts` 模块管理，从 CSS 变量 `--font-mono` 动态读取，不硬编码。
- `getBaseFont()` — 正文字体（size + family 从 DOM computed style 获取）
- `getHeadingFont(level)` — 标题字体（固定整数 px 字号 + weight + 同 family）

## 排版流程
这里会使用类pretext的方式进行排版，因为出于高度测量的考虑
- 在调和阶段就尝试构建一个真实dom，在提交阶段将真实dom挂载到视口dom
- 如何构建真实dom呢
  - 首先获取到了虚拟节点中的内容，进行分割文字，每个文字有自己的样式
  - 然后使用自制pretext进行排版，获取到virtual line，因为支持自动换行
  - 然后根据virtual line构建真实dom

## 问题

* offsetFrom/offsetTo, offsetIndex 三种，需要前后位置的用offsetFrom/offsetTo，范围是 [from, to)，只需要当前一个位置的用 offsetIndex
* 最小单位是char，char相对于glyph定位，glyph相对于chunk定位，chunk相对于segment定位，segment相对于paraph定位，paraph相对于block定位，block相对于doc定位
* 定位命名规则为：例如 glyph相对于chunk定位，那么定位命名为 chunkOffsetIndex，如果计算glyph相对于document定位，那么就是 documentOffsetIndex
* posFrom/posTo, posIndex 三种，需要前后位置的用posFrom/posTo，范围是 [from, to)，只需要当前一个位置的用 posIndex
