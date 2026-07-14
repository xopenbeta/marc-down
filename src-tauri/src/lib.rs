mod commands;

use std::sync::Mutex;
use tauri::{Emitter, Manager};

fn log_to_file(msg: &str) {
    use std::io::Write;
    let home = std::env::var("HOME").unwrap_or_else(|_| "/tmp".to_string());
    let log_path = format!("{}/marcdown_crash.log", home);
    if let Ok(mut f) = std::fs::OpenOptions::new().create(true).append(true).open(&log_path) {
        let _ = writeln!(f, "[{}] {}", chrono_now(), msg);
    }
}

fn chrono_now() -> String {
    let dur = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default();
    format!("{}", dur.as_secs())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    std::panic::set_hook(Box::new(|info| {
        let msg = format!("PANIC: {}", info);
        log_to_file(&msg);
    }));

    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .manage(OpenedFile(Mutex::new(None)))
        .invoke_handler(tauri::generate_handler![
            commands::fs_commands::read_directory_tree,
            commands::fs_commands::read_directory_children,
            commands::fs_commands::open_path_dialog,
            commands::search_commands::search_in_files,
            commands::export_commands::export_epub,
            win_linux_get_open_app_with_file,
        ])
        .setup(|app| {
            let args: Vec<String> = std::env::args().collect();
            if args.len() > 1 {
                let file_path = &args[1];
                if file_path.ends_with(".md") || file_path.ends_with(".markdown") {
                    let path = std::path::Path::new(file_path);
                    if path.exists() {
                        let abs_path = path.canonicalize().unwrap_or(path.to_path_buf());
                        if let Ok(mut stored) = app.state::<OpenedFile>().0.lock() {
                            *stored = Some(abs_path.to_string_lossy().to_string());
                        }
                    }
                }
            }
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while running tauri application")
        .run(|_app, _event| {
            #[cfg(target_os = "macos")]
            if let tauri::RunEvent::Opened { urls } = &_event {
                for url in urls {
                    let file_path = match url.to_file_path() {
                        Ok(p) => p.to_string_lossy().to_string(),
                        Err(_) => continue,
                    };
                    if !file_path.ends_with(".md") && !file_path.ends_with(".markdown") {
                        continue;
                    }
                    if let Some(state) = _app.try_state::<OpenedFile>() {
                        if let Ok(mut stored) = state.0.lock() {
                            *stored = Some(file_path.clone());
                        }
                    }
                    let _ = _app.emit("mac_open_app_with_file", file_path);
                }
            }
        });
}

struct OpenedFile(Mutex<Option<String>>);

#[tauri::command]
fn win_linux_get_open_app_with_file(state: tauri::State<'_, OpenedFile>) -> Option<String> {
    state.0.lock().unwrap().take()
}
