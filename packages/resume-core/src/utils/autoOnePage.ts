import type { TemplateValues } from "../types/resume";

/**
 * 智能一页 (Smart Fit to One Page) 舒适上限 (Comfort Max)
 * 当简历内容较少或原本排版过于局促时，舒展自适应的最大上限，保证专业、端庄，杜绝过度注水或“大字报”。
 */
export const SMART_ONE_PAGE_MAX_VALUES: Record<string, number> = {
  // 字号类
  fontSize: 14.5,
  dateSize: 14,
  h3Size: 16,
  h2Size: 20,
  h1Size: 28,

  // 行距与边距
  lineHeight: 1.6,
  marginV: 11,

  // 间距类
  paragraphSpacing: 8,
  h2MarginTop: 14,
  h2MarginBottom: 7,
  h3MarginTop: 10,
  h3MarginBottom: 4,
  personalHeaderSpacing: 10,
};

/**
 * 智能一页 (Smart Fit to One Page) 安全下限 (Safe Min)
 * 当简历内容较多时，收缩自适应的安全绝对底线。正文字号严格为 11px。
 */
export const SMART_ONE_PAGE_MIN_VALUES: Record<string, number> = {
  // 字号类
  fontSize: 11,
  dateSize: 11,
  h3Size: 12,
  h2Size: 15,
  h1Size: 20,

  // 行距与边距
  lineHeight: 1.25,
  marginV: 8,

  // 间距类
  paragraphSpacing: 1,
  h2MarginTop: 4,
  h2MarginBottom: 2,
  h3MarginTop: 3,
  h3MarginBottom: 1,
  personalHeaderSpacing: 4,
};

export const SMART_ONE_PAGE_STEPS: Record<string, number> = {
  lineHeight: 0.05,
  marginV: 1,
  paragraphSpacing: 1,
  h2MarginTop: 1,
  h2MarginBottom: 1,
  h3MarginTop: 1,
  h3MarginBottom: 1,
  personalHeaderSpacing: 1,
  fontSize: 0.5,
  dateSize: 0.5,
  h3Size: 1,
  h2Size: 1,
  h1Size: 1,
};

const TIER_1_KEYS = new Set([
  "paragraphSpacing",
  "h2MarginTop",
  "h2MarginBottom",
  "h3MarginTop",
  "h3MarginBottom",
  "personalHeaderSpacing",
]);

const TIER_2_KEYS = new Set([
  "marginV",
  "lineHeight",
]);

const TIER_3_KEYS = new Set([
  "fontSize",
  "dateSize",
  "h3Size",
  "h2Size",
  "h1Size",
]);

const roundToStep = (val: number, step: number): number => {
  const inv = 1 / step;
  return Math.round(val * inv) / inv;
};

/**
 * 全局定界双向自适应计算函数
 * 在 [舒适上限 Comfort Max (λ=0), 安全极限下限 Safe Min (λ=1)] 的区间内，
 * 按照分层审美梯队进行参数映射：
 * - λ ∈ [0, 0.4]：优先微调 Tier 1 间距，字号与行高保持舒适上限
 * - λ ∈ (0.4, 0.7]：间距最小化，微调 Tier 2 行高与页边距，字号保持舒适上限
 * - λ ∈ (0.7, 1.0]：间距与行高最小化，微调 Tier 3 字号至安全底线 11px
 *
 * @param baseValues 基础排版参数（保留主题色、字体等非自适应属性）
 * @param lambda 归一化排版强度因子 (0 ~ 1)
 */
export const interpolateOnePageValues = (
  baseValues: TemplateValues,
  lambda: number,
): TemplateValues => {
  const clampedLambda = Math.max(0, Math.min(1, lambda));

  // Tier 1 进度：0 ~ 0.4
  const progress1 = Math.min(1, clampedLambda / 0.4);

  // Tier 2 进度：0.4 ~ 0.7
  const progress2 =
    clampedLambda <= 0.4
      ? 0
      : clampedLambda >= 0.7
        ? 1
        : (clampedLambda - 0.4) / 0.3;

  // Tier 3 进度：0.7 ~ 1.0
  const progress3 =
    clampedLambda <= 0.7
      ? 0
      : clampedLambda >= 1.0
        ? 1
        : (clampedLambda - 0.7) / 0.3;

  const nextValues: TemplateValues = { ...baseValues };

  for (const [key, minVal] of Object.entries(SMART_ONE_PAGE_MIN_VALUES)) {
    const maxVal = SMART_ONE_PAGE_MAX_VALUES[key] ?? minVal;

    let progress = 0;
    if (TIER_1_KEYS.has(key)) {
      progress = progress1;
    } else if (TIER_2_KEYS.has(key)) {
      progress = progress2;
    } else if (TIER_3_KEYS.has(key)) {
      progress = progress3;
    }

    const step = SMART_ONE_PAGE_STEPS[key] ?? 1;
    // 从舒适上限 maxVal 向安全下限 minVal 单调过渡
    const interpolated = maxVal - progress * (maxVal - minVal);
    nextValues[key] = Math.max(minVal, Math.min(maxVal, roundToStep(interpolated, step)));
  }

  return nextValues;
};

/**
 * 留白回填优化（Vertical Relaxation / Redistribution）
 * 当内容成功收纳至单页后，若底部由于量子化折行留有较多空白，
 * 在保证不超过单页的前提下，尝试将空白反哺给行高与标题/段落间距，消除底部突兀留白。
 */
export const relaxOnePageCandidate = (
  values: TemplateValues,
  stepMultiplier: number = 1,
): TemplateValues => {
  return {
    ...values,
    h2MarginTop: Math.min(SMART_ONE_PAGE_MAX_VALUES.h2MarginTop, Number(values.h2MarginTop ?? 4) + 2 * stepMultiplier),
    h2MarginBottom: Math.min(SMART_ONE_PAGE_MAX_VALUES.h2MarginBottom, Number(values.h2MarginBottom ?? 2) + 1 * stepMultiplier),
    h3MarginTop: Math.min(SMART_ONE_PAGE_MAX_VALUES.h3MarginTop, Number(values.h3MarginTop ?? 3) + 1 * stepMultiplier),
    paragraphSpacing: Math.min(SMART_ONE_PAGE_MAX_VALUES.paragraphSpacing, Number(values.paragraphSpacing ?? 1) + 1 * stepMultiplier),
    lineHeight: Math.min(SMART_ONE_PAGE_MAX_VALUES.lineHeight, roundToStep(Number(values.lineHeight ?? 1.25) + 0.05 * stepMultiplier, 0.05)),
  };
};

/** Search the same bounded layout candidates in the UI and CLI. */
export const fitOnePage = async (
  baseValues: TemplateValues,
  probePageCount: (values: TemplateValues) => Promise<number>,
): Promise<{ values: TemplateValues; pageCount: number; probes: number }> => {
  let probes = 0;
  const probe = async (values: TemplateValues) => {
    probes += 1;
    return probePageCount(values);
  };

  const minValues = interpolateOnePageValues(baseValues, 1);
  const minPages = await probe(minValues);
  if (minPages > 1) return { values: minValues, pageCount: minPages, probes };

  const maxValues = interpolateOnePageValues(baseValues, 0);
  const maxPages = await probe(maxValues);
  if (maxPages <= 1) return { values: maxValues, pageCount: maxPages, probes };

  let low = 0;
  let high = 1;
  let bestValues = minValues;
  for (let i = 0; i < 6; i++) {
    const mid = (low + high) / 2;
    const candidate = interpolateOnePageValues(baseValues, mid);
    if (await probe(candidate) <= 1) {
      bestValues = candidate;
      high = mid;
    } else {
      low = mid;
    }
  }

  for (let i = 0; i < 4; i++) {
    const candidate = relaxOnePageCandidate(bestValues);
    if (Object.keys(candidate).every((key) => candidate[key] === bestValues[key])) break;
    if (await probe(candidate) > 1) break;
    bestValues = candidate;
  }
  return { values: bestValues, pageCount: 1, probes };
};
