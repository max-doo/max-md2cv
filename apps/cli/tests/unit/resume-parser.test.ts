import { describe, expect, it } from "vitest";
import { enhanceResumeHtml, resolveSectionType } from "../../../../packages/resume-core/src/utils/resumeParser";
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

describe("enhanceResumeHtml - personal info rendering", () => {
  it("renders personal-header and contact-info icons when there is NO job intention", () => {
    const rawHtml = "<h1>张三</h1>\n<p>电话：13800000000 | 邮箱：demo@example.com | 城市：北京</p>\n<h2>个人优势</h2>";
    const result = enhanceResumeHtml(rawHtml, { ...defaultStyle, personalInfoMode: "icon" });

    expect(result).toContain('<div class="personal-header">');
    expect(result).toContain('class="contact-info contact-info--icon"');
    expect(result).toContain('data-icon="call"');
    expect(result).toContain('data-icon="mail"');
    expect(result).toContain('data-icon="location_on"');
    expect(result).not.toContain('class="job-intention"');
  });

  it("renders personal-header and contact-info text when there is NO job intention in text mode", () => {
    const rawHtml = "<h1>张三</h1>\n<p>电话：13800000000 | 邮箱：demo@example.com | 城市：北京</p>\n<h2>个人优势</h2>";
    const result = enhanceResumeHtml(rawHtml, { ...defaultStyle, personalInfoMode: "text" });

    expect(result).toContain('<div class="personal-header">');
    expect(result).toContain('class="contact-info contact-info--text"');
    expect(result).toContain('class="contact-info-text-line"');
  });

  it("renders both job-intention and contact-info inside personal-header when job intention is present", () => {
    const rawHtml = "<h1>张三</h1>\n<p>求职意向：前端开发工程师</p>\n<p>电话：13800000000 | 邮箱：demo@example.com</p>\n<h2>个人优势</h2>";
    const result = enhanceResumeHtml(rawHtml, { ...defaultStyle, personalInfoMode: "icon" });

    expect(result).toContain('<div class="personal-header">');
    expect(result).toContain('class="job-intention"');
    expect(result).toContain('class="contact-info contact-info--icon"');
    expect(result).toContain('data-icon="call"');
    expect(result).toContain('data-icon="mail"');
  });

  it("renders personal-header when ONLY job intention is present", () => {
    const rawHtml = "<h1>张三</h1>\n<p>求职意向：前端开发工程师</p>\n<h2>个人优势</h2>";
    const result = enhanceResumeHtml(rawHtml, { ...defaultStyle, personalInfoMode: "icon" });

    expect(result).toContain('<div class="personal-header">');
    expect(result).toContain('class="job-intention"');
    expect(result).not.toContain('class="contact-info"');
  });

  it("renders multiple contact paragraphs combined in icon mode without job intention", () => {
    const rawHtml = "<h1>张三</h1>\n<p>电话：13800000000 | 邮箱：demo@example.com</p>\n<p>微信：zhangsan | 城市：北京</p>\n<h2>个人优势</h2>";
    const result = enhanceResumeHtml(rawHtml, { ...defaultStyle, personalInfoMode: "icon" });

    expect(result).toContain('<div class="personal-header">');
    expect(result).toContain('data-icon="call"');
    expect(result).toContain('data-icon="mail"');
    expect(result).toContain('data-icon="wechat"');
    expect(result).toContain('data-icon="location_on"');
  });

  it("does not create personal-header when header has no contact info or job intention", () => {
    const rawHtml = "<h1>张三</h1>\n<p>热爱技术，追求极致的普通段落</p>\n<h2>个人优势</h2>";
    const result = enhanceResumeHtml(rawHtml, { ...defaultStyle, personalInfoMode: "icon" });

    expect(result).not.toContain('<div class="personal-header">');
    expect(result).not.toContain('class="contact-info"');
    expect(result).toContain('<p>热爱技术，追求极致的普通段落</p>');
  });
});

describe("resolveSectionType & section headers", () => {
  it("resolves '项目与竞赛经历' to project section", () => {
    const section = resolveSectionType("项目与竞赛经历");
    expect(section).not.toBeNull();
    expect(section?.key).toBe("project");
    expect(section?.emoji).toBe("🚀");
  });

  it("resolves other common project titles to project section", () => {
    expect(resolveSectionType("项目经历")?.key).toBe("project");
    expect(resolveSectionType("项目与比赛")?.key).toBe("project");
    expect(resolveSectionType("个人项目")?.key).toBe("project");
    expect(resolveSectionType("开源贡献")?.key).toBe("project");
  });

  it("resolves standalone competition titles to award section", () => {
    expect(resolveSectionType("竞赛经历")?.key).toBe("award");
    expect(resolveSectionType("学科竞赛")?.key).toBe("award");
  });

  it("adds section-project class to h2 for '项目与竞赛经历'", () => {
    const rawHtml = "<h2>项目与竞赛经历</h2>";
    const result = enhanceResumeHtml(rawHtml, defaultStyle);
    expect(result).toContain('class="section-project"');
    expect(result).toContain('<span class="section-title-badge">项目与竞赛经历</span>');
  });
});

