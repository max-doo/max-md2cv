import { access, constants } from "node:fs/promises";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { discoverBrowser, type BrowserName } from "../node/browser-discovery";
import { getRuntimeRoot, getTemplateAssetReport, findTemplate } from "../node/template-loader";
import { printJson } from "../node/json-output";
import { renderInBrowser } from "../node/render-service";

export interface DoctorOptions {
  browser?: BrowserName;
  browserPath?: string;
  renderSmoke?: boolean;
  json?: boolean;
}

const nodeVersion = process.versions.node;
const majorNodeVersion = Number(nodeVersion.split(".")[0] ?? 0);

export const runDoctorCommand = async (options: DoctorOptions): Promise<void> => {
  const checks: Record<string, unknown> = {
    node: { version: nodeVersion, minimum: ">=20", ok: majorNodeVersion >= 20 },
    cliVersion: "0.1.0",
    runtimeRoot: getRuntimeRoot(),
    rendererHost: { path: resolve(getRuntimeRoot(), "renderer", "index.html"), ok: false },
    templates: null,
    browser: null,
    cwdWritable: false,
    tempWritable: false,
    smokeRender: options.renderSmoke ? null : { skipped: true },
  };

  try {
    await access(resolve(getRuntimeRoot(), "renderer", "index.html"));
    (checks.rendererHost as { ok: boolean }).ok = true;
  } catch {
    // Report the failed check below.
  }

  try {
    checks.templates = { ok: true, ...(await getTemplateAssetReport()) };
  } catch (error) {
    checks.templates = { ok: false, message: error instanceof Error ? error.message : String(error) };
  }

  const discovered = await discoverBrowser(options.browser ?? "auto", options.browserPath);
  checks.browser = {
    ok: Boolean(discovered.candidate),
    attempted: discovered.attempted,
    candidate: discovered.candidate,
  };

  try {
    await access(process.cwd(), constants.W_OK);
    checks.cwdWritable = true;
  } catch {
    checks.cwdWritable = false;
  }
  let temporaryDirectory: string | null = null;
  try {
    temporaryDirectory = await mkdtemp(join(tmpdir(), "md2cv-doctor-"));
    checks.tempWritable = true;
  } catch {
    checks.tempWritable = false;
  } finally {
    if (temporaryDirectory) await rm(temporaryDirectory, { recursive: true, force: true });
  }

  if (options.renderSmoke) {
    try {
      const template = await findTemplate("modern");
      const smoke = await renderInBrowser({
        markdown: "# MD2CV smoke test\n\n## Skills\n\n- Browser rendering works.",
        documentTitle: "doctor-smoke",
        template,
        values: template.defaults,
        photoDataUrl: null,
        sourceDirectory: null,
        options: { strictFonts: false, allowNetwork: false, timeoutMs: 30_000 },
      }, {
        browser: options.browser ?? "auto",
        browserPath: options.browserPath,
        imageScale: 1,
        timeoutMs: 30_000,
      });
      checks.smokeRender = { ok: true, pageCount: smoke.result.pageCount };
    } catch (error) {
      checks.smokeRender = { ok: false, message: error instanceof Error ? error.message : String(error) };
    }
  }

  const checkValues = Object.values(checks);
  const ok = checkValues.every((value) => {
    if (typeof value !== "object" || value === null) return true;
    if ("skipped" in value && value.skipped) return true;
    return !("ok" in value) || Boolean(value.ok);
  });
  const result = { ok, checks };
  if (options.json) printJson(result);
  else process.stdout.write(`${ok ? "OK" : "ISSUES FOUND"}\n${JSON.stringify(checks, null, 2)}\n`);
};
