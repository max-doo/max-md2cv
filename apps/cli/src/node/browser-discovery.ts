import { access } from "node:fs/promises";
import { constants } from "node:fs";
import { delimiter, join } from "node:path";
import { chromium, type Browser } from "playwright-core";
import { Md2cvError } from "./errors";

export type BrowserName = "auto" | "edge" | "chrome" | "chromium";

export interface BrowserCandidate {
  name: Exclude<BrowserName, "auto">;
  label: string;
  executablePath: string;
}

const windowsCandidates = {
  edge: [
    join(process.env.PROGRAMFILES ?? "C:\\Program Files", "Microsoft", "Edge", "Application", "msedge.exe"),
    join(process.env["PROGRAMFILES(X86)"] ?? "C:\\Program Files (x86)", "Microsoft", "Edge", "Application", "msedge.exe"),
    join(process.env.LOCALAPPDATA ?? "", "Microsoft", "Edge", "Application", "msedge.exe"),
  ],
  chrome: [
    join(process.env.PROGRAMFILES ?? "C:\\Program Files", "Google", "Chrome", "Application", "chrome.exe"),
    join(process.env["PROGRAMFILES(X86)"] ?? "C:\\Program Files (x86)", "Google", "Chrome", "Application", "chrome.exe"),
    join(process.env.LOCALAPPDATA ?? "", "Google", "Chrome", "Application", "chrome.exe"),
  ],
  chromium: [
    join(process.env.PROGRAMFILES ?? "C:\\Program Files", "Chromium", "Application", "chromium.exe"),
    join(process.env.LOCALAPPDATA ?? "", "Chromium", "Application", "chromium.exe"),
  ],
} as const;

const unixCandidates = {
  edge: ["/usr/bin/microsoft-edge", "/usr/bin/microsoft-edge-stable", "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge"],
  chrome: ["/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"],
  chromium: ["/usr/bin/chromium", "/usr/bin/chromium-browser", "/Applications/Chromium.app/Contents/MacOS/Chromium"],
} as const;

const commandCandidates = (name: Exclude<BrowserName, "auto">): string[] => {
  const pathEntries = (process.env.Path ?? process.env.PATH ?? "")
    .split(delimiter)
    .filter(Boolean);
  const executableNames = name === "edge"
    ? ["msedge", "microsoft-edge", "microsoft-edge-stable"]
    : name === "chrome"
      ? ["chrome", "google-chrome", "google-chrome-stable"]
      : ["chromium", "chromium-browser"];
  return pathEntries.flatMap((entry) => executableNames.map((executable) => join(entry, `${executable}${process.platform === "win32" ? ".exe" : ""}`)));
};

const pathsFor = (name: Exclude<BrowserName, "auto">): string[] =>
  process.platform === "win32"
    ? [...windowsCandidates[name], ...commandCandidates(name)]
    : [...unixCandidates[name], ...commandCandidates(name)];

const fileExists = async (path: string): Promise<boolean> => {
  try {
    await access(path, constants.X_OK);
    return true;
  } catch {
    return false;
  }
};

export const discoverBrowser = async (
  requested: BrowserName = "auto",
  explicitPath?: string,
): Promise<{ candidate: BrowserCandidate | null; attempted: string[] }> => {
  if (explicitPath) {
    const path = explicitPath;
    return {
      candidate: (await fileExists(path))
        ? { name: "chromium", label: "Custom browser", executablePath: path }
        : null,
      attempted: [path],
    };
  }

  const envPath = process.env.MD2CV_BROWSER_PATH;
  if (envPath) {
    return discoverBrowser(requested, envPath);
  }

  const names: Exclude<BrowserName, "auto">[] = requested === "auto"
    ? ["edge", "chrome", "chromium"]
    : [requested];
  const attempted: string[] = [];
  for (const name of names) {
    for (const path of pathsFor(name)) {
      attempted.push(path);
      if (await fileExists(path)) {
        return { candidate: { name, label: name === "edge" ? "Microsoft Edge" : name === "chrome" ? "Google Chrome" : "Chromium", executablePath: path }, attempted };
      }
    }
  }
  return { candidate: null, attempted };
};

export const launchDiscoveredBrowser = async (
  requested: BrowserName = "auto",
  explicitPath?: string,
): Promise<{ browser: Browser; candidate: BrowserCandidate; version: string; attempted: string[] }> => {
  const result = await discoverBrowser(requested, explicitPath);
  if (!result.candidate) {
    throw new Md2cvError(
      "BROWSER_NOT_FOUND",
      "No usable Edge, Chrome, or Chromium executable was found.",
      { attempted: result.attempted },
      ["Run md2cv doctor --json for environment diagnostics.", "Use --browser-path to specify a browser executable."],
    );
  }

  try {
    const browser = await chromium.launch({
      executablePath: result.candidate.executablePath,
      headless: true,
      args: process.platform === "win32" ? ["--disable-gpu"] : ["--disable-gpu", "--no-sandbox"],
    });
    return { browser, candidate: result.candidate, version: browser.version(), attempted: result.attempted };
  } catch (error) {
    throw new Md2cvError(
      "BROWSER_LAUNCH_FAILED",
      `Failed to launch ${result.candidate.label}.`,
      { path: result.candidate.executablePath, cause: error instanceof Error ? error.message : String(error) },
      ["Close other headless browser processes and try again.", "Use --browser-path to select another Chromium-based browser."],
    );
  }
};
