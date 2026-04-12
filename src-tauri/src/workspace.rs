use crate::files::is_workspace_asset_path;
use notify::{recommended_watcher, Event, RecommendedWatcher, RecursiveMode, Watcher};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::{BTreeMap, BTreeSet};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use tauri::{Emitter, State};

const RENDER_STATE_FILE_NAME: &str = ".max-md2cv.render-state.json";

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceChangedEvent {
    pub workspace_path: String,
    pub paths: Vec<String>,
}

#[derive(Default)]
pub struct WorkspaceWatchState {
    inner: Mutex<Option<WorkspaceWatcherHandle>>,
}

struct WorkspaceWatcherHandle {
    workspace_path: String,
    _watcher: RecommendedWatcher,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct ResumeRenderProfile {
    template_id: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    values: Option<Value>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    style: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    photo_path: Option<String>,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceRenderState {
    version: u32,
    files: BTreeMap<String, ResumeRenderProfile>,
}

impl Default for WorkspaceRenderState {
    fn default() -> Self {
        Self {
            version: 2,
            files: BTreeMap::new(),
        }
    }
}

fn relevant_workspace_paths(event: &Event) -> Vec<String> {
    let mut paths = BTreeSet::new();

    for path in &event.paths {
        if is_workspace_asset_path(path) {
            paths.insert(path.to_string_lossy().to_string());
        }
    }

    paths.into_iter().collect()
}

fn workspace_render_state_path(workspace_path: &str) -> PathBuf {
    Path::new(workspace_path).join(RENDER_STATE_FILE_NAME)
}

#[tauri::command]
pub async fn read_workspace_render_state(
    workspace_path: String,
) -> Result<WorkspaceRenderState, String> {
    let file_path = workspace_render_state_path(&workspace_path);

    if !file_path.exists() {
        return Ok(WorkspaceRenderState::default());
    }

    let content = fs::read_to_string(&file_path)
        .map_err(|e| format!("Failed to read render state {:?}: {}", file_path, e))?;

    serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse render state {:?}: {}", file_path, e))
}

#[tauri::command]
pub async fn write_workspace_render_state(
    workspace_path: String,
    state: WorkspaceRenderState,
) -> Result<(), String> {
    let workspace_dir = Path::new(&workspace_path);

    if !workspace_dir.exists() {
        return Err("Workspace directory does not exist".into());
    }

    if !workspace_dir.is_dir() {
        return Err("Workspace path is not a directory".into());
    }

    let file_path = workspace_render_state_path(&workspace_path);
    let content = serde_json::to_string_pretty(&state)
        .map_err(|e| format!("Failed to serialize render state: {}", e))?;

    fs::write(&file_path, content)
        .map_err(|e| format!("Failed to write render state {:?}: {}", file_path, e))
}

#[tauri::command]
pub async fn set_workspace_watch(
    app: tauri::AppHandle,
    state: State<'_, WorkspaceWatchState>,
    dir_path: Option<String>,
) -> Result<(), String> {
    let mut guard = state
        .inner
        .lock()
        .map_err(|_| "Failed to lock workspace watcher state".to_string())?;

    if let (Some(next_path), Some(existing)) = (dir_path.as_ref(), guard.as_ref()) {
        if existing.workspace_path == *next_path {
            return Ok(());
        }
    }

    *guard = None;

    let Some(dir_path) = dir_path else {
        return Ok(());
    };

    let workspace_path = PathBuf::from(&dir_path);
    if !workspace_path.exists() {
        return Err("Workspace directory does not exist".into());
    }

    if !workspace_path.is_dir() {
        return Err("Workspace path is not a directory".into());
    }

    let app_handle = app.clone();
    let watched_workspace = dir_path.clone();
    let mut watcher =
        recommended_watcher(move |result: notify::Result<Event>| match result {
            Ok(event) => {
                let paths = relevant_workspace_paths(&event);
                if paths.is_empty() {
                    return;
                }

                let payload = WorkspaceChangedEvent {
                    workspace_path: watched_workspace.clone(),
                    paths,
                };

                if let Err(error) = app_handle.emit("workspace-changed", payload) {
                    eprintln!("Failed to emit workspace-changed event: {}", error);
                }
            }
            Err(error) => {
                eprintln!("Workspace watcher error: {}", error);
            }
        })
        .map_err(|e| format!("Failed to create workspace watcher: {}", e))?;

    watcher
        .watch(&workspace_path, RecursiveMode::NonRecursive)
        .map_err(|e| format!("Failed to watch workspace directory {:?}: {}", workspace_path, e))?;

    *guard = Some(WorkspaceWatcherHandle {
        workspace_path: dir_path,
        _watcher: watcher,
    });

    Ok(())
}
