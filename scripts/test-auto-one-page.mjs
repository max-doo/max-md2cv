import assert from "node:assert/strict";
import {
  interpolateOnePageValues,
  relaxOnePageCandidate,
  SMART_ONE_PAGE_MAX_VALUES,
  SMART_ONE_PAGE_MIN_VALUES,
} from "../packages/resume-core/src/utils/autoOnePage.ts";

const sampleBaseValues = {
  themeColor: "#4c49cc",
  fontFamily: "Arial",
};

// 1. lambda = 0: 处于舒适上限 (Comfort Max)
const v0 = interpolateOnePageValues(sampleBaseValues, 0);
assert.equal(v0.fontSize, SMART_ONE_PAGE_MAX_VALUES.fontSize, "lambda 0 fontSize must be comfort max (14.5)");
assert.equal(v0.lineHeight, SMART_ONE_PAGE_MAX_VALUES.lineHeight, "lambda 0 lineHeight must be comfort max (1.6)");
assert.equal(v0.paragraphSpacing, SMART_ONE_PAGE_MAX_VALUES.paragraphSpacing, "lambda 0 paragraphSpacing must be comfort max (8)");

// 2. lambda = 0.3: Tier 1 压缩，Tier 2 和 Tier 3 依然保持舒适上限
const v03 = interpolateOnePageValues(sampleBaseValues, 0.3);
assert.ok(v03.paragraphSpacing < SMART_ONE_PAGE_MAX_VALUES.paragraphSpacing, "paragraphSpacing should be compressed");
assert.equal(v03.lineHeight, SMART_ONE_PAGE_MAX_VALUES.lineHeight, "lineHeight should remain max at lambda=0.3");
assert.equal(v03.fontSize, SMART_ONE_PAGE_MAX_VALUES.fontSize, "fontSize should remain max at lambda=0.3");

// 3. lambda = 0.5: Tier 1 达到极限最小值，Tier 2 压缩，Tier 3 字号依然保持舒适上限
const v05 = interpolateOnePageValues(sampleBaseValues, 0.5);
assert.equal(v05.paragraphSpacing, SMART_ONE_PAGE_MIN_VALUES.paragraphSpacing, "paragraphSpacing should reach min at lambda=0.5");
assert.ok(v05.lineHeight < SMART_ONE_PAGE_MAX_VALUES.lineHeight, "lineHeight should be compressed at lambda=0.5");
assert.equal(v05.fontSize, SMART_ONE_PAGE_MAX_VALUES.fontSize, "fontSize should remain max at lambda=0.5");

// 4. lambda = 1.0: 所有参数达到安全下限，且字号底线严格为 11px
const v1 = interpolateOnePageValues(sampleBaseValues, 1.0);
assert.equal(v1.fontSize, 11, "fontSize must be 11 at lambda 1.0");
assert.equal(v1.dateSize, 11, "dateSize must be 11 at lambda 1.0");
assert.equal(v1.lineHeight, 1.25, "lineHeight must be 1.25 at lambda 1.0");
assert.equal(v1.marginV, 8, "marginV must be 8 at lambda 1.0");
assert.equal(v1.paragraphSpacing, 1, "paragraphSpacing must be 1 at lambda 1.0");

// 5. relaxOnePageCandidate: 留白回填补偿应平缓放大间距和行高，而不放大字号
const relaxed = relaxOnePageCandidate(v1, 1);
assert.equal(relaxed.fontSize, 11, "relaxed fontSize should keep base to avoid breaking page");
assert.equal(relaxed.lineHeight, 1.3, "relaxed lineHeight should increase from 1.25 to 1.3");
assert.equal(relaxed.paragraphSpacing, 2, "relaxed paragraphSpacing should increase from 1 to 2");
assert.equal(relaxed.h2MarginTop, 6, "relaxed h2MarginTop should increase from 4 to 6");

console.log("All dual-mode autoOnePage and relaxation unit tests passed successfully!");
