use serde::Serialize;
use serde_json::Value;
use std::fs;
use std::path::Path;
use tauri::Manager;

#[derive(Serialize, Clone)]
pub struct TemplateInfo {
    pub id: String,
    pub name: String,
    pub css: String,
    pub manifest: Option<Value>,
}

/// Scan built-in resource templates and user-custom templates from appDataDir.
/// User templates take precedence over built-ins with the same id.
#[tauri::command]
pub async fn list_templates(app: tauri::AppHandle) -> Result<Vec<TemplateInfo>, String> {
    let mut templates: Vec<TemplateInfo> = Vec::new();

    let resource_dir = app
        .path()
        .resource_dir()
        .map_err(|e| format!("Failed to get resource dir: {}", e))?;
    let builtin_path = resource_dir.join("templates");
    if builtin_path.exists() {
        load_templates_from_dir(&builtin_path, &mut templates)?;
    }

    if let Ok(manifest_dir) = std::env::var("CARGO_MANIFEST_DIR") {
        let dev_source_path = Path::new(&manifest_dir)
            .parent()
            .map(|root| root.join("src").join("assets").join("templates"));
        if let Some(dev_path) = dev_source_path {
            if dev_path.exists() {
                load_templates_overriding(&dev_path, &mut templates)?;
            }
        }
    }

    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;
    let user_path = app_data_dir.join("templates");
    if !user_path.exists() {
        let _ = fs::create_dir_all(&user_path);
    }
    if user_path.exists() {
        load_templates_overriding(&user_path, &mut templates)?;
    }

    Ok(templates)
}

/// Write (or overwrite) a legacy template CSS file in the user's AppData/templates directory.
#[tauri::command]
pub async fn save_template(
    app: tauri::AppHandle,
    id: String,
    css: String,
    manifest: Option<Value>,
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

    if let Some(manifest_value) = manifest {
        let legacy_file_path = user_path.join(format!("{}.css", id));
        if legacy_file_path.exists() {
            fs::remove_file(&legacy_file_path).map_err(|e| {
                format!(
                    "Failed to remove legacy template file {:?}: {}",
                    legacy_file_path, e
                )
            })?;
        }

        let template_dir = user_path.join(&id);
        if !template_dir.exists() {
            fs::create_dir_all(&template_dir)
                .map_err(|e| format!("Failed to create template dir {:?}: {}", template_dir, e))?;
        }

        let css_path = template_dir.join("template.css");
        fs::write(&css_path, &css)
            .map_err(|e| format!("Failed to write template {:?}: {}", css_path, e))?;

        let manifest_path = template_dir.join("manifest.json");
        let manifest_content = serde_json::to_string_pretty(&manifest_value)
            .map_err(|e| format!("Failed to serialize manifest {:?}: {}", manifest_path, e))?;
        fs::write(&manifest_path, manifest_content)
            .map_err(|e| format!("Failed to write manifest {:?}: {}", manifest_path, e))?;
    } else {
        let file_path = user_path.join(format!("{}.css", id));
        fs::write(&file_path, &css)
            .map_err(|e| format!("Failed to write template {:?}: {}", file_path, e))?;
    }

    Ok(())
}

fn load_templates_from_dir(dir: &Path, templates: &mut Vec<TemplateInfo>) -> Result<(), String> {
    load_templates(dir, templates, false)
}

/// Same as `load_templates_from_dir` but user entries *replace* any existing entry with the same id.
fn load_templates_overriding(
    dir: &Path,
    templates: &mut Vec<TemplateInfo>,
) -> Result<(), String> {
    load_templates(dir, templates, true)
}

fn load_templates(
    dir: &Path,
    templates: &mut Vec<TemplateInfo>,
    override_existing: bool,
) -> Result<(), String> {
    let entries = fs::read_dir(dir).map_err(|e| format!("Failed to read dir {:?}: {}", dir, e))?;

    for entry in entries.flatten() {
        let path = entry.path();

        let template = if path.is_dir() {
            read_directory_template(&path)?
        } else if path.extension().and_then(|e| e.to_str()) == Some("css") {
            Some(read_legacy_css_template(&path)?)
        } else {
            None
        };

        if let Some(template) = template {
            insert_template(templates, template, override_existing);
        }
    }

    Ok(())
}

fn insert_template(
    templates: &mut Vec<TemplateInfo>,
    template: TemplateInfo,
    override_existing: bool,
) {
    if override_existing {
        templates.retain(|item| item.id != template.id);
        templates.push(template);
        return;
    }

    if !templates.iter().any(|item| item.id == template.id) {
        templates.push(template);
    }
}

fn read_legacy_css_template(path: &Path) -> Result<TemplateInfo, String> {
    let css_content =
        fs::read_to_string(path).map_err(|e| format!("Failed to read {:?}: {}", path, e))?;
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

    Ok(TemplateInfo {
        id,
        name,
        css: css_content,
        manifest: None,
    })
}

fn read_directory_template(path: &Path) -> Result<Option<TemplateInfo>, String> {
    let css_path = path.join("template.css");
    if !css_path.exists() {
        return Ok(None);
    }

    let css_content = fs::read_to_string(&css_path)
        .map_err(|e| format!("Failed to read {:?}: {}", css_path, e))?;
    let manifest_path = path.join("manifest.json");
    let manifest = if manifest_path.exists() {
        Some(read_template_manifest(&manifest_path)?)
    } else {
        None
    };
    let name = extract_meta(&css_content, "name").unwrap_or_else(|| {
        path.file_name()
            .and_then(|s| s.to_str())
            .unwrap_or("unknown")
            .to_string()
    });
    let id = path
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or("unknown")
        .to_string();

    Ok(Some(TemplateInfo {
        id,
        name,
        css: css_content,
        manifest,
    }))
}

fn read_template_manifest(path: &Path) -> Result<Value, String> {
    let manifest_content =
        fs::read_to_string(path).map_err(|e| format!("Failed to read {:?}: {}", path, e))?;
    serde_json::from_str::<Value>(&manifest_content)
        .map_err(|e| format!("Failed to parse manifest {:?}: {}", path, e))
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
