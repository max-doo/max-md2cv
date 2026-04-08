mod export;
mod files;
mod templates;
mod workspace;

use export::export_pdf_command;
use files::{
    delete_resume, duplicate_resume, import_id_photo, list_images, list_pdfs, list_resumes,
    open_directory, open_pdf, path_exists, read_image_as_data_url, read_resume, rename_resume,
    write_resume,
};
use templates::{list_templates, save_template_package};
use workspace::{
    read_workspace_render_state, set_workspace_watch, write_workspace_render_state,
    WorkspaceWatchState,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_persisted_scope::init())
        .plugin(tauri_plugin_opener::init())
        .manage(WorkspaceWatchState::default())
        .invoke_handler(tauri::generate_handler![
            export_pdf_command,
            list_templates,
            save_template_package,
            list_resumes,
            list_pdfs,
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
            duplicate_resume,
            open_pdf,
            open_directory,
            set_workspace_watch
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
