import { createServer, type Server } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, relative, resolve, sep } from "node:path";

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".woff2": "font/woff2",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

export interface RendererServer {
  url: string;
  close: () => Promise<void>;
}

export const startRendererServer = async (rootDirectory: string): Promise<RendererServer> => {
  const root = resolve(rootDirectory);
  const server: Server = createServer(async (request, response) => {
    const requestPath = decodeURIComponent((request.url ?? "/").split("?")[0] || "/");
    const relativePath = requestPath === "/" ? "index.html" : requestPath.replace(/^\/+/, "");
    const candidate = resolve(root, relativePath);
    const relativeCandidate = relative(root, candidate);
    if (relativeCandidate.startsWith(`..${sep}`) || relativeCandidate === ".." || relativeCandidate.includes(`..${sep}`)) {
      response.writeHead(403);
      response.end("Forbidden");
      return;
    }

    try {
      const body = await readFile(candidate);
      response.writeHead(200, {
        "content-type": MIME_TYPES[extname(candidate).toLowerCase()] ?? "application/octet-stream",
        "cache-control": "no-store",
      });
      response.end(body);
    } catch {
      response.writeHead(404);
      response.end("Not found");
    }
  });

  await new Promise<void>((resolvePromise, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.removeListener("error", reject);
      resolvePromise();
    });
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    await new Promise<void>((resolvePromise) => server.close(() => resolvePromise()));
    throw new Error("Renderer server did not expose a TCP port.");
  }

  return {
    url: `http://127.0.0.1:${address.port}/`,
    close: () => new Promise<void>((resolvePromise) => server.close(() => resolvePromise())),
  };
};
