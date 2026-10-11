import assert from "node:assert/strict";
import { chromium } from "playwright-core";

const url = process.env.WEB_TEST_URL ?? "http://127.0.0.1:4173";
// Start the Web dev server first; WEB_TEST_URL and WEB_TEST_BROWSER can override defaults.
const browser = await chromium.launch({ channel: process.env.WEB_TEST_BROWSER ?? "msedge", headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const errors = [];
page.on("pageerror", error => errors.push(error.message));
const markdown = "# 测试简历\n\n格式测试文本\n\n## 模块甲\n正文甲\n\n### 子项甲\n子项甲内容\n\n### 子项乙\n子项乙内容\n\n## 模块乙\n正文乙\n\n## 模块丙\n正文丙";
await page.addInitScript(value => localStorage.setItem("max-md2cv:web-playground:draft", JSON.stringify({ version: 2, markdown: value, templateId: "modern", values: {}, photoBase64: null, updatedAt: new Date().toISOString() })), markdown);
const cdp = await page.context().newCDPSession(page);
const touchDrag = async (start, end) => {
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: start.x, y: start.y }] });
  await page.waitForTimeout(450);
  for (let i = 1; i <= 12; i++) {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: start.x + (end.x - start.x) * i / 12, y: start.y + (end.y - start.y) * i / 12 }] });
    await page.waitForTimeout(20);
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await page.waitForTimeout(150);
};
const row = text => page.locator(".mobile-outline-drawer-wrapper .outline-row").filter({ hasText: text });
const dragRow = async (source, target, after = true) => {
  const sourceBox = await source.locator("..").locator(".outline-drag-handle").boundingBox();
  const targetBox = await target.boundingBox();
  await touchDrag({ x: sourceBox.x + sourceBox.width / 2, y: sourceBox.y + sourceBox.height / 2 }, { x: sourceBox.x + sourceBox.width / 2, y: targetBox.y + targetBox.height * (after ? 0.8 : 0.2) });
};
const selectText = async () => {
  await page.locator(".cm-content").evaluate(content => {
    content.focus();
    const line = [...content.querySelectorAll(".cm-line")].find(el => el.textContent.includes("格式测试文本"));
    const walker = document.createTreeWalker(line, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      const index = node.textContent.indexOf("格式测试文本");
      if (index >= 0) {
        const range = document.createRange();
        range.setStart(node, index);
        range.setEnd(node, index + "格式测试文本".length);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        return;
      }
    }
    throw new Error("Test selection text missing");
  });
  await page.getByRole("toolbar", { name: "选中文字格式" }).waitFor();
};
try {
  await page.goto(url);
  await page.getByTitle("打开大纲").tap();
  await page.waitForTimeout(350);
  const handle = page.locator(".mobile-outline-drawer-wrapper .outline-drag-handle").first();
  assert.equal(await handle.evaluate(el => getComputedStyle(el).touchAction), "none");
  assert.ok((await handle.boundingBox()).width >= 44);
  await dragRow(row("模块甲"), row("模块丙"));
  assert.deepEqual(await page.locator('.mobile-outline-drawer-wrapper [data-parent-id=""] .outline-row-title').allTextContents(), ["模块乙", "模块丙", "模块甲"]);
  const content = await page.locator(".cm-content").innerText();
  assert.ok(content.indexOf("正文乙") < content.indexOf("正文丙") && content.indexOf("正文丙") < content.indexOf("正文甲"));
  assert.ok(content.indexOf("子项甲内容") > content.indexOf("正文甲"));
  await dragRow(row("模块甲"), row("模块乙"), false);
  await dragRow(row("子项甲"), row("子项乙"));
  assert.ok((await page.locator(".cm-content").innerText()).indexOf("子项乙内容") < (await page.locator(".cm-content").innerText()).indexOf("子项甲内容"));
  await page.getByTitle("关闭大纲").tap();
  await page.waitForTimeout(350);
  await selectText();
  const toolbar = page.getByRole("toolbar", { name: "选中文字格式" });
  await toolbar.getByRole("button", { name: "粗体", exact: true }).tap();
  assert.ok((await page.locator(".cm-content").innerText()).includes("**格式测试文本**"));
  assert.equal(await page.evaluate(() => window.getSelection().toString()), "格式测试文本");
  await toolbar.getByRole("button", { name: "粗体", exact: true }).tap();
  assert.ok(!(await page.locator(".cm-content").innerText()).includes("**格式测试文本**"));
  await toolbar.getByRole("button", { name: "斜体", exact: true }).tap();
  assert.ok((await page.locator(".cm-content").innerText()).includes("*格式测试文本*"));
  const beforeSwipe = await page.locator(".cm-content").innerText();
  const strip = toolbar.locator("div").first();
  const stripBox = await strip.boundingBox();
  await touchDrag({ x: stripBox.x + stripBox.width - 15, y: stripBox.y + stripBox.height / 2 }, { x: stripBox.x + 15, y: stripBox.y + stripBox.height / 2 });
  assert.ok(await strip.evaluate(el => el.scrollLeft) > 0);
  assert.equal(await page.locator(".cm-content").innerText(), beforeSwipe);
  assert.ok((await page.locator(".cm-content").innerText()).includes("*格式测试文本*"));
  await toolbar.getByRole("button", { name: "二级标题", exact: true }).tap();
  assert.ok((await page.locator(".cm-content").innerText()).includes("## *格式测试文本*"));
  // Exercise resize and pan notifications without claiming to simulate an OS keyboard.
  await page.evaluate(() => {
    const viewport = window.visualViewport;
    Object.defineProperty(viewport, "height", { configurable: true, value: 440 });
    Object.defineProperty(viewport, "offsetTop", { configurable: true, value: 30 });
    viewport.dispatchEvent(new Event("resize"));
  });
  await page.waitForTimeout(50);
  assert.ok((await toolbar.boundingBox()).y + (await toolbar.boundingBox()).height <= 459);
  await toolbar.getByRole("button", { name: "收起格式工具条" }).tap();
  assert.equal(await toolbar.count(), 0);
  await page.locator(".cm-content").evaluate(() => window.getSelection().collapseToEnd());
  await page.waitForTimeout(80);
  await selectText();
  await page.getByRole("tab", { name: "预览" }).tap();
  assert.equal(await toolbar.count(), 0);
  await page.getByTitle("打开大纲").tap();
  await page.waitForTimeout(350);
  await row("模块乙").tap();
  await page.waitForTimeout(350);
  assert.equal(await page.getByRole("tab", { name: "编辑" }).getAttribute("aria-selected"), "true");
  assert.equal(await page.locator(".mobile-outline-drawer-wrapper aside").getAttribute("aria-hidden"), "true");
  const desktop = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await desktop.goto(url);
  await desktop.getByTitle("加粗", { exact: true }).waitFor();
  assert.equal(await desktop.getByRole("toolbar", { name: "选中文字格式" }).count(), 0);
  await page.setViewportSize({ width: 320, height: 640 });
  await selectText();
  const smallBox = await toolbar.boundingBox();
  assert.ok(smallBox.x >= 0 && smallBox.x + smallBox.width <= 320);
  const scrollPage = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await scrollPage.addInitScript(() => localStorage.setItem("max-md2cv:web-playground:draft", JSON.stringify({ version: 2, markdown: Array.from({ length: 30 }, (_, i) => `## 模块 ${i}\n正文\n`).join("\n"), templateId: "modern", values: {} })));
  await scrollPage.goto(url);
  await scrollPage.getByTitle("打开大纲").tap();
  await scrollPage.waitForTimeout(350);
  const scrollCdp = await scrollPage.context().newCDPSession(scrollPage);
  await scrollCdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: 200, y: 600 }] });
  for (let y = 580; y >= 200; y -= 20) {
    await scrollCdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: 200, y }] });
  }
  await scrollCdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  assert.ok(await scrollPage.locator(".mobile-outline-drawer-wrapper").evaluate(el => [...el.querySelectorAll("*")].some(child => child.scrollTop > 0)), "Swiping outline titles must scroll the drawer");
  assert.deepEqual(errors, []);
  console.log("PASS: touch reordering, nested content, DOM selection, single-tap formatting, horizontal toolbar swipe, viewport positioning, outline jump, 320px layout, desktop toolbar.");
} finally {
  await browser.close();
}
