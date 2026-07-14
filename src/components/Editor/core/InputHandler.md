# InputHandler.ts

## 作用

管理隐藏 textarea，捕获所有键盘输入、IME 组合和剪贴板事件。

## 隐藏 textarea

- opacity:0, 1x1px, position:absolute
- 跟随光标位置移动（确保 IME 候选框定位正确）
- 所有键盘输入进入 textarea，通过事件处理转化为文档操作

## 事件处理

### 键盘输入流程
```
用户按键
  ├── keydown 拦截（特殊按键）
  │     ├── Enter → 插入换行 + 列表自动续行
  │     ├── Backspace/Delete → 删除字符/选区
  │     ├── Tab/Shift+Tab → 缩进/取消缩进
  │     ├── Cmd+Z / Cmd+Shift+Z → Undo/Redo
  │     ├── Cmd+A → 全选
  │     └── Cmd+C/X → 复制/剪切选区
  └── 普通字符 → 进入 textarea
        → input 事件 → 读取 textarea.value
        → Document.insertText()
        → 清空 textarea
```

### IME 处理
- `compositionstart` → 标记 composing 状态，暂停 input 事件处理
- `compositionend` → 读取最终文本 → 写入 Document → 清空 textarea

### 剪贴板
- `paste` → 拦截 → 提取纯文本 → 插入 Document
- `copy` → 将选区文本写入 textarea → 不阻止默认行为
- `cut` → 复制 + 延迟删除选区

## 列表续行

Enter 键在列表行末按下时自动生成下一行的列表前缀：
- 无序列表：`- ` / `* ` / `+ `
- 有序列表：自动递增编号（如 `1. ` → `2. `）
- 空列表项上按 Enter：删除列表标记而非续行
