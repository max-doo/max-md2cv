# AGENTS.md

This file defines project rules for agents working in this repository.

## Scope
- These rules apply to the whole repository unless a more specific rule file overrides them.
- Prefer explicit, minimal changes that fit the current architecture instead of introducing new patterns.

## Project Overview
- This is a Tauri v2 desktop application for converting Markdown resumes to PDF.
- The frontend stack is Vue 3 + TypeScript + Vite.
- The backend stack is Rust via Tauri commands.
- The UI follows a Soft Minimalist design system.

## Core Architecture
- File I/O must go through Tauri commands. Do not add direct filesystem access in the frontend.
- Application state belongs in the Pinia store under `src/stores`. Keep Vue components focused on presentation and local UI state.
- When adding a new Tauri command, update both the Rust implementation and the `invoke_handler!` registration in `src-tauri/src/lib.rs`.
- Keep PDF export aligned with the current browser-based print flow. Do not introduce a separate export path unless the task explicitly requires it.

## Frontend Rules
- Use Vue Single File Components with `<script setup lang="ts">`.
- Prefer existing patterns already used in `App.vue`, `Sidebar.vue`, `EditorPane.vue`, `PreviewPane.vue`, and `TopNavBar.vue`.
- Reuse design tokens, utilities, and component styling from `src/assets/tailwind.css` before adding new styles.
- Prefer Tailwind utilities over component-local style blocks. Add shared styles to `src/assets/tailwind.css` when reuse is likely.
- Use Element Plus sparingly. Only use it where a complex dialog, notification, or existing project pattern already depends on it.
- Do not introduce alternate state containers or ad hoc cross-component state flows when Pinia is sufficient.

## Backend Rules
- Keep backend responsibilities in Rust for filesystem access, template management, and PDF export.
- Preserve the current command boundaries between frontend and backend instead of moving logic across layers without a clear reason.
- If a feature depends on OS integration, implement it through Tauri/Rust rather than browser-only workarounds.

## Template And Styling Rules
- Built-in templates live under `src/assets/templates`.
- User template behavior must remain compatible with the current template loading and override model.
- Respect the existing `/* @user-overrides */` convention when updating template merge behavior.
- Keep the preview and export styling model consistent so preview behavior remains a useful approximation of final PDF output.

## Design System Rules
- Follow the Soft Minimalist visual direction already established in the project.
- Avoid using 1px borders as primary separators. Prefer layered surfaces, spacing, and shadows.
- Reuse existing surface, color, radius, and shadow tokens instead of inventing parallel values.
- Preserve the current typography direction and avoid casual font changes.
- When restyling Element Plus, make it conform to the project theme rather than default library appearance.

## Quality Bar
- Make the smallest change that fully solves the task.
- Avoid broad refactors unless they are required to complete the requested work safely.
- Keep naming, file placement, and component structure consistent with the surrounding code.
- If a rule conflicts with existing code, prefer the established repository pattern unless the task is explicitly about changing that pattern.

## Common Paths
- Frontend app: `src`
- Shared theme and utilities: `src/assets/tailwind.css`
- State store: `src/stores/resume.ts`
- Tauri backend: `src-tauri/src/lib.rs`
- Templates: `src/assets/templates`
