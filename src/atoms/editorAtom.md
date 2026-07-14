# editorAtom.ts

## 作用

管理编辑器的多标签页状态：已打开文件列表、当前活动文件路径、以及派生的当前活动文件对象。

## 为什么这么实现

- `openFilesAtom` 和 `activeFilePathAtom` 分离，因为切换标签只需改路径，无需重新设置文件列表
- `activeFileAtom` 是派生 atom（derived atom），从前两者计算得出，避免数据冗余和不一致
- 文件内容直接存在 atom 中，保证 Jotai 是唯一数据源，大纲和搜索可直接订阅
- `editorViewStateCache` 是 Map 而非 atom，因为它只在编辑器内部使用（保存/恢复滚动位置和选区），不需要触发 React 重渲染
