# TextMeasure.ts

## 作用

自研文本测量引擎，使用 Canvas API 测量字符宽度，支持 inline 图片和 inline 数学公式的尺寸测量，实现精确的行布局和坐标映射。

## 为什么自研

pretext (@chenglou/pretext) 只能测量纯文本。Markdown 编辑器需要：
- inline 图片（`![alt](url)`）渲染为行内缩略图，有已知宽高
- inline 数学公式（`$E=mc^2$`）渲染为 KaTeX span，需 DOM 测量后缓存
- 混合行中文本、图片、公式混排时的精确换行和高度计算

## 核心数据结构

### MeasureSegment
```ts
{ type: 'text' | 'inline-image' | 'inline-math', text: string, font: string, width?: number, height?: number }
```

### GlyphInfo
```ts
{ segmentIndex: number, charIndex: number, width: number, height: number, breakable: boolean }
```

### PreparedLine / LineLayout
测量结果和布局结果，由 `prepareLine()` 和 `layoutLine()` 生成。

## 核心 API

| 函数 | 说明 |
|------|------|
| `prepareLine(segments)` | Canvas 测量所有 glyph 宽度，生成 GlyphInfo 数组 |
| `layoutLine(prepared, maxWidth, lineHeight)` | 贪心换行算法，计算视觉行分布 |
| `posAtX(prepared, layout, visualLine, x)` | x 坐标 → 字符位置 |
| `coordsAtChar_documentPosIndex(prepared, layout, charPos)` | 字符位置 → (visualLine, x) 坐标 |
| `measureInlineMath(latex)` | KaTeX 一次性 DOM 渲染测量宽度，结果缓存 |

## 测量流程

```
原始行 "Hello $E=mc^2$ world"
  → InlineParser 解析出 segments
  → prepareLine(segments):
    - text segments → Canvas.measureText() 逐字符
    - inline-math → 查缓存或 DOM 测量
    - inline-image → 查缓存获取尺寸
    → 生成 GlyphInfo[]
  → layoutLine(prepared, containerWidth, 27.2):
    - 贪心换行：累加宽度，超出 maxWidth 时在最近 breakable 点断行
    → 返回 visualLines[]，每行含 { width, height, startGlyph, endGlyph }
```

## MdRenderer 如何使用 TextMeasure

MdRenderer 在三个场景使用 TextMeasure：

### 1. 高度计算（`measureTextBlock`）

计算块的精确像素高度，用于虚拟滚动定位。

```
measureTextBlock(block, contentWidth)
  → 遍历块内每一行
    → InlineParser 解析出 segments
    → prepareLine(segments) — 测量每个 glyph 宽度
    → layoutLine(prepared, contentWidth, lineHeight) — 得到 visual line 数量和总高度
  → 累加所有行的 totalHeight + paddingTop + paddingBottom
```

### 2. 渲染时缓存布局信息（`renderBlock`）

渲染块 DOM 时，同时计算并缓存每行的 PreparedLine 和 LineLayout，存入 RenderedBlock 中供后续坐标映射使用。

```
renderBlock(index)
  → 逐行:
    → prepareLine(segments) → 缓存到 rb.preparedLines[i]
    → layoutLine(prepared, contentWidth, lineHeight) → 缓存到 rb.layouts[i]
    → 用 layout.totalHeight 累加得到每行的 Y 偏移 → rb.lineYs[i]
```

### 3. 坐标映射（`getDocumentPosIndexAtCoords` / `coordsAtDocPos` / `visualLineMove`）

利用缓存的 PreparedLine + LineLayout 做精确的字符级定位：

```
getDocumentPosIndexAtCoords(clientX, clientY, blockYs)  — 鼠标点击 → 文档位置
  → 定位到哪个 block → 哪个行 → 哪个 visual line
  → posAtX(prepared, layout, visualLineIdx, x) — 在该 visual line 内找最近字符

coordsAtDocPos(pos, blockYs)  — 文档位置 → 屏幕坐标
  → 定位到 block → 行
  → coordsAtChar_documentPosIndex(prepared, layout, charOffset) — 得到 (visualLine, x)
  → 加上 blockY + lineY + paddingTop 得到绝对屏幕 y

visualLineMove(pos, direction)  — 上下箭头键跨 visual line 导航
  → coordsAtChar_documentPosIndex 得到当前 visual line 和 x
  → posAtX 在目标 visual line 找同 x 位置的字符
```

## 字体来源

Canvas 测量使用的字体由 `EditorFont.ts` 模块提供（从 CSS 变量 `--font-mono` 动态读取），不硬编码。
`prepareLine` 接收的每个 segment 自带 font 字段，由调用方（MdRenderer）通过 `getBaseFont()` 或 `getHeadingFont(level)` 传入。

## 缓存策略

- 字符宽度缓存：`Map<font, Map<codePoint, width>>`，避免重复 Canvas 调用
- inline 数学宽度缓存：`Map<latex, { width, height }>`，一次 DOM 测量后永久缓存
- CJK 字符间可换行（通过 Unicode 范围判断）
