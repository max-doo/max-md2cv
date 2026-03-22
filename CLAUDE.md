# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Commands

- **Development**:
  - `npm run tauri dev` – Start Tauri development mode (both frontend Vite server and Rust backend). This is the primary development command.
  - `npm run dev` – Start only the Vite frontend development server on port 1420 (useful when working on pure UI without Rust changes).
  - `npm run preview` – Preview the built frontend.

- **Building**:
  - `npm run build` – Build the frontend only (runs `vue-tsc --noEmit && vite build`).
  - `npm run tauri build` – Build the production desktop package. Outputs to `src-tauri/target/release/bundle/`.

- **Code quality**:
  - TypeScript checks are integrated into the build process via `vue-tsc`. There is no separate lint script.

## High‑Level Architecture

Max‑MD2CV is a Tauri‑based desktop application that converts Markdown resumes to PDF through a **“Soft Minimalist”** design system.

### 1. Core Stack
- **Backend**: Rust (Tauri 2) – provides file‑system operations, template management, and PDF export via headless Chrome/Edge.
- **Frontend**: Vue 3 + TypeScript + Vite – UI layer with CodeMirror 6 (editor) and Paged.js (print‑ready preview).
- **Styling**: Tailwind CSS v4 with a completely custom theme that implements the “No‑Line Rule” and ambient shadows. Theme variables are defined in `src/assets/tailwind.css`.
- **UI Components**: Element Plus is used sparingly for complex dialogs/notifications; its appearance is overridden to match the design system (see the `:root` overrides in `tailwind.css`).

### 2. State Management
A single Pinia store (`src/stores/resume.ts`) holds all application state:
- `markdownContent` – the Markdown text being edited.
- `workspacePath` / `fileList` / `activeFilePath` – file‑browser state.
- `availableTemplates` / `activeTemplate` – CSS templates loaded from the backend.
- `resumeStyle` – user‑adjustable typography and layout settings (font sizes, margins, theme color).
- `photoBase64` – optional portrait image.

The store also provides methods for all file operations (open, save, delete, rename, duplicate) and template management. File I/O **always** goes through Tauri commands; no direct `fetch` or `fs` calls in the frontend.

### 3. Rust Backend (Tauri Commands)
Key commands in `src‑tauri/src/lib.rs`:
- `list_templates`, `save_template` – manage built‑in and user‑custom CSS templates.
- `list_resumes`, `read_resume`, `write_resume`, `delete_resume`, `rename_resume`, `duplicate_resume` – file CRUD operations.
- `export_pdf_command` – invokes a headless Chromium browser (Edge/Chrome) to print the HTML to a PDF file.

PDF export writes a temporary HTML file and runs the browser with `--headless=new --print‑to‑pdf=...`. The browser is located via the Windows Registry (on Windows) or standard installation paths.

### 4. Frontend Component Structure
- `App.vue` – root layout; shows a workspace‑selection overlay when no workspace is set.
- `Sidebar.vue` – left‑hand file browser (lists `.md` files in the workspace, allows creating/deleting/renaming).
- `EditorPane.vue` – CodeMirror 6 Markdown editor with syntax highlighting.
- `PreviewPane.vue` – renders the Markdown as HTML, applies the active template CSS, and uses Paged.js to simulate A4 page breaks.
- `TopNavBar.vue` – contains export button, template selector, and style controls that modify the `resumeStyle` store.

### 5. Template System
CSS templates are stored in two locations:
1. **Built‑in templates** – bundled as resources (`src‑tauri/tauri.conf.json` maps `../src/assets/templates/*.css` to `templates/`).
2. **User templates** – saved in the OS‑specific app‑data directory (`AppData/templates` on Windows). User templates override built‑in ones with the same ID.

Each template is a CSS file that can contain metadata comments (`/* @name: Modern Resume */`). The store’s `saveCurrentTemplate` method merges the current `resumeStyle` settings into the active template by appending CSS after a `/* @user‑overrides */` marker.

### 6. Design System Principles
- **No‑Line Rule** – avoid 1px borders; use background‑color layers (`surface`, `surface‑container‑low`, etc.) to separate visual areas.
- **Ambient Shadows** – soft, coloured shadows (`--shadow‑ambient`) with a tint of the primary color (`#4c49cc`).
- **Typography** – the Manrope font family is loaded via Google Fonts in `index.html`.
- **Element Plus Overrides** – all Element Plus components are restyled to match the design system (borders removed, colors mapped to design‑system variables).

### 7. Workspace & File Management
The user selects a local folder as a workspace. The application remembers the last workspace and the last opened file in `localStorage`. All `.md` files inside that folder are listed in the sidebar. Auto‑save is not implemented; the user must manually save (Ctrl+S is hooked in the editor).

## Notes for Development
- When adding new Tauri commands, ensure they are added to the `invoke_handler!` macro in `lib.rs` and called from the frontend via `invoke`.
- The frontend uses `unplugin‑auto‑import` and `unplugin‑vue‑components` – Vue APIs and Element Plus components can be used without explicit imports.
- Tailwind classes are based on the custom theme variables; refer to `src/assets/tailwind.css` for available color/radius/shadow utilities.
- PDF export requires a Chromium‑based browser (Edge or Chrome) installed on the system; the Rust backend will attempt to locate it automatically.
- The project already contains VS Code extension recommendations (Volar, Tauri, rust‑analyzer) in `.vscode/extensions.json`.