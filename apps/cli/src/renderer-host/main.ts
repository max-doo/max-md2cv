import { renderResume } from "../../../../packages/resume-renderer/src/index";
import type { RenderRequest } from "../../../../packages/resume-renderer/src/types";

interface RendererHostApi {
  render: (request: RenderRequest) => Promise<unknown>;
}

declare global {
  interface Window {
    md2cvRenderer: RendererHostApi;
  }
}

const target = document.getElementById("renderer-root");
if (!target) throw new Error("Renderer host target is missing.");

window.md2cvRenderer = {
  render: (request) => renderResume(request, target),
};
