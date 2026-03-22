// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/

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
    
    // 2. Determine browser executable
    let browser_cmd = if cfg!(target_os = "windows") {
        "msedge" // Edge is Chromium-based and built-in on Windows
    } else if cfg!(target_os = "macos") {
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
    } else {
        "google-chrome"
    };
    
    // 3. Execute headless print
    let output = Command::new(browser_cmd)
        .arg("--headless=new")
        .arg("--disable-gpu")
        .arg("--no-pdf-header-footer")
        .arg(format!("--print-to-pdf={}", output_path))
        .arg(temp_html_path.to_str().unwrap_or_default())
        .output()
        .map_err(|e| format!("Failed to execute browser: {}", e))?;
        
    if !output.status.success() {
        let err_msg = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Browser error: {}", err_msg));
    }
    
    // Clean up temp file
    let _ = std::fs::remove_file(temp_html_path);
    
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![export_pdf_command])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
