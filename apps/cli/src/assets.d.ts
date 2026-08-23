declare module "*.woff2" {
  const source: string;
  export default source;
}

declare module "*.css?raw" {
  const source: string;
  export default source;
}

declare module "*.md?raw" {
  const source: string;
  export default source;
}

declare module "pagedjs" {
  export class Previewer {
    preview(source: HTMLElement, stylesheets: unknown[], target: HTMLElement): Promise<unknown>;
  }
}
