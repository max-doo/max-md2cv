import { useDebounceFn } from "@vueuse/core";
import { computed, ref, watch } from "vue";
import { defineStore } from "pinia";
import {
  DEFAULT_RESUME_MARKDOWN,
  DEFAULT_TEMPLATE_ID,
  PLAYGROUND_DRAFT_VERSION,
  PLAYGROUND_STORAGE_KEY,
  extractTemplateValueOverrides,
  getBuiltinTemplateById,
  getBuiltinTemplates,
  migrateLegacyResumeStyle,
  resolveResumeStyle,
  resolveTemplateValues,
  type TemplateValue,
  type TemplateValues,
  type WebPlaygroundDraft,
} from "@resume-core";

const templates = getBuiltinTemplates();

const getTemplateDefinition = (templateId: string = DEFAULT_TEMPLATE_ID) =>
  getBuiltinTemplateById(templateId) ?? templates[0] ?? null;

const createDefaultDraft = (): WebPlaygroundDraft => ({
  version: PLAYGROUND_DRAFT_VERSION,
  markdown: DEFAULT_RESUME_MARKDOWN,
  templateId: DEFAULT_TEMPLATE_ID,
  values: {},
  photoBase64: null,
  updatedAt: new Date().toISOString(),
});

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null;
};

const migrateDraft = (raw: unknown): WebPlaygroundDraft | null => {
  if (!isRecord(raw)) {
    return null;
  }

  const templateId =
    typeof raw.templateId === "string" && getBuiltinTemplateById(raw.templateId)
      ? raw.templateId
      : DEFAULT_TEMPLATE_ID;
  const template = getTemplateDefinition(templateId);

  if (!template) {
    return createDefaultDraft();
  }

  let values: TemplateValues = {};

  if (isRecord(raw.values)) {
    values = extractTemplateValueOverrides(
      template,
      raw.values as Record<string, TemplateValue>,
    );
  } else if (isRecord(raw.resumeStyle)) {
    values = migrateLegacyResumeStyle(
      template,
      raw.resumeStyle as Record<string, unknown>,
    );
  }

  return {
    version: PLAYGROUND_DRAFT_VERSION,
    markdown:
      typeof raw.markdown === "string" ? raw.markdown : DEFAULT_RESUME_MARKDOWN,
    templateId,
    values,
    photoBase64:
      typeof raw.photoBase64 === "string" ? raw.photoBase64 : null,
    updatedAt:
      typeof raw.updatedAt === "string"
        ? raw.updatedAt
        : new Date().toISOString(),
  };
};

const readFileAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("文件读取失败"));
    reader.readAsDataURL(file);
  });

export const usePlaygroundStore = defineStore("web-playground", () => {
  const markdown = ref(DEFAULT_RESUME_MARKDOWN);
  const templateId = ref<string>(DEFAULT_TEMPLATE_ID);
  const templateValues = ref<TemplateValues>({});
  const photoBase64 = ref<string | null>(null);
  const lastSavedAt = ref<string | null>(null);
  const hydrated = ref(false);

  const currentTemplate = computed(() => {
    return getTemplateDefinition(templateId.value);
  });

  const resumeStyle = computed(() => {
    if (!currentTemplate.value) {
      return resolveResumeStyle(
        {
          defaults: {},
          editorSchema: [],
        },
        templateValues.value,
      );
    }

    return resolveResumeStyle(currentTemplate.value, templateValues.value);
  });

  const draft = computed<WebPlaygroundDraft>(() => ({
    version: PLAYGROUND_DRAFT_VERSION,
    markdown: markdown.value,
    templateId: templateId.value,
    values: currentTemplate.value
      ? extractTemplateValueOverrides(currentTemplate.value, templateValues.value)
      : { ...templateValues.value },
    photoBase64: photoBase64.value,
    updatedAt: new Date().toISOString(),
  }));

  const persistNow = () => {
    const snapshot = draft.value;
    localStorage.setItem(PLAYGROUND_STORAGE_KEY, JSON.stringify(snapshot));
    lastSavedAt.value = snapshot.updatedAt;
  };

  const persistDraft = useDebounceFn(persistNow, 280);

  const hydrate = () => {
    const raw = localStorage.getItem(PLAYGROUND_STORAGE_KEY);
    if (!raw) {
      const initialDraft = createDefaultDraft();
      markdown.value = initialDraft.markdown;
      templateId.value = initialDraft.templateId;
      templateValues.value = initialDraft.values;
      photoBase64.value = initialDraft.photoBase64;
      lastSavedAt.value = initialDraft.updatedAt;
      hydrated.value = true;
      persistNow();
      return;
    }

    try {
      const parsed = migrateDraft(JSON.parse(raw)) ?? createDefaultDraft();
      markdown.value = parsed.markdown;
      templateId.value = parsed.templateId;
      templateValues.value = parsed.values;
      photoBase64.value = parsed.photoBase64;
      lastSavedAt.value = parsed.updatedAt;
    } catch {
      const initialDraft = createDefaultDraft();
      markdown.value = initialDraft.markdown;
      templateId.value = initialDraft.templateId;
      templateValues.value = initialDraft.values;
      photoBase64.value = initialDraft.photoBase64;
      lastSavedAt.value = initialDraft.updatedAt;
    }

    hydrated.value = true;
  };

  const setTemplate = (nextTemplateId: string) => {
    if (!getBuiltinTemplateById(nextTemplateId)) {
      return;
    }

    templateId.value = nextTemplateId;
    templateValues.value = {};
  };

  const setTemplateValue = (key: string, value: TemplateValue) => {
    if (!currentTemplate.value) {
      templateValues.value = {
        ...templateValues.value,
        [key]: value,
      };
      return;
    }

    const nextResolvedValues = resolveTemplateValues(currentTemplate.value, {
      ...templateValues.value,
      [key]: value,
    });
    templateValues.value = extractTemplateValueOverrides(
      currentTemplate.value,
      nextResolvedValues,
    );
  };

  const updateMarkdown = (value: string) => {
    markdown.value = value;
  };

  const setPhotoBase64 = (value: string | null) => {
    photoBase64.value = value;
  };

  const uploadPhoto = async (file: File) => {
    if (file.size > 1024 * 1024) {
      throw new Error("头像图片请控制在 1MB 以内");
    }

    setPhotoBase64(await readFileAsDataUrl(file));
  };

  const resetDraft = () => {
    const initialDraft = createDefaultDraft();
    markdown.value = initialDraft.markdown;
    templateId.value = initialDraft.templateId;
    templateValues.value = initialDraft.values;
    photoBase64.value = initialDraft.photoBase64;
    persistNow();
  };

  watch(
    [markdown, templateId, templateValues, photoBase64],
    () => {
      if (!hydrated.value) {
        return;
      }

      persistDraft();
    },
    { deep: true },
  );

  return {
    templates,
    markdown,
    templateId,
    templateValues,
    resumeStyle,
    photoBase64,
    lastSavedAt,
    hydrated,
    currentTemplate,
    draft,
    hydrate,
    setTemplate,
    setTemplateValue,
    updateMarkdown,
    setPhotoBase64,
    uploadPhoto,
    resetDraft,
    persistNow,
  };
});
