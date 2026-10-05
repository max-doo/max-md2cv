use base64::{engine::general_purpose::STANDARD as BASE64_STANDARD, Engine as _};
use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};
use tauri_plugin_opener::OpenerExt;

#[derive(Serialize)]
pub struct FileEntry {
    pub name: String,
    pub path: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImageEntry {
    pub name: String,
    pub path: String,
    pub is_id_photo: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportFileEntry {
    pub name: String,
    pub path: String,
    pub file_type: String,
}

const IMAGE_EXTENSIONS: [&str; 6] = ["png", "jpg", "jpeg", "webp", "bmp", "gif"];

fn list_files_by_extension(dir_path: &str, extension: &str) -> Result<Vec<FileEntry>, String> {
    let mut files = Vec::new();
    let entries = fs::read_dir(dir_path).map_err(|e| e.to_string())?;

    for entry in entries.flatten() {
        if let Ok(file_type) = entry.file_type() {
            if !file_type.is_file() {
                continue;
            }

            let path = entry.path();
            let matches_extension = path
                .extension()
                .and_then(|ext| ext.to_str())
                .map(|ext| ext.eq_ignore_ascii_case(extension))
                .unwrap_or(false);

            if matches_extension {
                files.push(FileEntry {
                    name: entry.file_name().to_string_lossy().to_string(),
                    path: path.to_string_lossy().to_string(),
                });
            }
        }
    }

    files.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    Ok(files)
}

fn is_image_extension(extension: &str) -> bool {
    IMAGE_EXTENSIONS
        .iter()
        .any(|allowed| allowed.eq_ignore_ascii_case(extension))
}

fn is_image_path(path: &Path) -> bool {
    path.extension()
        .and_then(|ext| ext.to_str())
        .map(is_image_extension)
        .unwrap_or(false)
}

pub(crate) fn is_workspace_asset_path(path: &Path) -> bool {
    let extension = path
        .extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| ext.to_ascii_lowercase());

    match extension.as_deref() {
        Some("md") | Some("pdf") => true,
        Some(ext) => is_image_extension(ext),
        None => false,
    }
}

fn is_id_photo_name(file_name: &str) -> bool {
    let stem = Path::new(file_name)
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase();

    if stem == "idphoto" {
        return true;
    }

    stem.strip_prefix("idphoto-")
        .map(|suffix| !suffix.is_empty() && suffix.chars().all(|ch| ch.is_ascii_digit()))
        .unwrap_or(false)
}

fn image_entry_from_path(path: &Path) -> ImageEntry {
    let name = path
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_string();

    ImageEntry {
        is_id_photo: is_id_photo_name(&name),
        name,
        path: path.to_string_lossy().to_string(),
    }
}

fn build_unique_id_photo_path(workspace_path: &Path, extension: &str) -> PathBuf {
    let normalized_ext = extension.to_ascii_lowercase();
    let mut counter = 1usize;

    loop {
        let file_name = if counter == 1 {
            format!("IDphoto.{}", normalized_ext)
        } else {
            format!("IDphoto-{}.{}", counter, normalized_ext)
        };
        let target = workspace_path.join(file_name);
        if !target.exists() {
            return target;
        }
        counter += 1;
    }
}

fn mime_type_for_extension(extension: &str) -> &'static str {
    match extension.to_ascii_lowercase().as_str() {
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "webp" => "image/webp",
        "bmp" => "image/bmp",
        "gif" => "image/gif",
        _ => "application/octet-stream",
    }
}

#[tauri::command]
pub async fn list_resumes(dir_path: String) -> Result<Vec<FileEntry>, String> {
    list_files_by_extension(&dir_path, "md")
}

#[tauri::command]
pub async fn list_pdfs(dir_path: String) -> Result<Vec<FileEntry>, String> {
    list_files_by_extension(&dir_path, "pdf")
}

#[tauri::command]
pub async fn list_images(dir_path: String) -> Result<Vec<ImageEntry>, String> {
    let mut files = Vec::new();
    let entries = fs::read_dir(dir_path).map_err(|e| e.to_string())?;

    for entry in entries.flatten() {
        if let Ok(file_type) = entry.file_type() {
            if !file_type.is_file() {
                continue;
            }

            let path = entry.path();
            if is_image_path(&path) {
                files.push(image_entry_from_path(&path));
            }
        }
    }

    files.sort_by(|a, b| {
        b.is_id_photo
            .cmp(&a.is_id_photo)
            .then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase()))
    });

    Ok(files)
}

#[tauri::command]
pub async fn read_image_as_data_url(path: String) -> Result<String, String> {
    let file_path = Path::new(&path);
    if !file_path.exists() {
        return Err("图片文件不存在".into());
    }

    if !is_image_path(file_path) {
        return Err("仅支持读取图片文件".into());
    }

    let bytes = fs::read(file_path).map_err(|e| e.to_string())?;
    let extension = file_path
        .extension()
        .and_then(|ext| ext.to_str())
        .unwrap_or_default();
    let mime_type = mime_type_for_extension(extension);
    let encoded = BASE64_STANDARD.encode(bytes);

    Ok(format!("data:{};base64,{}", mime_type, encoded))
}

#[tauri::command]
pub async fn import_id_photo(
    source_path: String,
    workspace_path: String,
) -> Result<ImageEntry, String> {
    let source = Path::new(&source_path);
    let workspace = Path::new(&workspace_path);

    if !workspace.exists() {
        return Err("当前工作文件夹不存在".into());
    }

    if !source.exists() {
        return Err("所选图片不存在".into());
    }

    if !is_image_path(source) {
        return Err("仅支持 PNG、JPG、JPEG、WEBP、BMP、GIF 图片".into());
    }

    let extension = source
        .extension()
        .and_then(|ext| ext.to_str())
        .ok_or_else(|| "图片缺少扩展名".to_string())?;

    let target_path = build_unique_id_photo_path(workspace, extension);
    fs::copy(source, &target_path).map_err(|e| e.to_string())?;

    Ok(image_entry_from_path(&target_path))
}

#[tauri::command]
pub async fn read_resume(path: String) -> Result<String, String> {
    fs::read_to_string(path).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn write_resume(path: String, content: String) -> Result<(), String> {
    fs::write(path, content).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn path_exists(path: String) -> Result<bool, String> {
    Ok(Path::new(&path).exists())
}

#[tauri::command]
pub async fn delete_resume(path: String) -> Result<(), String> {
    trash::delete(path).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn rename_resume(old_path: String, new_path: String) -> Result<(), String> {
    fs::rename(old_path, new_path).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn rename_pdf(old_path: String, new_path: String) -> Result<(), String> {
    let old_file = Path::new(&old_path);
    let new_file = Path::new(&new_path);

    let is_old_pdf = old_file
        .extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| ext.eq_ignore_ascii_case("pdf"))
        .unwrap_or(false);

    let is_new_pdf = new_file
        .extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| ext.eq_ignore_ascii_case("pdf"))
        .unwrap_or(false);

    if !is_old_pdf || !is_new_pdf {
        return Err("仅支持重命名 PDF 文件".into());
    }

    fs::rename(old_path, new_path).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn duplicate_resume(path: String, new_path: String) -> Result<(), String> {
    fs::copy(path, new_path).map_err(|e| e.to_string()).map(|_| ())
}

#[tauri::command]
pub async fn duplicate_pdf(path: String, new_path: String) -> Result<(), String> {
    let old_file = Path::new(&path);
    let new_file = Path::new(&new_path);

    let is_old_pdf = old_file
        .extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| ext.eq_ignore_ascii_case("pdf"))
        .unwrap_or(false);

    let is_new_pdf = new_file
        .extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| ext.eq_ignore_ascii_case("pdf"))
        .unwrap_or(false);

    if !is_old_pdf || !is_new_pdf {
        return Err("仅支持复制 PDF 文件".into());
    }

    fs::copy(path, new_path).map_err(|e| e.to_string()).map(|_| ())
}

#[tauri::command]
pub async fn open_pdf(app: tauri::AppHandle, path: String) -> Result<(), String> {
    let file_path = Path::new(&path);

    if !file_path.exists() {
        return Err("PDF 文件不存在".into());
    }

    let is_pdf = file_path
        .extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| ext.eq_ignore_ascii_case("pdf"))
        .unwrap_or(false);

    if !is_pdf {
        return Err("只允许打开 PDF 文件".into());
    }

    app.opener()
        .open_path(&path, None::<&str>)
        .map_err(|e| format!("打开 PDF 失败: {}", e))
}

#[tauri::command]
pub async fn open_directory(app: tauri::AppHandle, path: String) -> Result<(), String> {
    let dir_path = Path::new(&path);

    if !dir_path.exists() {
        return Err("Directory does not exist".into());
    }

    if !dir_path.is_dir() {
        return Err("Path is not a directory".into());
    }

    app.opener()
        .open_path(&path, None::<&str>)
        .map_err(|e| format!("Failed to open directory: {}", e))
}

#[tauri::command]
pub async fn list_export_files(dir_path: String) -> Result<Vec<ExportFileEntry>, String> {
    let mut files = Vec::new();
    let entries = fs::read_dir(dir_path).map_err(|e| e.to_string())?;

    for entry in entries.flatten() {
        if let Ok(file_type) = entry.file_type() {
            if !file_type.is_file() {
                continue;
            }

            let path = entry.path();
            let name = entry.file_name().to_string_lossy().to_string();

            let extension = path
                .extension()
                .and_then(|ext| ext.to_str())
                .unwrap_or_default();

            if extension.eq_ignore_ascii_case("pdf") {
                files.push(ExportFileEntry {
                    name,
                    path: path.to_string_lossy().to_string(),
                    file_type: "pdf".to_string(),
                });
            } else if is_image_extension(extension) && !is_id_photo_name(&name) {
                files.push(ExportFileEntry {
                    name,
                    path: path.to_string_lossy().to_string(),
                    file_type: "image".to_string(),
                });
            }
        }
    }

    files.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    Ok(files)
}

#[tauri::command]
pub async fn open_exported_file(app: tauri::AppHandle, path: String) -> Result<(), String> {
    let file_path = Path::new(&path);

    if !file_path.exists() {
        return Err("文件不存在".into());
    }

    let is_valid = file_path
        .extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| ext.eq_ignore_ascii_case("pdf") || is_image_extension(ext))
        .unwrap_or(false);

    if !is_valid {
        return Err("仅支持打开 PDF 或图片文件".into());
    }

    app.opener()
        .open_path(&path, None::<&str>)
        .map_err(|e| format!("打开文件失败: {}", e))
}

#[tauri::command]
pub async fn rename_export_file(old_path: String, new_path: String) -> Result<(), String> {
    let old_file = Path::new(&old_path);
    let new_file = Path::new(&new_path);

    let old_ext = old_file.extension().and_then(|ext| ext.to_str()).unwrap_or_default();
    let new_ext = new_file.extension().and_then(|ext| ext.to_str()).unwrap_or_default();

    if !old_ext.eq_ignore_ascii_case(new_ext) {
        return Err("文件扩展名必须保持一致".into());
    }

    let is_valid = old_ext.eq_ignore_ascii_case("pdf") || is_image_extension(old_ext);
    if !is_valid {
        return Err("仅支持重命名 PDF 或图片文件".into());
    }

    fs::rename(old_path, new_path).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn duplicate_export_file(path: String, new_path: String) -> Result<(), String> {
    let old_file = Path::new(&path);
    let new_file = Path::new(&new_path);

    let old_ext = old_file.extension().and_then(|ext| ext.to_str()).unwrap_or_default();
    let new_ext = new_file.extension().and_then(|ext| ext.to_str()).unwrap_or_default();

    if !old_ext.eq_ignore_ascii_case(new_ext) {
        return Err("文件扩展名必须保持一致".into());
    }

    let is_valid = old_ext.eq_ignore_ascii_case("pdf") || is_image_extension(old_ext);
    if !is_valid {
        return Err("仅支持复制 PDF 或图片文件".into());
    }

    fs::copy(path, new_path).map_err(|e| e.to_string()).map(|_| ())
}

#[tauri::command]
pub async fn open_external_url(app: tauri::AppHandle, url: String) -> Result<(), String> {
    let parsed = tauri::Url::parse(&url).map_err(|e| format!("无效的 URL: {}", e))?;
    let scheme = parsed.scheme();
    if scheme != "http" && scheme != "https" && scheme != "mailto" && scheme != "tel" {
        return Err("不支持的链接协议".into());
    }
    app.opener()
        .open_url(&url, None::<&str>)
        .map_err(|e| format!("打开链接失败: {}", e))
}

