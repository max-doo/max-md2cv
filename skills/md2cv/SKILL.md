---
name: md2cv
description: Render Markdown resumes to PDF and per-page PNGs with the md2cv CLI, choose templates, tune layout values, and verify every rendered page. Use for Max-MD2CV resume export and layout-validation tasks; do not use for content-only resume writing.
---

# MD2CV resume rendering

Use this skill for Markdown-to-resume rendering, template selection, pagination checks, and layout iteration. It requires `md2cv` CLI >= 0.1.0.

1. Run `md2cv --version`. If the command is unavailable, stop and report the installation problem.
2. When the user has not named a template, run `md2cv templates list --json`. Before changing values, run `md2cv templates schema <id> --json`; treat the returned schema as the source of truth rather than guessing field names or ranges.
3. Render with `md2cv render ... --json`, using the user’s requested output paths. Parse artifact paths from JSON, not from human logs.
4. Inspect every file in the JSON `artifacts.images` array after each render. If the current Agent cannot view images, say that the images were generated but visual verification was not completed; never claim the layout is correct.
5. Use warnings, page metrics, and all page screenshots to decide whether a small layout adjustment is useful. Read [references/layout-tuning.md](references/layout-tuning.md) for page-count or spacing adjustments. If the CLI fails, read [references/troubleshooting.md](references/troubleshooting.md).
6. Do not edit or rewrite the Markdown content unless the user explicitly authorizes content changes. Do not use `--force` unless the target does not exist or the user has explicitly authorized overwriting it.
7. If the user requests a target page count, make at most three automatic tuning rounds, re-checking every page after each round. If the target is still not met, report the current result and ask before continuing.

For an export-only request, render once and deliver the confirmed PDF/PNG paths, page count, template, and unresolved warnings. For a layout-validation request, deliver the same information plus what was visually checked.
