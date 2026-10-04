import { describe, expect, it } from "vitest";
import { fitOnePage, SMART_ONE_PAGE_MIN_VALUES, SMART_ONE_PAGE_MAX_VALUES } from "../../../../packages/resume-core/src/utils/autoOnePage";

describe("shared smart one-page search", () => {
  const base = { themeColor: "#123456", fontFamily: "Arial", photoSize: 85 };

  it("returns the compact layout and actual page count when fitting is impossible", async () => {
    const result = await fitOnePage(base, async () => 3);
    expect(result.pageCount).toBe(3);
    expect(result.probes).toBe(1);
    expect(result.values).toMatchObject({ ...base, ...SMART_ONE_PAGE_MIN_VALUES });
  });

  it("uses comfortable values for a short resume and preserves unrelated settings", async () => {
    const result = await fitOnePage(base, async () => 1);
    expect(result.pageCount).toBe(1);
    expect(result.values).toMatchObject({ ...base, ...SMART_ONE_PAGE_MAX_VALUES });
  });

  it("finds a readable fit and rejects relaxation that would add a page", async () => {
    const probed = [] as Array<{ fontSize: number; lineHeight: number }>;
    const result = await fitOnePage(base, async (values) => {
      probed.push({ fontSize: Number(values.fontSize), lineHeight: Number(values.lineHeight) });
      return Number(values.fontSize) <= 13.5 && Number(values.lineHeight) <= 1.25 ? 1 : 2;
    });
    expect(result.pageCount).toBe(1);
    expect(result.values.fontSize).toBe(13.5);
    expect(result.values.lineHeight).toBe(1.25);
    expect(probed.at(-1)?.lineHeight).toBeGreaterThan(1.25);
    expect(result.probes).toBeLessThanOrEqual(12);
    expect(result.values).toMatchObject(base);
  });

  it("propagates render failures instead of reporting a successful fit", async () => {
    await expect(fitOnePage(base, async () => { throw new Error("Font load failed"); }))
      .rejects.toThrow("Font load failed");
  });
});
