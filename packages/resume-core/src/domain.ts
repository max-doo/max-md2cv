/**
 * Node-safe and browser-safe resume domain entry point.
 *
 * Keep runtime asset loaders out of this module. In particular, this file
 * must never import Vite `?raw` template resources or touch the DOM at module
 * evaluation time so the CLI can bundle the same domain rules as the apps.
 */
export * from "./types/resume";
export * from "./utils/manualPageBreak";
export * from "./utils/markdownRender";
export * from "./utils/resumeParser";
export * from "./utils/runtimeResumeStyle";
export * from "./utils/templateManifest";
export * from "./utils/templateStyle";
