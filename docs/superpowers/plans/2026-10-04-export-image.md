# 导出图片功能与产物隔离实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 增加简历导出为高清图片功能，以次级按钮形式置于“导出为 PDF”之后，产物保存在当前工作区；同时重构侧边栏，将“PDF”标签升级为包含 PDF 和图片的“导出”产物标签，并严格过滤隔离证件照页面。

**Architecture:** 
1. 后端（Rust/Tauri）通过系统 Chromium/Edge 无头浏览器根据实际页数计算尺寸实施 2x 视网膜高清截图（`export_image_command`），并提供统一打开与管理导出文件的命令；
2. 数据层（Pinia）建立 `exportFileList`，`photos` 模块过滤排除非证件照，彻底避免简历图片误入证件照展示；
3. 前端（Vue 3 / Tailwind）在导航栏提供 `.btn-secondary` 次级按钮“导出图片”，侧边栏升级原 PDF 列表为“导出”综合产物管理。

**Tech Stack:** Tauri v2, Rust, Vue 3, TypeScript, Tailwind CSS v4, Edge/Chromium Headless.

---

### Task 1: 后端实现导出图片与导出文件管理命令

**Files:**
- Modify: `src-tauri/src/export.rs`
- Modify: `src-tauri/src/files.rs`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: 在 `src-tauri/src/export.rs` 中实现 `export_image_command`**
  - 支持计算页面总高度 `1123 * page_count`
  - 使用 `--force-device-scale-factor=2` 与 `--screenshot` 参数
  - 检查文件生成状态并返回错误处理

- [ ] **Step 2: 在 `src-tauri/src/files.rs` 中实现 `list_export_files`、`open_exported_file`、`rename_export_file`、`duplicate_export_file`**
  - `list_export_files` 扫描 `.pdf` 以及非 `IDphoto` 的图片
  - `open_exported_file` 支持系统关联程序打开 PDF 和图片
  - 支持导出文件的重命名和副本创建

- [ ] **Step 3: 在 `src-tauri/src/lib.rs` 注册新增命令并编译检查**
  - 注册 `export_image_command`, `list_export_files`, `open_exported_file`, `rename_export_file`, `duplicate_export_file`
  - 运行 `cargo check` 确保无编译错误

---

### Task 2: 数据层扩展与证件照隔离

**Files:**
- Modify: `src/stores/resume/types.ts`
- Modify: `src/stores/resume/context.ts`
- Modify: `src/stores/resume/modules/photos.ts`
- Modify: `src/stores/resume/modules/workspace-files.ts`
- Modify: `src/stores/resume/modules/export.ts`
- Modify: `src/stores/resume/index.ts`

- [ ] **Step 1: 更新类型定义与状态**
  - 在 `types.ts` 中增加 `ExportFileItem`
  - 在 `context.ts` 中增加 `exportFileList` 和 `isExportingImage`

- [ ] **Step 2: 隔离证件照与导出图片**
  - 在 `photos.ts` 中过滤 `state.photoFileList`，仅保留 `entry.isIdPhoto`，彻底排除导出的简历图片

- [ ] **Step 3: 扩展工作区导出文件管理**
  - 在 `workspace-files.ts` 中实现 `refreshExportList`, `deleteExportFile`, `renameExportFile`, `duplicateExportFile`
  - 联动 `workspace-watch` 文件变化时自动刷新

- [ ] **Step 4: 实现 `exportCurrentImage`**
  - 在 `export.ts` 中生成 PagedJS 视图 HTML，调用 `export_image_command`，处理成功/失败与覆盖确认
  - 导出完成后自动刷新 `refreshExportList`

---

### Task 3: 前端 UI 与样式实现

**Files:**
- Modify: `packages/resume-core/src/styles/theme.css`
- Modify: `src/components/TopNavBar.vue`
- Modify: `src/components/sidebar/ResumeLibraryPanel.vue`

- [ ] **Step 1: 在 `theme.css` 中添加 `.btn-secondary` 样式类**
  - 柔和极简设计，胶囊圆角，无硬边框

- [ ] **Step 2: 在 `TopNavBar.vue` 中添加“导出图片”次级按钮**
  - 位于“导出为 PDF”按钮之后，绑定 `exportCurrentImage` 与独立加载态

- [ ] **Step 3: 升级 `ResumeLibraryPanel.vue` 侧边栏列表**
  - 将原“PDF”标签页升级为“导出”
  - 展示 `exportFileList`，区分 PDF（红色图标）与图片（主题色图标）
  - 支持双击重命名、右键菜单（复制、重命名、删除）、点击调用 `open_exported_file`
  - 证件照 Tab 只展示证件照，保持网格整洁

---

### Task 4: 编译检查与功能验证

**Files:**
- Modify: `README.md` (记录功能重大新增)

- [ ] **Step 1: 执行类型检查与构建测试**
  - `cargo check --manifest-path src-tauri/Cargo.toml`
  - `npm run build`
- [ ] **Step 2: 更新 README.md 说明**
- [ ] **Step 3: 验证端到端交互链路正常**
