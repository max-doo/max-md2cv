// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/

use serde::Serialize;
use std::fs;
use tauri::Manager;

#[derive(Serialize, Clone)]
pub struct TemplateInfo {
    pub id: String,
    pub name: String,
    pub css: String,
}

/// Scan built-in resource templates and user-custom templates from appDataDir.
/// User templates take precedence over built-ins with the same id.
#[tauri::command]
async fn list_templates(app: tauri::AppHandle) -> Result<Vec<TemplateInfo>, String> {
    let mut templates: Vec<TemplateInfo> = Vec::new();

    // 1. Load built-in templates first (lower priority)
    let resource_dir = app
        .path()
        .resource_dir()
        .map_err(|e| format!("Failed to get resource dir: {}", e))?;
    let builtin_path = resource_dir.join("templates");
    if builtin_path.exists() {
        load_templates_from_dir(&builtin_path, &mut templates)?;
    }

    // 2. Load user-custom templates (higher priority — overrides built-ins with same id)
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;
    let user_path = app_data_dir.join("templates");
    if !user_path.exists() {
        let _ = fs::create_dir_all(&user_path);
    }
    if user_path.exists() {
        // This variant removes any builtin entry that the user has shadowed
        load_templates_overriding(&user_path, &mut templates)?;
    }

    Ok(templates)
}

/// Write (or overwrite) a template CSS file in the user's AppData/templates directory.
#[tauri::command]
async fn save_template(
    app: tauri::AppHandle,
    id: String,
    css: String,
) -> Result<(), String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;
    let user_path = app_data_dir.join("templates");
    if !user_path.exists() {
        fs::create_dir_all(&user_path)
            .map_err(|e| format!("Failed to create templates dir: {}", e))?;
    }
    let file_path = user_path.join(format!("{}.css", id));
    fs::write(&file_path, &css)
        .map_err(|e| format!("Failed to write template {:?}: {}", file_path, e))?;
    Ok(())
}

fn load_templates_from_dir(
    dir: &std::path::Path,
    templates: &mut Vec<TemplateInfo>,
) -> Result<(), String> {
    let entries = fs::read_dir(dir).map_err(|e| format!("Failed to read dir {:?}: {}", dir, e))?;
    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) == Some("css") {
            let css_content =
                fs::read_to_string(&path).map_err(|e| format!("Failed to read {:?}: {}", path, e))?;
            let name = extract_meta(&css_content, "name").unwrap_or_else(|| {
                path.file_stem()
                    .and_then(|s| s.to_str())
                    .unwrap_or("unknown")
                    .to_string()
            });
            let id = path
                .file_stem()
                .and_then(|s| s.to_str())
                .unwrap_or("unknown")
                .to_string();
            // Skip duplicates (first-loaded wins for this function)
            if !templates.iter().any(|t| t.id == id) {
                templates.push(TemplateInfo { id, name, css: css_content });
            }
        }
    }
    Ok(())
}

/// Same as `load_templates_from_dir` but user entries *replace* any existing entry with the same id.
fn load_templates_overriding(
    dir: &std::path::Path,
    templates: &mut Vec<TemplateInfo>,
) -> Result<(), String> {
    let entries = fs::read_dir(dir).map_err(|e| format!("Failed to read dir {:?}: {}", dir, e))?;
    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) == Some("css") {
            let css_content =
                fs::read_to_string(&path).map_err(|e| format!("Failed to read {:?}: {}", path, e))?;
            let name = extract_meta(&css_content, "name").unwrap_or_else(|| {
                path.file_stem()
                    .and_then(|s| s.to_str())
                    .unwrap_or("unknown")
                    .to_string()
            });
            let id = path
                .file_stem()
                .and_then(|s| s.to_str())
                .unwrap_or("unknown")
                .to_string();
            // Remove existing entry with same id (user overrides builtin)
            templates.retain(|t| t.id != id);
            templates.push(TemplateInfo { id, name, css: css_content });
        }
    }
    Ok(())
}

/// Parse `/* @key: value */` style metadata from CSS content.
fn extract_meta(css: &str, key: &str) -> Option<String> {
    let pattern = format!("@{}:", key);
    for line in css.lines() {
        let trimmed = line.trim();
        if let Some(pos) = trimmed.find(&pattern) {
            let after = &trimmed[pos + pattern.len()..];
            let value = after.replace("*/", "").trim().to_string();
            if !value.is_empty() {
                return Some(value);
            }
        }
    }
    None
}

/// Locate a Chromium-based browser executable on the current platform.
fn find_browser() -> Result<String, String> {
    #[cfg(target_os = "windows")]
    {
        // 1. Try Windows Registry (App Paths for msedge.exe)
        if let Ok(browser) = find_browser_from_registry("msedge.exe") {
            return Ok(browser);
        }
        if let Ok(browser) = find_browser_from_registry("chrome.exe") {
            return Ok(browser);
        }

        // 2. Fallback to well-known installation paths
        let candidates = [
            r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
            r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
            r"C:\Program Files\Google\Chrome\Application\chrome.exe",
            r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
        ];
        for path in &candidates {
            if std::path::Path::new(path).exists() {
                return Ok(path.to_string());
            }
        }

        Err("未找到 Edge 或 Chrome 浏览器。请安装 Microsoft Edge 或 Google Chrome 后重试。".into())
    }

    #[cfg(target_os = "macos")]
    {
        let candidates = [
            "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
            "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
        ];
        for path in &candidates {
            if std::path::Path::new(path).exists() {
                return Ok(path.to_string());
            }
        }
        Err("未找到 Chrome 或 Edge 浏览器。请安装 Google Chrome 或 Microsoft Edge 后重试。".into())
    }

    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        // Linux: rely on PATH
        let candidates = ["google-chrome", "google-chrome-stable", "chromium-browser", "chromium", "microsoft-edge"];
        for cmd in &candidates {
            if std::process::Command::new("which").arg(cmd).output().map(|o| o.status.success()).unwrap_or(false) {
                return Ok(cmd.to_string());
            }
        }
        Err("未找到 Chrome 或 Chromium 浏览器。请安装后重试。".into())
    }
}

/// (Windows only) Look up a browser exe via the App Paths registry key.
#[cfg(target_os = "windows")]
fn find_browser_from_registry(exe_name: &str) -> Result<String, String> {
    use winreg::enums::HKEY_LOCAL_MACHINE;
    use winreg::RegKey;

    let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
    let key_path = format!(r"SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\{}", exe_name);
    let subkey = hklm.open_subkey(&key_path).map_err(|e| e.to_string())?;
    let path: String = subkey.get_value("").map_err(|e| e.to_string())?;
    if std::path::Path::new(&path).exists() {
        Ok(path)
    } else {
        Err("Registry path does not exist on disk".into())
    }
}

#[tauri::command]
async fn export_pdf_command(html_content: String, output_path: String) -> Result<(), String> {
    use std::fs::File;
    use std::io::Write;
    use std::process::Command;

    // 1. Write HTML to a temp file
    let temp_dir = std::env::temp_dir();
    let temp_html_path = temp_dir.join("max_md2cv_temp.html");

    let mut file = File::create(&temp_html_path).map_err(|e| e.to_string())?;
    file.write_all(html_content.as_bytes()).map_err(|e| e.to_string())?;

    // 2. Find a Chromium-based browser
    let browser_path = find_browser()?;

    // 3. Run headless print-to-pdf
    let output = Command::new(&browser_path)
        .arg("--headless=new")
        .arg("--disable-gpu")
        .arg("--no-pdf-header-footer")
        .arg(format!("--print-to-pdf={}", output_path))
        .arg(temp_html_path.to_str().unwrap_or_default())
        .output()
        .map_err(|e| format!("浏览器启动失败 ({}): {}", browser_path, e))?;

    if !output.status.success() {
        let err_msg = String::from_utf8_lossy(&output.stderr);
        return Err(format!("浏览器导出错误: {}", err_msg));
    }

    // 4. Clean up
    let _ = std::fs::remove_file(temp_html_path);

    Ok(())
}

#[derive(Serialize)]
pub struct FileEntry {
    pub name: String,
    pub path: String,
}

#[tauri::command]
async fn list_resumes(dir_path: String) -> Result<Vec<FileEntry>, String> {
    let mut files = Vec::new();
    if let Ok(entries) = std::fs::read_dir(&dir_path) {
        for entry in entries.flatten() {
            if let Ok(file_type) = entry.file_type() {
                if file_type.is_file() {
                    let name = entry.file_name().to_string_lossy().to_string();
                    if name.ends_with(".md") {
                        files.push(FileEntry {
                            name,
                            path: entry.path().to_string_lossy().to_string(),
                        });
                    }
                }
            }
        }
    }
    Ok(files)
}

#[tauri::command]
async fn read_resume(path: String) -> Result<String, String> {
    std::fs::read_to_string(path).map_err(|e| e.to_string())
}

#[tauri::command]
async fn write_resume(path: String, content: String) -> Result<(), String> {
    std::fs::write(path, content).map_err(|e| e.to_string())
}

#[tauri::command]
async fn delete_resume(path: String) -> Result<(), String> {
    trash::delete(path).map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_persisted_scope::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            export_pdf_command, 
            list_templates, 
            save_template,
            list_resumes,
            read_resume,
            write_resume,
            delete_resume
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
