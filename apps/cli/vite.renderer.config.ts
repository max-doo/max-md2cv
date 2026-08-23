import { defineConfig } from "vite";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const appDirectory = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: resolve(appDirectory, "src/renderer-host"),
  base: "./",
  build: {
    outDir: resolve(appDirectory, "dist/renderer"),
    emptyOutDir: true,
    cssCodeSplit: false,
    rollupOptions: {
      input: resolve(appDirectory, "src/renderer-host/index.html"),
    },
  },
});
