import { describe, expect, it } from "vitest";
import { enhanceResumeHtml } from "../../../../packages/resume-core/src/utils/resumeParser";
import type { ResumeStyle } from "../../../../packages/resume-core/src/types/resume";

const defaultStyle: ResumeStyle = {
  themeColor: "#4c49cc",
  fontSize: "14px",
  lineHeight: "1.6",
  h1Size: "24px",
  h2Size: "18px",
  h3Size: "15px",
  h2MarginTop: "16px",
  h2MarginBottom: "8px",
  h3MarginTop: "12px",
  h3MarginBottom: "6px",
  paragraphSpacing: "8px",
  pageMarginH: "30px",
  pageMarginV: "30px",
  dateSize: "13px",
  dateWeight: "normal",
  fontFamily: "sans-serif",
  personalInfoMode: "text",
  photoPlacement: "hidden",
  photoVisible: false,
  photoWidth: 100,
  photoOffsetRight: 0,
  photoReserve: 0,
  headerLayout: "split",
  sectionTitlePreset: "underline",
  personalHeaderSpacing: "12px",
};

describe("enhanceResumeHtml - experience line splitting", () => {
  it("splits 2-segment title with date into left, center, and right columns", () => {
    const rawHtml = "<h3>行政主管 | 贵泽实业有限公司 [2016.03 - 至今]</h3>";
    const result = enhanceResumeHtml(rawHtml, defaultStyle);

    expect(result).toContain('class="experience-line experience-line--3col"');
    expect(result).toContain('<span class="experience-col experience-col--left experience-title">行政主管</span>');
    expect(result).toContain('<span class="experience-col experience-col--center">贵泽实业有限公司</span>');
    expect(result).toContain('<span class="experience-col experience-col--right experience-date">2016.03 - 至今</span>');
  });

  it("supports full-width Chinese pipe delimiter ｜", () => {
    const rawHtml = "<h3>工商管理 ｜ 上海大学（本科） [2012.09 - 2016.07]</h3>";
    const result = enhanceResumeHtml(rawHtml, defaultStyle);

    expect(result).toContain('class="experience-line experience-line--3col"');
    expect(result).toContain('<span class="experience-col experience-col--left experience-title">工商管理</span>');
    expect(result).toContain('<span class="experience-col experience-col--center">上海大学（本科）</span>');
    expect(result).toContain('<span class="experience-col experience-col--right experience-date">2012.09 - 2016.07</span>');
  });

  it("does not trigger experience line layout for body paragraphs containing pipe delimiter", () => {
    const rawHtml = "<p>项目地址：https://github.com/max-doo/Multichat-desk | 产品主页：https://multichat.top/</p>";
    const result = enhanceResumeHtml(rawHtml, defaultStyle);

    expect(result).toBe("<p>项目地址：https://github.com/max-doo/Multichat-desk | 产品主页：https://multichat.top/</p>");
    expect(result).not.toContain("experience-line");
  });

  it("backward-compatible with single segment title with date", () => {
    const rawHtml = "<h3>阿里巴巴网络技术有限公司 - 前端开发 [2020.01 - 2022.01]</h3>";
    const result = enhanceResumeHtml(rawHtml, defaultStyle);

    expect(result).toContain('class="experience-line experience-line--2col"');
    expect(result).toContain('<span class="experience-col experience-col--left experience-title">阿里巴巴网络技术有限公司 - 前端开发</span>');
    expect(result).toContain('<span class="experience-col experience-col--right experience-date">2020.01 - 2022.01</span>');
    expect(result).not.toContain("experience-col--center");
  });
});
