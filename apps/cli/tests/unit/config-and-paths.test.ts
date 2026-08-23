import { describe, expect, it } from "vitest";
import { normalizeTemplateValuesForCli, parseSetValues } from "../../src/config/schema";
import { createOutputPlan, sanitizeOutputBaseName } from "../../src/node/output-paths";
import { Md2cvError } from "../../src/node/errors";
import type { ResumeTemplate } from "../../../../packages/resume-core/src/domain";

const template: ResumeTemplate = {
  id: "test",
  name: "Test",
  version: "1.0.0",
  entryCss: "style.css",
  defaults: { fontSize: 14, enabled: true, layout: "a", themeColor: "#000000" },
  editorSchema: [
    { key: "fontSize", type: "number", label: "Size", min: 11, max: 16 },
    { key: "enabled", type: "boolean", label: "Enabled" },
    { key: "layout", type: "select", label: "Layout", options: [{ label: "A", value: "a" }, { label: "B", value: "b" }] },
    { key: "themeColor", type: "color", label: "Color" },
  ],
  css: "",
};

describe("CLI config and output contracts", () => {
  it("clamps schema numbers and applies CLI values after config values", () => {
    const result = normalizeTemplateValuesForCli(
      template,
      { fontSize: 99, layout: "a", enabled: true, themeColor: "#111111" },
      { fontSize: "12", layout: "b" },
    );
    expect(result.values.fontSize).toBe(12);
    expect(result.values.layout).toBe("b");
    expect(result.warnings).toHaveLength(1);
  });

  it("parses boolean --set values and preserves the last occurrence", () => {
    const values = parseSetValues(template, ["enabled=false", "enabled=true"]);
    expect(values.enabled).toBe("true");
    expect(normalizeTemplateValuesForCli(template, {}, values).values.enabled).toBe(true);
  });

  it("rejects unknown keys, invalid booleans, and invalid select values", () => {
    expect(() => normalizeTemplateValuesForCli(template, { unknown: "x" })).toThrowError(Md2cvError);
    expect(() => parseSetValues(template, ["enabled=yes"])).toThrowError(Md2cvError);
    expect(() => parseSetValues(template, ["layout=c"])).toThrowError(Md2cvError);
  });

  it("sanitizes Windows names without erasing valid Unicode", () => {
    expect(sanitizeOutputBaseName("简历: 2026?.md")).toBe("简历_ 2026_");
    expect(sanitizeOutputBaseName("CON")).toBe("_CON");
  });

  it("resolves independent PDF and image destinations", () => {
    const plan = createOutputPlan("简历", {
      pdf: true,
      images: true,
      imageScale: 2,
      outputDir: "dist",
      pdfPath: "release/custom.pdf",
      imagesDir: "release/pages",
      force: false,
    });
    expect(plan.pdfPath).toMatch(/release[\\/]custom\.pdf$/);
    expect(plan.imagePath(2)).toMatch(/release[\\/]pages[\\/]简历\.page-2\.png$/);
  });
});
