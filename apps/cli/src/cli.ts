#!/usr/bin/env node
import { Command, CommanderError } from "commander";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { realpathSync } from "node:fs";
import { runDoctorCommand } from "./commands/doctor";
import { runRenderCommand, type RenderCommandOptions } from "./commands/render";
import { runTemplateSchema, runTemplatesList } from "./commands/templates";
import { runValidateCommand, type ValidateCommandOptions } from "./commands/validate";
import { Md2cvError } from "./node/errors";
import { printError } from "./node/json-output";

const collect = (value: string, previous: string[] = []) => [...previous, value];
const browserNames = ["auto", "edge", "chrome", "chromium"] as const;

const parseNumberOption = (value: unknown, optionName: string): number | undefined => {
  if (value === undefined) return undefined;
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Md2cvError("INVALID_ARGUMENT", `${optionName} must be a finite number.`);
  }
  return parsed;
};

const configureRenderOptions = (command: Command) => command
  .option("--stdin", "Read Markdown from stdin")
  .option("--name <name>", "Base name for stdin or output files")
  .option("--template <id>", "Template id")
  .option("--config <path>", "Path to resume.render.json")
  .option("--set <key=value>", "Override a template value; may be repeated", collect, [])
  .option("--photo <path>", "Photo file path")
  .option("--output-dir <dir>", "Directory for unspecified output artifacts")
  .option("--pdf <path>", "PDF output path")
  .option("--images-dir <dir>", "Directory for page PNGs")
  .option("--no-pdf", "Do not write a PDF")
  .option("--no-images", "Do not write page PNGs")
  .option("--image-scale <number>", "PNG device scale factor (1-3)")
  .option("--max-pages <number>", "Warn when the rendered page count exceeds this value")
  .option("--strict-fonts", "Fail when requested fonts are unavailable")
  .option("--allow-network", "Allow remote resources")
  .option("--browser <browser>", "Browser channel: auto, edge, chrome, or chromium", "auto")
  .option("--browser-path <path>", "Explicit browser executable path")
  .option("--timeout <ms>", "Render timeout in milliseconds")
  .option("--force", "Allow replacing existing output files")
  .option("--json", "Print one machine-readable JSON result to stdout");

const buildProgram = () => {
  const program = new Command();
  program
    .name("md2cv")
    .description("Render Markdown resumes to PDF and per-page PNGs using Max-MD2CV templates.")
    .version("0.1.0")
    .showSuggestionAfterError()
    .configureOutput({
      writeOut: (message) => process.stdout.write(message),
      writeErr: (message) => process.stderr.write(message),
    });

  const render = program
    .command("render")
    .description("Render a Markdown resume once and write a PDF and/or page images.")
    .argument("[input.md]", "Markdown input path; omit it with --stdin")
    .addHelpText("after", "\nDefaults: outputs go to cwd; existing files are never overwritten without --force. Browser: Edge, then Chrome, then Chromium.\n")
    .action(async (input: string | undefined, options: RenderCommandOptions) => {
      if (!browserNames.includes(options.browser ?? "auto")) throw new Md2cvError("INVALID_ARGUMENT", `Unknown browser: ${options.browser}`);
      await runRenderCommand(input, {
        ...options,
        imageScale: parseNumberOption(options.imageScale, "--image-scale"),
        maxPages: parseNumberOption(options.maxPages, "--max-pages"),
        timeout: parseNumberOption(options.timeout, "--timeout"),
      });
    });
  configureRenderOptions(render);

  program
    .command("validate")
    .description("Validate input, config, template values, and photo paths without starting a browser.")
    .argument("[input.md]", "Markdown input path; omit it with --stdin")
    .option("--stdin", "Read Markdown from stdin")
    .option("--name <name>", "Base name when reading stdin")
    .option("--template <id>", "Template id")
    .option("--config <path>", "Path to resume.render.json")
    .option("--set <key=value>", "Override a template value; may be repeated", collect, [])
    .option("--photo <path>", "Photo file path")
    .option("--allow-network", "Allow remote resources")
    .option("--json", "Print JSON result to stdout")
    .action(async (input: string | undefined, options: ValidateCommandOptions) => runValidateCommand(input, options));

  const templates = program.command("templates").description("Inspect built-in templates and their schemas.");
  templates
    .command("list")
    .description("List available built-in templates.")
    .option("--json", "Print JSON")
    .action((options: { json?: boolean }) => runTemplatesList(options.json === true));
  templates
    .command("schema")
    .description("Print the complete schema and defaults for one template.")
    .argument("<id>", "Template id")
    .option("--json", "Print JSON")
    .action((id: string, options: { json?: boolean }) => runTemplateSchema(id, options.json === true));

  program
    .command("doctor")
    .description("Check Node, runtime assets, browser discovery, and writable directories.")
    .option("--browser <browser>", "Browser channel: auto, edge, chrome, or chromium", "auto")
    .option("--browser-path <path>", "Explicit browser executable path")
    .option("--render-smoke", "Run a disposable one-page browser smoke render")
    .option("--json", "Print JSON")
    .action(async (options: { browser: string; browserPath?: string; renderSmoke?: boolean; json?: boolean }) => {
      if (!browserNames.includes(options.browser as (typeof browserNames)[number])) throw new Md2cvError("INVALID_ARGUMENT", `Unknown browser: ${options.browser}`);
      await runDoctorCommand({ ...options, browser: options.browser as (typeof browserNames)[number] });
    });

  return program;
};

export const main = async (argv = process.argv): Promise<number> => {
  const jsonRequested = argv.includes("--json");
  const program = buildProgram();
  try {
    await program.parseAsync(argv);
    return 0;
  } catch (error) {
    if (error instanceof CommanderError && (error.code === "commander.helpDisplayed" || error.code === "commander.version")) return 0;
    if (error instanceof CommanderError) {
      return printError(new Md2cvError("INVALID_ARGUMENT", error.message), jsonRequested);
    }
    return printError(error, jsonRequested);
  }
};

const isMainModule = (): boolean => {
  if (!process.argv[1]) return false;
  const currentPath = resolve(fileURLToPath(import.meta.url));
  const entryPath = resolve(process.argv[1]);
  if (currentPath === entryPath) return true;
  try {
    return realpathSync(currentPath) === realpathSync(entryPath);
  } catch {
    return false;
  }
};

if (isMainModule()) {
  main().then((exitCode) => {
    if (exitCode !== 0) process.exitCode = exitCode;
  });
}
