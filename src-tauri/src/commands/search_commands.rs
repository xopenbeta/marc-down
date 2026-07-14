use serde::Serialize;
use std::fs;
use walkdir::WalkDir;

#[derive(Serialize, Clone)]
pub struct SearchMatch {
    pub file_path: String,
    pub file_name: String,
    pub line: usize,
    pub content: String,
    pub match_start: usize,
    pub match_end: usize,
}

#[tauri::command]
pub fn search_in_files(workspace_path: String, query: String) -> Result<Vec<SearchMatch>, String> {
    if query.is_empty() {
        return Ok(Vec::new());
    }

    let query_lower = query.to_lowercase();
    let mut results: Vec<SearchMatch> = Vec::new();

    for entry in WalkDir::new(&workspace_path)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        let path = entry.path();
        if !path.is_file() {
            continue;
        }

        let file_name = path
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_default();

        if !file_name.ends_with(".md") || file_name.starts_with('.') {
            continue;
        }

        let content = match fs::read_to_string(path) {
            Ok(c) => c,
            Err(_) => continue,
        };

        for (line_idx, line) in content.lines().enumerate() {
            let line_lower = line.to_lowercase();
            let mut start = 0;
            while let Some(pos) = line_lower[start..].find(&query_lower) {
                let match_start = start + pos;
                let match_end = match_start + query.len();
                results.push(SearchMatch {
                    file_path: path.to_string_lossy().to_string(),
                    file_name: file_name.clone(),
                    line: line_idx + 1,
                    content: line.to_string(),
                    match_start,
                    match_end,
                });
                start = match_end;
            }
        }

        if results.len() > 500 {
            break;
        }
    }

    Ok(results)
}
