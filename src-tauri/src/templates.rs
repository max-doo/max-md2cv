use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::fs;
use std::path::Path;
use tauri::Manager;

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TemplateInfo {
    pub id: String,
    pub name: String,
    pub version: String,
    pub entry_css: String,
    pub description: Option<String>,
    pub schema_preset: Option<String>,
    pub defaults: Value,
    pub editor_schema: Value,
    pub editor_schema_overrides: Option<Value>,
    pub features: Option<Value>,
    pub layout: Option<Value>,
    pub css: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct TemplateManifestFile {
    id: String,
    name: String,
    version: Option<String>,
    entry_css: Option<String>,
    description: Option<String>,
    schema_preset: Option<String>,
    defaults: Option<Value>,
    editor_schema: Option<Value>,
    editor_schema_overrides: Option<Value>,
    features: Option<Value>,
    layout: Option<Value>,
}

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
        let dev_source_path = Path::new(&manifest_dir).parent().map(|root| {
            root.join("packages")
                .join("resume-core")
                .join("src")
                .join("assets")
                .join("templates")
        });
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

    templates.sort_by(|a, b| {
        let pos_a = BUILTIN_ORDER.iter().position(|id| *id == a.id);
        let pos_b = BUILTIN_ORDER.iter().position(|id| *id == b.id);
        match (pos_a, pos_b) {
            (Some(ia), Some(ib)) => ia.cmp(&ib),
            (Some(_), None) => std::cmp::Ordering::Less,
            (None, Some(_)) => std::cmp::Ordering::Greater,
            (None, None) => a.id.cmp(&b.id),
        }
    });

    Ok(templates)
}

#[tauri::command]
pub async fn save_template_package(
    app: tauri::AppHandle,
    template: TemplateInfo,
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

    let legacy_file_path = user_path.join(format!("{}.css", template.id));
    if legacy_file_path.exists() {
        fs::remove_file(&legacy_file_path).map_err(|e| {
            format!(
                "Failed to remove legacy template file {:?}: {}",
                legacy_file_path, e
            )
        })?;
    }

    let template_dir = user_path.join(&template.id);
    if !template_dir.exists() {
        fs::create_dir_all(&template_dir)
            .map_err(|e| format!("Failed to create template dir {:?}: {}", template_dir, e))?;
    }

    let css_path = template_dir.join("style.css");
    fs::write(&css_path, &template.css)
        .map_err(|e| format!("Failed to write template {:?}: {}", css_path, e))?;

    let manifest_path = template_dir.join("template.json");
    let mut manifest = serde_json::Map::new();
    manifest.insert("id".into(), Value::String(template.id));
    manifest.insert("name".into(), Value::String(template.name));
    manifest.insert("version".into(), Value::String(template.version));
    manifest.insert("entryCss".into(), Value::String(template.entry_css));
    manifest.insert("defaults".into(), template.defaults);

    if let Some(description) = template.description {
        manifest.insert("description".into(), Value::String(description));
    }

    if let Some(schema_preset) = template.schema_preset {
        manifest.insert("schemaPreset".into(), Value::String(schema_preset));
    } else {
        manifest.insert("editorSchema".into(), template.editor_schema);
    }

    if let Some(editor_schema_overrides) = template.editor_schema_overrides {
        manifest.insert("editorSchemaOverrides".into(), editor_schema_overrides);
    }

    if let Some(features) = template.features {
        manifest.insert("features".into(), features);
    }

    if let Some(layout) = template.layout {
        manifest.insert("layout".into(), layout);
    }

    let manifest_content = serde_json::to_string_pretty(&manifest)
        .map_err(|e| format!("Failed to serialize manifest {:?}: {}", manifest_path, e))?;
    fs::write(&manifest_path, manifest_content)
        .map_err(|e| format!("Failed to write manifest {:?}: {}", manifest_path, e))?;

    Ok(())
}

fn load_templates_from_dir(dir: &Path, templates: &mut Vec<TemplateInfo>) -> Result<(), String> {
    load_templates(dir, templates, false)
}

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
            read_template_package(&path)?
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

const BUILTIN_ORDER: [&str; 4] = ["business-block", "modern", "classic", "business"];

fn insert_template(
    templates: &mut Vec<TemplateInfo>,
    template: TemplateInfo,
    override_existing: bool,
) {
    if override_existing {
        if let Some(pos) = templates.iter().position(|item| item.id == template.id) {
            let is_builtin = BUILTIN_ORDER.contains(&template.id.as_str());
            let official_name = if is_builtin {
                templates[pos].name.clone()
            } else {
                template.name.clone()
            };
            let official_description = if is_builtin && templates[pos].description.is_some() {
                templates[pos].description.clone()
            } else {
                template.description.clone()
            };

            templates[pos] = template;
            templates[pos].name = official_name;
            templates[pos].description = official_description;
            return;
        }
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
        version: "1.0.0".to_string(),
        entry_css: "style.css".to_string(),
        description: None,
        schema_preset: None,
        defaults: Value::Object(Default::default()),
        editor_schema: Value::Array(Vec::new()),
        editor_schema_overrides: None,
        features: None,
        layout: None,
        css: css_content,
    })
}

fn read_template_package(path: &Path) -> Result<Option<TemplateInfo>, String> {
    let manifest_path = path.join("template.json");
    if !manifest_path.exists() {
        return Ok(None);
    }

    let manifest_content = fs::read_to_string(&manifest_path)
        .map_err(|e| format!("Failed to read {:?}: {}", manifest_path, e))?;
    let manifest: TemplateManifestFile = serde_json::from_str(&manifest_content)
        .map_err(|e| format!("Failed to parse manifest {:?}: {}", manifest_path, e))?;

    let entry_css = manifest.entry_css.unwrap_or_else(|| "style.css".to_string());
    let css_path = path.join(&entry_css);
    let css_content =
        fs::read_to_string(&css_path).map_err(|e| format!("Failed to read {:?}: {}", css_path, e))?;

    Ok(Some(TemplateInfo {
        id: manifest.id,
        name: manifest.name,
        version: manifest.version.unwrap_or_else(|| "1.0.0".to_string()),
        entry_css,
        description: manifest.description,
        schema_preset: manifest.schema_preset,
        defaults: manifest.defaults.unwrap_or_else(|| Value::Object(Default::default())),
        editor_schema: manifest.editor_schema.unwrap_or_else(|| Value::Array(Vec::new())),
        editor_schema_overrides: manifest.editor_schema_overrides,
        features: manifest.features,
        layout: manifest.layout,
        css: css_content,
    }))
}

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
