# native/

原生编辑器实现，采用隐藏 textarea + 独立渲染层架构。

## 目录结构

```
native/
  index.ts              - 统一导出（EditorCore, useEditorCore, SearchPanel）
  EditorCore.ts         - 编辑器主控类，管理所有子系统生命周期
  useEditorCore.ts    - React Hook，绑定 EditorCore 与组件生命周期
  Document.ts      - 基于行数组的文档模型（兼容 DocLike 接口）
  History.ts            - Undo/Redo 历史栈（500ms 合并窗口）
  TextMeasure.ts        - Canvas 文本测量引擎（支持 inline img/math）
  InlineParser.ts       - 行内 Markdown 语法解析 + token 生成
  InputHandler.ts       - 隐藏 textarea 输入处理（含 IME/剪贴板）
  SelectionManager.ts   - 选区 + 光标管理
  MdRenderer.ts      - 块级 DOM 渲染 + 坐标映射
  VirtualScroller.ts    - 虚拟滚动（视口上下 3× 缓冲区）
  FoldManager.ts        - 折叠/展开（行尾空格标记）
  EventHandlers.ts      - 交互事件（链接点击、hover 预览、右键菜单）
  SearchPanel.tsx        - 搜索/替换面板（React 组件）
  cache.ts              - 高度缓存 + 图片尺寸缓存
  editor.css             - 编辑器样式（语法高亮、光标、选区、Widget）
  parsers/              - 块级 Markdown 解析器
    index.ts            - 重新导出
    types.ts            - Block 接口 + DocumentBlock 联合类型
    documentBlocks.ts   - parseDocumentToBlocks 主解析函数
    math.ts             - findMathBlocks
    html.ts             - findHtmlBlocks
    image.ts            - findImageBlocks + resolveImageUrl
    table.ts            - findTableBoundaries + parseTableRow + parseAlignments
    mermaid.ts          - findMermaidBlocks + ensureMermaidInit
    codeBlock.ts        - findCodeBlocks
  widgets/              - Widget DOM 创建函数
    index.ts            - 统一导出
    bullet.ts           - 列表项目符号
    math.ts             - 数学公式渲染（行内 + 块级）
    image.ts            - 图片渲染（行内 + 块级）
    table.ts            - 表格渲染
    html.ts             - HTML 块渲染
    mermaid.ts          - Mermaid 图表渲染
    copyCode.ts         - 代码复制按钮
    langSelector.ts     - 代码块语言选择器
```

## 架构

```
用户输入 → InputHandler (隐藏 textarea)
  → Document.replaceRange()
    → History.push()
    → EditorCore.handleContentChanged()
      → TextMeasure 计算高度
      → VirtualScroller 计算可见范围
      → MdRenderer.renderBlockRange() (使用 widgets/)
      → SelectionManager 更新光标
```
