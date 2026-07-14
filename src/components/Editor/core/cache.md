# cache.ts

Widget 高度缓存和图片尺寸缓存，用于虚拟滚动的高度估算。

## 作用

虚拟滚动对未渲染的块使用缓存高度构建内部高度图。本模块缓存实际测量高度，避免估算偏差导致滚动跳动。

## 两种缓存

1. **widgetHeightCache** `Map<string, number>` -- 块渲染后的实际像素高度
2. **imageDimCache** `Map<string, {width, height}>` -- 图片原始像素尺寸，用于在 `<img>` 加载前设置正确的 width/height 属性避免 reflow

## 核心函数

| 函数 | 说明 |
|------|------|
| `hashBlock(content)` | 生成内容 hash（djb2） |
| `hashBlockId(content)` | 生成块 ID（内容 + 容器宽度的 hash） |
| `getCachedHeight(id, fallback)` | 读取缓存高度，miss 时返回 fallback |
| `setCachedHeight(id, height)` | 写入缓存高度 |
| `scheduleHeightCache(id, element)` | 在下一帧 layout 后读取 `offsetHeight` 并缓存 |
| `getCachedImageDim(url)` | 读取图片尺寸缓存 |
| `cacheImageDim(url, width, height)` | 写入图片尺寸缓存 |
| `setContainerWidth(w)` | 设置容器宽度（影响 hashBlockId） |
| `setRequestMeasureFn(fn)` | 注册高度变化通知回调 |
| `notifyHeightChange()` | 触发高度变化通知 |

## 消费方

- `MdRenderer.ts` -- 读写块高度缓存
- `widgets/` -- 渲染后调用 `scheduleHeightCache` 记录实际高度
- `parsers/*.ts` -- 使用 `hashBlockId` 生成块 ID
