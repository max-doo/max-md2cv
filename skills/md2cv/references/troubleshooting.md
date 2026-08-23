# MD2CV troubleshooting

Read this reference when `md2cv` returns an error or an environment warning. The JSON error `code` is authoritative; do not infer a fix from unstable log wording.

| Code | Response |
| --- | --- |
| `BROWSER_NOT_FOUND` | Run `md2cv doctor --json`. Install Edge/Chrome/Chromium or pass `--browser-path` to an installed executable. |
| `BROWSER_LAUNCH_FAILED` | Re-run doctor, close stale browser processes, and try another Chromium-based executable. |
| `OUTPUT_EXISTS` | Pick a new path, or obtain explicit overwrite authorization before using `--force`. |
| `TEMPLATE_NOT_FOUND` | Run `md2cv templates list --json`; do not guess an id. |
| `TEMPLATE_VALUE_INVALID` | Re-run `md2cv templates schema <id> --json` and use an existing key, type, option, and range. |
| `PHOTO_NOT_FOUND` | Check the photo path. Config `photoPath` is relative to the config file; CLI `--photo` is relative to the current working directory. |
| `RENDER_TIMEOUT` | Check local/remote images, fonts, and network policy. Use `--allow-network` only when authorized, or increase `--timeout` within the supported range. |
| `FONT_NOT_LOADED` | Use a schema-supported font or, if strict fonts are not required, render without `--strict-fonts` and disclose the warning. |
| `PAGE_OVERFLOW` | Read [layout-tuning.md](layout-tuning.md), inspect the affected page, and adjust a small number of schema values. |
| `PAGE_COUNT_EXCEEDED` | Inspect every page and tune spacing or margins only when the user requested a page limit. |
| `PDF_EXPORT_FAILED` / `SCREENSHOT_EXPORT_FAILED` | Re-run with the same input and inspect doctor output; do not claim delivery until the reported files exist and parse successfully. |
