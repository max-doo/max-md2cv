mod export;
mod files;
mod templates;
mod workspace;

use export::{export_image_command, export_pdf_command};
use files::{
    delete_resume, duplicate_export_file, duplicate_pdf, duplicate_resume, import_id_photo,
    list_export_files, list_images, list_pdfs, list_resumes, open_directory, open_exported_file,
    open_external_url, open_pdf, path_exists, read_image_as_data_url, read_resume,
    rename_export_file, rename_pdf, rename_resume, write_resume,
};
use templates::{list_templates, save_template_package};
use workspace::{
    read_workspace_render_state, set_workspace_watch, write_workspace_render_state,
    WorkspaceWatchState,
};

use tauri_plugin_opener::OpenerExt;

fn external_link_plugin<R: tauri::Runtime>() -> tauri::plugin::TauriPlugin<R> {
    tauri::plugin::Builder::new("external-link-guard")
        .on_navigation(|webview, url| {
            let scheme = url.scheme();
            if scheme == "http" || scheme == "https" || scheme == "mailto" || scheme == "tel" {
                let host = url.host_str().unwrap_or_default();
                if host != "localhost" && host != "127.0.0.1" && host != "tauri.localhost" {
                    let _ = webview.opener().open_url(url.as_str(), None::<&str>);
                    return false;
                }
            }
            true
        })
        .build()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_persisted_scope::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(external_link_plugin())
        .manage(WorkspaceWatchState::default())
        .invoke_handler(tauri::generate_handler![
            export_pdf_command,
            export_image_command,
            list_templates,
            save_template_package,
            list_resumes,
            list_pdfs,
            list_export_files,
            list_images,
            read_image_as_data_url,
            import_id_photo,
            read_workspace_render_state,
            read_resume,
            write_workspace_render_state,
            write_resume,
            path_exists,
            delete_resume,
            rename_resume,
            rename_pdf,
            rename_export_file,
            duplicate_resume,
            duplicate_pdf,
            duplicate_export_file,
            open_pdf,
            open_exported_file,
            open_directory,
            open_external_url,
            set_workspace_watch
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
