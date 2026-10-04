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
    const photoSizeField = modern.editorSchema.find((field) => field.key === "photoSize");
    expect(photoSizeField?.min).toBe(75);
    expect(photoSizeField?.max).toBe(100);
    const lineHeightField = modern.editorSchema.find((field) => field.key === "lineHeight");
    expect(lineHeightField?.min).toBe(1);
    expect(lineHeightField?.max).toBe(1.8);
    expect(lineHeightField?.step).toBe(0.05);
  });

  it("does not include dateWeight in template defaults or editorSchema", async () => {
    const templates = await loadTemplates();
    for (const template of templates) {
      expect(template.defaults.dateWeight).toBeUndefined();
      expect(template.editorSchema.some((field) => field.key === "dateWeight")).toBe(false);
      expect(template.css).toContain("font-weight: inherit");
    }
  });
});
