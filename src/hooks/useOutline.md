# useOutline.ts

## 作用

监听当前活动文件内容变化，防抖解析 Markdown 标题并更新大纲 atom。

## 为什么这么实现

- 300ms 防抖避免用户快速输入时频繁解析 AST，平衡实时性与性能
- 放在 App 顶层而非 Outline 组件内，因为即使大纲面板未渲染，atom 数据也应保持最新（供其他潜在消费者使用）
- 依赖 `activeFile?.content` 而非整个 `activeFile` 对象，减少不必要的 effect 触发
