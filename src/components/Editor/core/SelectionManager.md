# SelectionManager.ts

## 作用

管理文档选区状态（anchor + head），控制光标显示和选区高亮渲染。

## 选区模型

- `anchor`: 选区起点（鼠标按下位置）
- `head`: 选区终点（当前光标位置）
- `from` / `to`: 选区的有序边界（from <= to）
- `hasSelection`: anchor !== head 时为 true

## 光标

- 使用独立 `div.native-editor-cursor` 元素
- 通过 `setInterval(530ms)` 实现闪烁动画
- 每次选区变化时重置闪烁（先显示再开始计时）
- 有选区时隐藏光标

## 选区高亮

- 在独立的 `selectionLayer` 中渲染绝对定位的矩形 div
- EditorCore 负责计算选区矩形（处理单行/跨行情况），SelectionManager 负责渲染
