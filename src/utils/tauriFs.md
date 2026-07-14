# tauriFs.ts

## 作用

封装所有与 Tauri 后端交互的文件系统操作（打开目录、读写文件、创建/删除/重命名、全文搜索）。

## 为什么这么实现

- 将 Tauri API 调用集中在一个服务层，使上层 hooks/组件不直接依赖 `@tauri-apps/*`，便于测试和未来替换后端
- `readDirectoryTree` 和 `searchInFiles` 通过 `invoke` 调用 Rust command，因为这些操作需要递归遍历文件系统，在原生侧执行性能远优于 JS
- `openPathDialog` 通过 Rust command 调用 macOS NSOpenPanel（同时允许选择文件和文件夹），因为 Tauri dialog 插件不支持同时选文件和文件夹
- 简单的读写操作使用 Tauri 的 fs 插件（`readTextFile`/`writeTextFile`），无需自定义 command
