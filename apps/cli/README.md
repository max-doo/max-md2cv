# @max-md2cv/cli

`md2cv` renders a Markdown resume with the same templates and Paged.js layout rules used by Max-MD2CV.

```powershell
git clone https://github.com/max-doo/max-md2cv.git
cd max-md2cv
npm install
npm run build:cli
npm install --global ./apps/cli
md2cv doctor --json
md2cv render .\resume.md
```

Requires Node.js 20+, npm, Git for source installation, and an installed Edge/Chrome/Chromium browser. After the npm package is published, `npm install --global @max-md2cv/cli` is also available. If the registry returns `E404`, use the source installation above. See the [CLI installation guide](https://github.com/max-doo/max-md2cv/blob/master/skills/md2cv/references/cli-installation.md) for setup and update troubleshooting; a copy ships in `dist/runtime/skills/md2cv/references/cli-installation.md`.

The default output is a PDF and one PNG per rendered page in the current working directory. The CLI discovers Microsoft Edge first, then Chrome and Chromium. Use `--browser-path` or `MD2CV_BROWSER_PATH` when the browser is installed in a non-standard location.

Use `--json` for machine-readable output. JSON is the only stdout output in that mode; diagnostics are represented by stable error codes and warnings.

## Smart one-page fitting

```sh
md2cv render ./resume.md --one-page --template classic --output-dir ./output --json
```

`--one-page` uses the same bounded layout search as the desktop/Web button: adjust spacing, line height, vertical margins, and then font sizes within the shared readability limits, followed by relaxation of unused space. It can also expand a short resume to a more comfortable layout. Theme colors, font family, photo settings, and Markdown content are preserved. Only the final candidate produces PDF/PNG files.

The result includes `onePage: { fitted: boolean, probes: number }` and the final `effectiveValues`. If the tightest layout still needs multiple pages, the CLI exports all pages and reports `PAGE_COUNT_EXCEEDED`; it does not truncate content or remove manual `\page` breaks. `--max-pages 1` only warns about excess pages and does not run fitting. Existing output files still require `--force` to overwrite.

Enable fitting in a config file with:

```json
{
  "version": 1,
  "template": "classic",
  "render": { "onePage": true }
}
```

Pass `--no-one-page` to disable config-based fitting. `--timeout` bounds the browser render operation, including the search; increase it (up to 120000 ms) if a complex resume times out. Use `md2cv render --help` to check that your installed CLI supports `--one-page`.

## Agent Skill

Install the companion Skill separately:

```sh
npx skills add max-doo/max-md2cv --skill md2cv --global --copy
```

Select your Agent when prompted. The [Skills CLI](https://github.com/vercel-labs/skills) copies the Skill and its references; installing this npm CLI alone does not register the Skill with your Agent. The npm package includes a full copy under `dist/runtime/skills/md2cv` for manual installation.

Ask your Agent to use `md2cv` to edit a resume in Xiaojian format, tailor it to a role, export PDF/PNGs, or fit to one page. Content-only editing does not require the CLI. The Skill loads the format reference when writing, and loads installation or troubleshooting guidance only when needed.
