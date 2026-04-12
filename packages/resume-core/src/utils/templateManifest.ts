import type {
  PhotoAdjustments,
  PersonalInfoMode,
  ResumeStyle,
  ResumeTemplate,
  TemplateFeatures,
  TemplateFieldSchema,
  TemplateLayoutConfig,
  TemplateManifest,
  TemplateSchemaPreset,
  TemplateValue,
  TemplateValues,
} from "../types/resume";
import { cloneResumeStyle, createDefaultResumeStyle, parseResumeStyleFromTemplateCss } from "./templateStyle";

export const DEFAULT_TEMPLATE_LAYOUT: TemplateLayoutConfig = {
  headerLayout: "stack",
  personalInfoMode: "text",
  photoPlacement: "top-right",
  sectionTitlePreset: "accent-bar",
};

export const DEFAULT_TEMPLATE_FEATURES: TemplateFeatures = {
  photo: true,
  pageFooter: true,
  contactModes: ["text", "icon"],
};

export const DEFAULT_PHOTO_ADJUSTMENTS: PhotoAdjustments = {
  visible: true,
  size: 100,
  offsetX: 0,
  offsetY: 0,
};

const DEFAULT_FONT_OPTIONS = [
  {
    label: "苹方",
    value: '"PingFang SC", "Microsoft YaHei", sans-serif',
  },
  {
    label: "微软雅黑",
    value: '"Microsoft YaHei", "PingFang SC", sans-serif',
  },
  {
    label: "黑体",
    value: '"SimHei", "Microsoft YaHei", sans-serif',
  },
  {
    label: "宋体",
    value: '"SimSun", "Times New Roman", serif',
  },
  {
    label: "Helvetica",
    value: "Helvetica, Arial, sans-serif",
  },
  {
    label: "Arial",
    value: "Arial, sans-serif",
  },
  {
    label: "Times New Roman",
    value: '"Times New Roman", Times, serif',
  },
] as const;

const DEFAULT_DATE_WEIGHT_OPTIONS = [
  { label: "常规", value: "400" },
  { label: "加粗", value: "700" },
] as const;

const DEFAULT_HEADER_LAYOUT_OPTIONS = [
  { label: "纵向堆叠", value: "stack" },
  { label: "左右分栏", value: "split" },
  { label: "横向对齐", value: "inline" },
] as const;

const DEFAULT_PERSONAL_INFO_MODE_OPTIONS = [
  { label: "文字", value: "text" },
  { label: "图标", value: "icon" },
  { label: "标签", value: "chips" },
] as const;

const DEFAULT_PHOTO_PLACEMENT_OPTIONS = [
  { label: "右上角", value: "top-right" },
  { label: "左上角", value: "top-left" },
  { label: "抬头右侧", value: "header-right" },
  { label: "隐藏", value: "hidden" },
] as const;

const DEFAULT_SECTION_TITLE_OPTIONS = [
  { label: "强调条", value: "accent-bar" },
  { label: "下划线", value: "underline" },
  { label: "纯文字", value: "plain" },
] as const;

export const DEFAULT_TEMPLATE_EDITOR_SCHEMA: TemplateFieldSchema[] = [
  {
    key: "themeColor",
    type: "color",
    label: "主题色",
    group: "基础",
  },
  {
    key: "fontFamily",
    type: "select",
    label: "字体",
    group: "基础",
    options: [...DEFAULT_FONT_OPTIONS],
  },
  {
    key: "fontSize",
    type: "number",
    label: "正文字号",
    group: "字号",
    min: 11,
    max: 16,
    step: 1,
    unit: "px",
  },
  {
    key: "h1Size",
    type: "number",
    label: "H1 标题",
    group: "字号",
    min: 24,
    max: 34,
    step: 1,
    unit: "px",
  },
  {
    key: "h2Size",
    type: "number",
    label: "H2 标题",
    group: "字号",
    min: 14,
    max: 22,
    step: 1,
    unit: "px",
  },
  {
    key: "h3Size",
    type: "number",
    label: "H3 标题",
    group: "字号",
    min: 12,
    max: 18,
    step: 1,
    unit: "px",
  },
  {
    key: "dateSize",
    type: "number",
    label: "日期字号",
    group: "字号",
    min: 11,
    max: 16,
    step: 1,
    unit: "px",
  },
  {
    key: "dateWeight",
    type: "select",
    label: "日期字重",
    group: "字号",
    options: [...DEFAULT_DATE_WEIGHT_OPTIONS],
  },
  {
    key: "lineHeight",
    type: "number",
    label: "行高",
    group: "间距",
    min: 1,
    max: 2.5,
    step: 0.1,
  },
  {
    key: "paragraphSpacing",
    type: "number",
    label: "正文块间距",
    group: "间距",
    min: 0,
    max: 20,
    step: 1,
    unit: "px",
  },
  {
    key: "h2MarginTop",
    type: "number",
    label: "H2 上边距",
    group: "间距",
    min: 2,
    max: 24,
    step: 1,
    unit: "px",
  },
  {
    key: "h2MarginBottom",
    type: "number",
    label: "H2 下边距",
    group: "间距",
    min: 2,
    max: 24,
    step: 1,
    unit: "px",
  },
  {
    key: "h3MarginTop",
    type: "number",
    label: "H3 上边距",
    group: "间距",
    min: 2,
    max: 12,
    step: 1,
    unit: "px",
  },
  {
    key: "h3MarginBottom",
    type: "number",
    label: "H3 下边距",
    group: "间距",
    min: 2,
    max: 12,
    step: 1,
    unit: "px",
  },
  {
    key: "personalHeaderSpacing",
    type: "number",
    label: "个人信息间距",
    group: "间距",
    min: 2,
    max: 24,
    step: 1,
    unit: "px",
  },
  {
    key: "marginV",
    type: "number",
    label: "上下页边距",
    group: "间距",
    min: 8,
    max: 20,
    step: 1,
    unit: "mm",
  },
  {
    key: "marginH",
    type: "number",
    label: "左右页边距",
    group: "间距",
    min: 8,
    max: 20,
    step: 1,
    unit: "mm",
  },
  {
    key: "headerLayout",
    type: "select",
    label: "抬头布局",
    group: "布局",
    options: [...DEFAULT_HEADER_LAYOUT_OPTIONS],
  },
  {
    key: "personalInfoMode",
    type: "select",
    label: "个人信息",
    group: "布局",
    options: [...DEFAULT_PERSONAL_INFO_MODE_OPTIONS],
  },
  {
    key: "photoPlacement",
    type: "select",
    label: "照片位置",
    group: "布局",
    options: [...DEFAULT_PHOTO_PLACEMENT_OPTIONS],
  },
  {
    key: "photoVisible",
    type: "boolean",
    label: "显示照片",
    group: "布局",
  },
  {
    key: "photoSize",
    type: "number",
    label: "照片大小",
    group: "布局",
    min: 88,
    max: 112,
    step: 1,
    unit: "%",
  },
  {
    key: "photoOffsetY",
    type: "number",
    label: "上下位置",
    group: "布局",
    min: -24,
    max: 24,
    step: 1,
    unit: "px",
  },
  {
    key: "photoOffsetX",
    type: "number",
    label: "左右位置",
    group: "布局",
    min: -24,
    max: 24,
    step: 1,
    unit: "px",
  },
  {
    key: "sectionTitlePreset",
    type: "select",
    label: "二级标题样式",
    group: "布局",
    options: [...DEFAULT_SECTION_TITLE_OPTIONS],
  },
];

export const DEFAULT_TEMPLATE_SCHEMA_PRESET: TemplateSchemaPreset = "standard";

const TEMPLATE_VALUE_KEYS = [
  "themeColor",
  "fontFamily",
  "fontSize",
  "paragraphSpacing",
  "h2MarginTop",
  "h2MarginBottom",
  "h3MarginTop",
  "h3MarginBottom",
  "personalHeaderSpacing",
  "h1Size",
  "h2Size",
  "h3Size",
  "dateSize",
  "dateWeight",
  "lineHeight",
  "marginV",
  "marginH",
  "personalInfoMode",
  "headerLayout",
  "photoPlacement",
  "photoVisible",
  "photoSize",
  "photoOffsetX",
  "photoOffsetY",
  "sectionTitlePreset",
] as const;

type TemplateValueKey = (typeof TEMPLATE_VALUE_KEYS)[number];

const isTemplateValue = (value: unknown): value is TemplateValue =>
  typeof value === "string" ||
  typeof value === "number" ||
  typeof value === "boolean";

const toTemplateValues = (record?: Record<string, unknown> | null): TemplateValues => {
  const nextValues: TemplateValues = {};

  for (const [key, value] of Object.entries(record ?? {})) {
    if (isTemplateValue(value)) {
      nextValues[key] = value;
    }
  }

  return nextValues;
};

export const resumeStyleToTemplateValues = (
  style?: Partial<ResumeStyle> | null,
): TemplateValues => {
  const normalized = cloneResumeStyle(style);

  return {
    themeColor: normalized.themeColor,
    fontFamily: normalized.fontFamily,
    fontSize: normalized.fontSize,
    paragraphSpacing: normalized.paragraphSpacing,
    h2MarginTop: normalized.h2MarginTop,
    h2MarginBottom: normalized.h2MarginBottom,
    h3MarginTop: normalized.h3MarginTop,
    h3MarginBottom: normalized.h3MarginBottom,
    personalHeaderSpacing: normalized.personalHeaderSpacing,
    h1Size: normalized.h1Size,
    h2Size: normalized.h2Size,
    h3Size: normalized.h3Size,
    dateSize: normalized.dateSize ?? normalized.fontSize,
    dateWeight: normalized.dateWeight ?? "400",
    lineHeight: normalized.lineHeight,
    marginV: normalized.marginV,
    marginH: normalized.marginH,
    personalInfoMode: normalized.personalInfoMode ?? "text",
    headerLayout: DEFAULT_TEMPLATE_LAYOUT.headerLayout,
    photoPlacement: DEFAULT_TEMPLATE_LAYOUT.photoPlacement,
    photoVisible: DEFAULT_PHOTO_ADJUSTMENTS.visible,
    photoSize: DEFAULT_PHOTO_ADJUSTMENTS.size,
    photoOffsetX: DEFAULT_PHOTO_ADJUSTMENTS.offsetX,
    photoOffsetY: DEFAULT_PHOTO_ADJUSTMENTS.offsetY,
    sectionTitlePreset: DEFAULT_TEMPLATE_LAYOUT.sectionTitlePreset,
  };
};

const toClampedNumber = (value: TemplateValue | undefined, fallback: number) => {
  const numericValue =
    typeof value === "number" ? value : Number.parseFloat(String(value ?? ""));

  return Number.isFinite(numericValue) ? numericValue : fallback;
};

export const resolvePhotoAdjustments = (
  values?: TemplateValues | null,
): PhotoAdjustments => ({
  visible:
    typeof values?.photoVisible === "boolean"
      ? values.photoVisible
      : DEFAULT_PHOTO_ADJUSTMENTS.visible,
  size: toClampedNumber(values?.photoSize, DEFAULT_PHOTO_ADJUSTMENTS.size),
  offsetX: toClampedNumber(
    values?.photoOffsetX,
    DEFAULT_PHOTO_ADJUSTMENTS.offsetX,
  ),
  offsetY: toClampedNumber(
    values?.photoOffsetY,
    DEFAULT_PHOTO_ADJUSTMENTS.offsetY,
  ),
});

export const createDefaultTemplateValues = (): TemplateValues =>
  resumeStyleToTemplateValues(createDefaultResumeStyle());

const normalizeTemplateLayout = (
  layout?: Partial<TemplateLayoutConfig> | null,
  defaults?: TemplateValues,
): TemplateLayoutConfig => ({
  ...DEFAULT_TEMPLATE_LAYOUT,
  personalInfoMode:
    (typeof defaults?.personalInfoMode === "string"
      ? (defaults.personalInfoMode as PersonalInfoMode)
      : undefined) ?? DEFAULT_TEMPLATE_LAYOUT.personalInfoMode,
  ...layout,
});

const normalizeTemplateFeatures = (
  features?: TemplateFeatures | null,
): TemplateFeatures => ({
  ...DEFAULT_TEMPLATE_FEATURES,
  ...features,
});

const cloneTemplateFieldSchema = (field: TemplateFieldSchema): TemplateFieldSchema => ({
  ...field,
  options: field.options?.map((option) => ({ ...option })),
});

export const getTemplateSchemaPreset = (
  preset?: TemplateSchemaPreset | null,
): TemplateFieldSchema[] => {
  switch (preset ?? DEFAULT_TEMPLATE_SCHEMA_PRESET) {
    case "standard":
    default:
      return DEFAULT_TEMPLATE_EDITOR_SCHEMA.map(cloneTemplateFieldSchema);
  }
};

const mergeTemplateFieldSchema = (
  baseSchema: TemplateFieldSchema[],
  overrides?: TemplateFieldSchema[] | null,
): TemplateFieldSchema[] => {
  if (!overrides?.length) {
    return baseSchema.map(cloneTemplateFieldSchema);
  }

  const mergedSchema = baseSchema.map(cloneTemplateFieldSchema);

  for (const override of overrides) {
    const nextField = cloneTemplateFieldSchema(override);
    const existingIndex = mergedSchema.findIndex((field) => field.key === nextField.key);

    if (existingIndex >= 0) {
      mergedSchema[existingIndex] = {
        ...mergedSchema[existingIndex],
        ...nextField,
      };
      continue;
    }

    mergedSchema.push(nextField);
  }

  return mergedSchema;
};

export const normalizeTemplateFieldSchema = (
  schema?: TemplateFieldSchema[] | null,
  options: {
    preset?: TemplateSchemaPreset | null;
    overrides?: TemplateFieldSchema[] | null;
  } = {},
): TemplateFieldSchema[] => {
  const baseSchema = schema?.length
    ? schema.map(cloneTemplateFieldSchema)
    : getTemplateSchemaPreset(options.preset);

  return mergeTemplateFieldSchema(baseSchema, options.overrides);
};

const sanitizeValueForField = (
  value: TemplateValue | undefined,
  field: TemplateFieldSchema | undefined,
  fallback: TemplateValue,
): TemplateValue => {
  if (value === undefined) {
    return fallback;
  }

  if (!field) {
    return value;
  }

  if (field.type === "number") {
    const numericValue =
      typeof value === "number" ? value : Number.parseFloat(String(value));
    if (!Number.isFinite(numericValue)) {
      return fallback;
    }

    const min = typeof field.min === "number" ? field.min : numericValue;
    const max = typeof field.max === "number" ? field.max : numericValue;
    return Math.min(max, Math.max(min, numericValue));
  }

  if (field.type === "boolean") {
    return typeof value === "boolean" ? value : fallback;
  }

  if (field.type === "select" && field.options?.length) {
    const rawValue = String(value);
    return field.options.some((option) => String(option.value) === rawValue)
      ? rawValue
      : fallback;
  }

  return typeof value === "string" ? value : String(value);
};

const normalizeTemplateValues = (
  defaults: TemplateValues,
  schema: TemplateFieldSchema[],
  values?: TemplateValues | null,
): TemplateValues => {
  const fieldMap = new Map(schema.map((field) => [field.key, field]));
  const nextValues: TemplateValues = { ...defaults };

  for (const key of Object.keys(values ?? {})) {
    const value = values?.[key];
    const fallback = defaults[key];
    if (fallback === undefined || value === undefined) {
      continue;
    }

    nextValues[key] = sanitizeValueForField(value, fieldMap.get(key), fallback);
  }

  return nextValues;
};

export const normalizeTemplateManifest = (
  manifest: Partial<TemplateManifest> &
    Pick<TemplateManifest, "id" | "name" | "entryCss">,
): TemplateManifest => {
  const editorSchema = normalizeTemplateFieldSchema(manifest.editorSchema, {
    preset: manifest.schemaPreset,
    overrides: manifest.editorSchemaOverrides,
  });
  const defaults = normalizeTemplateValues(
    {
      ...createDefaultTemplateValues(),
      ...toTemplateValues(manifest.defaults),
    },
    editorSchema,
  );
  const layout = normalizeTemplateLayout(manifest.layout, defaults);

  defaults.personalInfoMode = layout.personalInfoMode;
  defaults.headerLayout = layout.headerLayout;
  defaults.photoPlacement = layout.photoPlacement;
  defaults.sectionTitlePreset = layout.sectionTitlePreset;

  return {
    id: manifest.id,
    name: manifest.name,
    version: manifest.version ?? "1.0.0",
    entryCss: manifest.entryCss,
    description: manifest.description,
    defaults,
    schemaPreset: manifest.schemaPreset,
    editorSchema,
    editorSchemaOverrides: manifest.editorSchemaOverrides?.map(cloneTemplateFieldSchema),
    features: normalizeTemplateFeatures(manifest.features),
    layout,
  };
};

export const createLegacyTemplateManifest = (
  id: string,
  name: string,
  css: string,
): TemplateManifest => {
  const legacyStyle = parseResumeStyleFromTemplateCss(css);
  const defaults = resumeStyleToTemplateValues(legacyStyle);
  const layout = normalizeTemplateLayout(
    {
      personalInfoMode: legacyStyle.personalInfoMode ?? "text",
    },
    defaults,
  );

  defaults.personalInfoMode = layout.personalInfoMode;
  defaults.headerLayout = layout.headerLayout;
  defaults.photoPlacement = layout.photoPlacement;
  defaults.sectionTitlePreset = layout.sectionTitlePreset;

  return {
    id,
    name,
    version: "1.0.0",
    entryCss: "style.css",
    defaults,
    schemaPreset: DEFAULT_TEMPLATE_SCHEMA_PRESET,
    editorSchema: normalizeTemplateFieldSchema(undefined, {
      preset: DEFAULT_TEMPLATE_SCHEMA_PRESET,
    }),
    features: normalizeTemplateFeatures(undefined),
    layout,
  };
};

export const normalizeResumeTemplate = (
  template: Omit<ResumeTemplate, "defaults" | "editorSchema" | "features" | "layout" | "version" | "entryCss"> &
    Partial<Pick<ResumeTemplate, "defaults" | "editorSchema" | "features" | "layout" | "version" | "entryCss">>,
): ResumeTemplate => {
  const manifest = normalizeTemplateManifest({
    id: template.id,
    name: template.name,
    version: template.version,
    entryCss: template.entryCss ?? "style.css",
    description: template.description,
    schemaPreset: template.schemaPreset,
    defaults: template.defaults,
    editorSchema: template.editorSchema,
    editorSchemaOverrides: template.editorSchemaOverrides,
    features: template.features,
    layout: template.layout,
  });

  return {
    ...manifest,
    editorSchema: manifest.editorSchema ?? normalizeTemplateFieldSchema(undefined, {
      preset: manifest.schemaPreset,
      overrides: manifest.editorSchemaOverrides,
    }),
    css: template.css,
  };
};

export const resolveTemplateValues = (
  template: Pick<ResumeTemplate, "defaults" | "editorSchema">,
  values?: TemplateValues | null,
): TemplateValues =>
  normalizeTemplateValues(template.defaults, template.editorSchema, values);

export const templateValuesToResumeStyle = (
  values?: TemplateValues | null,
): ResumeStyle => {
  const normalized = values ?? createDefaultTemplateValues();

  return cloneResumeStyle({
    themeColor: String(normalized.themeColor ?? createDefaultResumeStyle().themeColor),
    fontFamily: String(normalized.fontFamily ?? createDefaultResumeStyle().fontFamily),
    fontSize: Number(normalized.fontSize ?? createDefaultResumeStyle().fontSize),
    paragraphSpacing: Number(
      normalized.paragraphSpacing ?? createDefaultResumeStyle().paragraphSpacing,
    ),
    h2MarginTop: Number(
      normalized.h2MarginTop ?? createDefaultResumeStyle().h2MarginTop,
    ),
    h2MarginBottom: Number(
      normalized.h2MarginBottom ?? createDefaultResumeStyle().h2MarginBottom,
    ),
    h3MarginTop: Number(
      normalized.h3MarginTop ?? createDefaultResumeStyle().h3MarginTop,
    ),
    h3MarginBottom: Number(
      normalized.h3MarginBottom ?? createDefaultResumeStyle().h3MarginBottom,
    ),
    personalHeaderSpacing: Number(
      normalized.personalHeaderSpacing ??
        createDefaultResumeStyle().personalHeaderSpacing,
    ),
    h1Size: Number(normalized.h1Size ?? createDefaultResumeStyle().h1Size),
    h2Size: Number(normalized.h2Size ?? createDefaultResumeStyle().h2Size),
    h3Size: Number(normalized.h3Size ?? createDefaultResumeStyle().h3Size),
    dateSize: Number(normalized.dateSize ?? createDefaultResumeStyle().dateSize),
    dateWeight: String(
      normalized.dateWeight ?? createDefaultResumeStyle().dateWeight ?? "400",
    ),
    lineHeight: Number(
      normalized.lineHeight ?? createDefaultResumeStyle().lineHeight,
    ),
    marginV: Number(normalized.marginV ?? createDefaultResumeStyle().marginV),
    marginH: Number(normalized.marginH ?? createDefaultResumeStyle().marginH),
    personalInfoMode: String(
      normalized.personalInfoMode ??
        createDefaultResumeStyle().personalInfoMode ??
        "text",
    ) as PersonalInfoMode,
  });
};

export const resolveResumeStyle = (
  template: Pick<ResumeTemplate, "defaults" | "editorSchema">,
  values?: TemplateValues | null,
): ResumeStyle => templateValuesToResumeStyle(resolveTemplateValues(template, values));

export const extractTemplateValueOverrides = (
  template: Pick<ResumeTemplate, "defaults" | "editorSchema">,
  values?: TemplateValues | null,
): TemplateValues => {
  const resolvedValues = resolveTemplateValues(template, values);
  const nextOverrides: TemplateValues = {};

  for (const key of Object.keys(resolvedValues)) {
    if (resolvedValues[key] !== template.defaults[key]) {
      nextOverrides[key] = resolvedValues[key];
    }
  }

  return nextOverrides;
};

export const migrateLegacyResumeStyle = (
  template: Pick<ResumeTemplate, "defaults" | "editorSchema">,
  style?: Partial<ResumeStyle> | null,
): TemplateValues => {
  const migratedValues = {
    ...resumeStyleToTemplateValues(style),
    personalInfoMode:
      style?.personalInfoMode ?? template.defaults.personalInfoMode ?? "text",
  };

  return extractTemplateValueOverrides(template, migratedValues);
};

export const getTemplateLayoutValue = (
  values: TemplateValues,
  key: Extract<
    TemplateValueKey,
    "headerLayout" | "personalInfoMode" | "photoPlacement" | "sectionTitlePreset"
  >,
) => values[key];
