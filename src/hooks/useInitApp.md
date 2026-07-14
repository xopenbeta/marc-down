# useInitApp.ts

## 作用

加载初始化数据
- 处理系统级文件打开事件，使 .md 文件双击或右键"打开方式"可直接在本应用中编辑。

## 为什么这么实现

- 启动时通过 `win_linux_get_open_app_with_file` 命令获取 CLI 参数中的文件路径（Windows/Linux 场景）
- 监听 Tauri `mac_open_app_with_file` 事件处理运行时文件打开（macOS Apple Events 场景）
- 使用 `listen` + cleanup 模式确保事件监听器在组件卸载时正确移除
