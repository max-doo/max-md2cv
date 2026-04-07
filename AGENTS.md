# AGENTS.md

This file defines project rules for agents working in this repository.

## Scope
- These rules apply to the whole repository unless a more specific rule file overrides them.
- Prefer explicit, minimal changes that fit the current architecture instead of introducing new patterns.

## Project Overview
- This repository is a monorepo with a Tauri v2 desktop app at the root and a separate Web app under `apps/web`.
- The frontend stack is Vue 3 + TypeScript + Vite.
- The backend stack is Rust via Tauri commands.
- The UI follows a Soft Minimalist design system.
- Shared resume/theme utilities live in `packages/resume-core`.

## Core Architecture
- Desktop file I/O must go through Tauri commands. Do not add direct filesystem access in the desktop frontend.
- Application state belongs in Pinia stores. Desktop state lives under `src/stores/resume`; Web playground state lives under `apps/web/src/stores`.
- When adding a new Tauri command, update both the Rust implementation and the `invoke_handler!` registration in `src-tauri/src/lib.rs`.
- Keep PDF export aligned with the current browser-based print flow. Do not introduce a separate export path unless the task explicitly requires it.

## Frontend Rules
- Use Vue Single File Components with `<script setup lang="ts">`.
- Prefer existing patterns already used in `App.vue`, `Sidebar.vue`, `EditorPane.vue`, `PreviewPane.vue`, and `TopNavBar.vue`.
- Reuse design tokens, utilities, and component styling from `src/assets/tailwind.css` before adding new styles.
- Prefer Tailwind utilities over component-local style blocks. Add shared styles to `src/assets/tailwind.css` when reuse is likely.
- Use Element Plus sparingly. Only use it where a complex dialog, notification, or existing project pattern already depends on it.
- Do not introduce alternate state containers or ad hoc cross-component state flows when Pinia is sufficient.
- `apps/web` reuses desktop components from root `src` through the `@desktop` alias, so shared component edits can affect both targets.
- Any Web-specific UI change must be scoped to `apps/web` or Web-only selectors/entry points and must not affect the desktop Tauri UI.

## Backend Rules
- Keep backend responsibilities in Rust for filesystem access, template management, and PDF export.
- Preserve the current command boundaries between frontend and backend instead of moving logic across layers without a clear reason.
- If a feature depends on OS integration, implement it through Tauri/Rust rather than browser-only workarounds.

## Template And Styling Rules
- Desktop template assets live under `src/assets/templates`; shared built-in templates and theme helpers also exist in `packages/resume-core/src`.
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
- Keep this `AGENTS.md` aligned with the latest project structure, architecture, and active development direction. When the project evolves, update only the necessary sections so the document does not drift from the current implementation, development plan, or delivery progress.

## Common Paths
- Desktop frontend app: `src`
- Web app: `apps/web/src`
- Shared resume core: `packages/resume-core/src`
- Shared theme and utilities: `src/assets/tailwind.css`
- Desktop store entry: `src/stores/resume.ts`
- Desktop store implementation: `src/stores/resume`
- Web store: `apps/web/src/stores`
- Tauri backend: `src-tauri/src/lib.rs`
- Desktop templates: `src/assets/templates`
