# outlineAtom.ts

## 作用

存储当前活动文件解析出的 Markdown 标题列表，供大纲面板渲染。

## 为什么这么实现

- 独立 atom 而非组件内部 state，因为标题数据由 `useOutline` hook 在顶层产生，大纲组件只需读取
- 数据更新由 hook 中的防抖逻辑控制，atom 本身只是纯存储，保持简单
