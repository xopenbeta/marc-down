use serde::Serialize;
use std::path::Path;

#[derive(Serialize, Clone)]
pub struct FileNode {
    pub name: String,
    pub path: String,
    pub is_directory: bool,
    pub children: Option<Vec<FileNode>>,
}

/// 只读取一层目录（不递归），用于初始加载和展开文件夹
#[tauri::command]
pub fn read_directory_tree(path: String) -> Result<FileNode, String> {
    let root = Path::new(&path);
    if !root.exists() {
        return Err(format!("Path does not exist: {}", path));
    }
    if !root.is_dir() {
        return Err(format!("Path is not a directory: {}", path));
    }

    let children = read_one_level(root);
    let name = root
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_default();

    Ok(FileNode {
        name,
        path: path,
        is_directory: true,
        children: Some(children),
    })
}

/// 读取指定文件夹的直接子项（展开时调用）
#[tauri::command]
pub fn read_directory_children(path: String) -> Result<Vec<FileNode>, String> {
    let dir = Path::new(&path);
    if !dir.exists() || !dir.is_dir() {
        return Err(format!("Invalid directory: {}", path));
    }
    Ok(read_one_level(dir))
}

#[derive(Serialize)]
pub struct OpenPathResult {
    pub path: String,
    pub is_directory: bool,
}

#[tauri::command]
pub fn open_path_dialog() -> Option<OpenPathResult> {
    #[cfg(target_os = "macos")]
    {
        use objc2::MainThreadMarker;
        use objc2_app_kit::{NSModalResponseOK, NSOpenPanel};

        let mtm = unsafe { MainThreadMarker::new_unchecked() };
        let panel = NSOpenPanel::openPanel(mtm);
        panel.setCanChooseFiles(true);
        panel.setCanChooseDirectories(true);
        panel.setAllowsMultipleSelection(false);

        let response = panel.runModal();
        if response != NSModalResponseOK {
            return None;
        }

        let urls = panel.URLs();
        let url = urls.firstObject()?;
        let path_str = url.path()?.to_string();
        let is_directory = Path::new(&path_str).is_dir();
        Some(OpenPathResult { path: path_str, is_directory })
    }

    #[cfg(not(target_os = "macos"))]
    {
        None
    }
}

fn read_one_level(dir: &Path) -> Vec<FileNode> {
    let mut children: Vec<FileNode> = Vec::new();
    let Ok(entries) = std::fs::read_dir(dir) else {
        return children;
    };

    let mut entries: Vec<_> = entries.filter_map(|e| e.ok()).collect();
    entries.sort_by(|a, b| {
        let a_is_dir = a.path().is_dir();
        let b_is_dir = b.path().is_dir();
        match (a_is_dir, b_is_dir) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            _ => a.file_name().cmp(&b.file_name()),
        }
    });

    for entry in entries {
        let entry_path = entry.path();
        let entry_name = entry.file_name().to_string_lossy().to_string();

        if entry_name.starts_with('.') {
            continue;
        }

        if entry_path.is_dir() {
            children.push(FileNode {
                name: entry_name,
                path: entry_path.to_string_lossy().to_string(),
                is_directory: true,
                children: None, // 不递归，children 留空表示未加载
            });
        } else if entry_name.ends_with(".md") {
            children.push(FileNode {
                name: entry_name,
                path: entry_path.to_string_lossy().to_string(),
                is_directory: false,
                children: None,
            });
        }
    }

    children
}
