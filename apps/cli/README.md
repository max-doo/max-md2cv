# @max-md2cv/cli

`md2cv` renders a Markdown resume with the same templates and Paged.js layout rules used by Max-MD2CV.

```powershell
npm install --global @max-md2cv/cli
md2cv render .\resume.md
```

The default output is a PDF and one PNG per rendered page in the current working directory. The CLI discovers Microsoft Edge first, then Chrome and Chromium. Use `--browser-path` or `MD2CV_BROWSER_PATH` when the browser is installed in a non-standard location.

Use `--json` for machine-readable output. JSON is the only stdout output in that mode; diagnostics are represented by stable error codes and warnings.
