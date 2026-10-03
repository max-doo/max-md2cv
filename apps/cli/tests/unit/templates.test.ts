import { describe, expect, it } from "vitest";
import { findTemplate, loadTemplates } from "../../src/node/template-loader";

describe("built-in template assets", () => {
  it("loads all normalized templates from the built runtime directory", async () => {
    const templates = await loadTemplates();
    expect(templates.map((template) => template.id)).toEqual(["business", "business-block", "classic", "modern", "slant-badge"]);
    expect(templates.every((template) => template.editorSchema.length > 0 && template.css.length > 0)).toBe(true);
  });

  it("expands the standard schema preset", async () => {
    const modern = await findTemplate("modern");
    expect(modern.editorSchema.some((field) => field.key === "fontSize")).toBe(true);
    expect(modern.defaults.themeColor).toBe("#4c49cc");
  });
});
