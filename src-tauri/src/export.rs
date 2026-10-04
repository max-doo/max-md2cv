use std::ffi::OsString;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

const EXPORT_DOCUMENT_MARKER: &str = "max-md2cv-export-document";

struct ExportSessionPaths {
    root_dir: PathBuf,
    html_path: PathBuf,
    profile_dir: PathBuf,
}

fn create_export_session_paths() -> Result<ExportSessionPaths, String> {
    let temp_dir = std::env::temp_dir();
    let pid = std::process::id();
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|e| format!("Failed to get system time: {}", e))?
        .as_millis();

    for attempt in 0..16 {
        let root_dir = temp_dir.join(format!("max-md2cv-export-{}-{}-{}", pid, timestamp, attempt));

        if root_dir.exists() {
            continue;
        }

        fs::create_dir_all(&root_dir)
            .map_err(|e| format!("Failed to create export temp dir {:?}: {}", root_dir, e))?;

        return Ok(ExportSessionPaths {
            html_path: root_dir.join("export.html"),
            profile_dir: root_dir.join("browser-profile"),
            root_dir,
        });
    }

    Err("无法创建唯一的导出临时目录，请稍后重试。".into())
}

fn cleanup_export_session(paths: &ExportSessionPaths) {
    let _ = fs::remove_dir_all(&paths.root_dir);
}

fn build_browser_base_args(profile_dir: &Path) -> Vec<OsString> {
    vec![
        OsString::from("--headless=new"),
        OsString::from("--disable-gpu"),
        OsString::from("--no-first-run"),
        OsString::from("--disable-extensions"),
        OsString::from("--disable-sync"),
        OsString::from("--allow-file-access-from-files"),
        OsString::from(format!("--user-data-dir={}", profile_dir.display())),
    ]
}

fn summarize_browser_stderr(stderr: &[u8]) -> String {
    let stderr_text = String::from_utf8_lossy(stderr);
    let normalized = stderr_text
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .take(6)
        .collect::<Vec<_>>()
        .join(" | ");

    if normalized.is_empty() {
        "无额外错误输出".to_string()
    } else {
        normalized
    }
}

/// Locate a Chromium-based browser executable on the current platform.
fn find_browser() -> Result<String, String> {
    #[cfg(target_os = "windows")]
    {
        if let Ok(browser) = find_browser_from_registry("msedge.exe") {
            return Ok(browser);
        }
        if let Ok(browser) = find_browser_from_registry("chrome.exe") {
            return Ok(browser);
        }

        let candidates = [
            r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
            r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
            r"C:\Program Files\Google\Chrome\Application\chrome.exe",
            r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
        ];
        for path in &candidates {
            if Path::new(path).exists() {
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
            if Path::new(path).exists() {
                return Ok(path.to_string());
            }
        }
        Err("未找到 Chrome 或 Edge 浏览器。请安装 Google Chrome 或 Microsoft Edge 后重试。".into())
    }

    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        let candidates = [
            "google-chrome",
            "google-chrome-stable",
            "chromium-browser",
            "chromium",
            "microsoft-edge",
        ];
        for cmd in &candidates {
            if std::process::Command::new("which")
                .arg(cmd)
                .output()
                .map(|output| output.status.success())
                .unwrap_or(false)
            {
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
    if Path::new(&path).exists() {
        Ok(path)
    } else {
        Err("Registry path does not exist on disk".into())
    }
}

#[tauri::command]
pub async fn export_pdf_command(html_content: String, output_path: String) -> Result<(), String> {
    use std::fs::File;
    use std::io::Write;
    use std::process::Command;

    let session_paths = create_export_session_paths()?;
    let out_path = Path::new(&output_path);

    if out_path.exists() {
        std::fs::OpenOptions::new()
            .write(true)
            .open(out_path)
            .map_err(|e| {
                if cfg!(target_os = "windows") && e.kind() == std::io::ErrorKind::PermissionDenied {
                    "无法覆盖导出文件。请检查该 PDF 文件是否已被其他程序（如 PDF 查看器、浏览器）打开并锁定，关闭后再试。".to_string()
                } else {
                    format!("无法写入: {}", e)
                }
            })?;
    }

    let export_result = (|| -> Result<(), String> {
        let mut file = File::create(&session_paths.html_path)
            .map_err(|e| format!("无法创建导出临时 HTML: {}", e))?;
        file.write_all(html_content.as_bytes())
            .map_err(|e| format!("无法写入导出临时 HTML: {}", e))?;
        file.sync_all()
            .map_err(|e| format!("无法刷新导出临时 HTML: {}", e))?;
        drop(file);

        let browser_path = find_browser()?;
        let base_args = build_browser_base_args(&session_paths.profile_dir);

        let preflight_output = {
            let mut args = base_args.clone();
            args.push(OsString::from("--dump-dom"));
            args.push(session_paths.html_path.clone().into_os_string());

            Command::new(&browser_path)
                .args(&args)
                .output()
                .map_err(|e| format!("浏览器预检启动失败 ({}): {}", browser_path, e))?
        };

        if !preflight_output.status.success() {
            return Err(format!(
                "浏览器预检失败: {}",
                summarize_browser_stderr(&preflight_output.stderr)
            ));
        }

        let preflight_dom = String::from_utf8_lossy(&preflight_output.stdout);
        if !preflight_dom.contains(EXPORT_DOCUMENT_MARKER) {
            return Err(format!(
                "浏览器未能正确加载导出页面，已中止导出。预检输出未找到导出标记。stderr: {}",
                summarize_browser_stderr(&preflight_output.stderr)
            ));
        }

        let print_output = {
            let mut args = base_args;
            args.push(OsString::from("--no-pdf-header-footer"));
            args.push(OsString::from(format!("--print-to-pdf={}", output_path)));
            args.push(session_paths.html_path.clone().into_os_string());

            Command::new(&browser_path)
                .args(&args)
                .output()
                .map_err(|e| format!("浏览器启动失败 ({}): {}", browser_path, e))?
        };

        if !print_output.status.success() {
            return Err(format!(
                "浏览器导出错误: {}",
                summarize_browser_stderr(&print_output.stderr)
            ));
        }

        let pdf_metadata = fs::metadata(out_path)
            .map_err(|e| format!("浏览器导出完成，但未找到 PDF 文件: {}", e))?;
        if pdf_metadata.len() == 0 {
            return Err("浏览器导出完成，但生成的 PDF 文件为空。".into());
        }

        Ok(())
    })();

    cleanup_export_session(&session_paths);
    export_result
}

#[tauri::command]
pub async fn export_image_command(
    html_content: String,
    output_path: String,
    page_count: u32,
) -> Result<(), String> {
    use std::fs::File;
    use std::io::Write;
    use std::process::Command;

    let session_paths = create_export_session_paths()?;
    let out_path = Path::new(&output_path);

    if out_path.exists() {
        std::fs::OpenOptions::new()
            .write(true)
            .open(out_path)
            .map_err(|e| {
                if cfg!(target_os = "windows") && e.kind() == std::io::ErrorKind::PermissionDenied {
                    "无法覆盖导出文件。请检查该图片是否已被其他程序打开锁定，关闭后再试。".to_string()
                } else {
                    format!("无法写入: {}", e)
                }
            })?;
    }

    let export_result = (|| -> Result<(), String> {
        let mut file = File::create(&session_paths.html_path)
            .map_err(|e| format!("无法创建导出临时 HTML: {}", e))?;
        file.write_all(html_content.as_bytes())
            .map_err(|e| format!("无法写入导出临时 HTML: {}", e))?;
        file.sync_all()
            .map_err(|e| format!("无法刷新导出临时 HTML: {}", e))?;
        drop(file);

        let browser_path = find_browser()?;
        let base_args = build_browser_base_args(&session_paths.profile_dir);

        let preflight_output = {
            let mut args = base_args.clone();
            args.push(OsString::from("--dump-dom"));
            args.push(session_paths.html_path.clone().into_os_string());

            Command::new(&browser_path)
                .args(&args)
                .output()
                .map_err(|e| format!("浏览器预检启动失败 ({}): {}", browser_path, e))?
        };

        if !preflight_output.status.success() {
            return Err(format!(
                "浏览器预检失败: {}",
                summarize_browser_stderr(&preflight_output.stderr)
            ));
        }

        let preflight_dom = String::from_utf8_lossy(&preflight_output.stdout);
        if !preflight_dom.contains(EXPORT_DOCUMENT_MARKER) {
            return Err(format!(
                "浏览器未能正确加载导出页面，已中止导出。预检输出未找到导出标记。stderr: {}",
                summarize_browser_stderr(&preflight_output.stderr)
            ));
        }

        let page_num = page_count.max(1);
        let height = 1123 * page_num;

        let screenshot_output = {
            let mut args = base_args;
            args.push(OsString::from("--force-device-scale-factor=2"));
            args.push(OsString::from(format!("--window-size=794,{}", height)));
            args.push(OsString::from(format!("--screenshot={}", output_path)));
            args.push(session_paths.html_path.clone().into_os_string());

            Command::new(&browser_path)
                .args(&args)
                .output()
                .map_err(|e| format!("浏览器启动失败 ({}): {}", browser_path, e))?
        };

        if !screenshot_output.status.success() {
            return Err(format!(
                "浏览器导出图片错误: {}",
                summarize_browser_stderr(&screenshot_output.stderr)
            ));
        }

        let img_metadata = fs::metadata(out_path)
            .map_err(|e| format!("浏览器导出完成，但未找到图片文件: {}", e))?;
        if img_metadata.len() == 0 {
            return Err("浏览器导出完成，但生成的图片文件为空。".into());
        }

        Ok(())
    })();

    cleanup_export_session(&session_paths);
    export_result
}

