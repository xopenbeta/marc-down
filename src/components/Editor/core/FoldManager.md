# FoldManager.ts

## 作用

管理折叠/展开功能，复用现有的行尾空格标记机制。

## 折叠机制

折叠不使用独立状态，而是通过行尾空格标记：
- 行尾有尾随空格 → `collapsed = true` → 渲染时隐藏块体
- 去掉尾随空格 → `collapsed = false` → 展开

## API

| 方法 | 说明 |
|------|------|
| `toggleFold(togglePos)` | 切换指定块的折叠状态 |
| `isFolded(togglePos)` | 检查指定块是否已折叠 |
| `foldAll(blocks)` | 批量折叠所有可折叠块 |
| `unfoldAll(blocks)` | 批量展开所有已折叠块 |

## 批量操作

- `foldAll`: 从后向前遍历（避免位置偏移），对未折叠的块插入尾随空格
- `unfoldAll`: 按 togglePos 降序排列，删除尾随空格
