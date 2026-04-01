import { useDebounceFn } from "@vueuse/core";
import { computed, ref, watch } from "vue";
import { defineStore } from "pinia";
import {
  DEFAULT_RESUME_MARKDOWN,
  DEFAULT_TEMPLATE_ID,
  PLAYGROUND_DRAFT_VERSION,
  PLAYGROUND_STORAGE_KEY,
  cloneResumeStyle,
  getBuiltinTemplateById,
  getBuiltinTemplates,
  parseResumeStyleFromTemplateCss,
  type ResumeStyle,
  type WebPlaygroundDraft,
} from "@resume-core";

const templates = getBuiltinTemplates();

const getDefaultResumeStyle = (templateId: string = DEFAULT_TEMPLATE_ID) => {
  return parseResumeStyleFromTemplateCss(
    getBuiltinTemplateById(templateId)?.css ?? "",
  );
};

const createDefaultDraft = (): WebPlaygroundDraft => ({
  version: PLAYGROUND_DRAFT_VERSION,
  markdown: DEFAULT_RESUME_MARKDOWN,
  templateId: DEFAULT_TEMPLATE_ID,
  resumeStyle: getDefaultResumeStyle(DEFAULT_TEMPLATE_ID),
  photoBase64: null,
  updatedAt: new Date().toISOString(),
});

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null;
};

const hasValidCssColor = (value: string) => {
  if (typeof CSS === "undefined" || typeof CSS.supports !== "function") {
    return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value.trim());
  }

  return CSS.supports("color", value.trim());
};

const normalizeResumeStyle = (
  style: Partial<ResumeStyle> | null | undefined,
  templateId: string,
): ResumeStyle => {
  const fallback = getDefaultResumeStyle(templateId);
  const normalized = cloneResumeStyle(style ?? fallback);

  if (!normalized.fontFamily?.trim()) {
    normalized.fontFamily = fallback.fontFamily;
  }

  if (!normalized.themeColor?.trim() || !hasValidCssColor(normalized.themeColor)) {
    normalized.themeColor = fallback.themeColor;
  }

  return normalized;
};

const migrateDraft = (raw: unknown): WebPlaygroundDraft | null => {
  if (!isRecord(raw)) {
    return null;
  }

  const templateId =
    typeof raw.templateId === "string" && getBuiltinTemplateById(raw.templateId)
      ? raw.templateId
      : DEFAULT_TEMPLATE_ID;

  return {
    version: PLAYGROUND_DRAFT_VERSION,
    markdown:
      typeof raw.markdown === "string" ? raw.markdown : DEFAULT_RESUME_MARKDOWN,
    templateId,
    resumeStyle: normalizeResumeStyle(
      isRecord(raw.resumeStyle)
        ? (raw.resumeStyle as Partial<ResumeStyle>)
        : getDefaultResumeStyle(templateId),
      templateId,
    ),
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
  const resumeStyle = ref<ResumeStyle>(getDefaultResumeStyle(DEFAULT_TEMPLATE_ID));
  const photoBase64 = ref<string | null>(null);
  const lastSavedAt = ref<string | null>(null);
  const hydrated = ref(false);

  const currentTemplate = computed(() => {
    return getBuiltinTemplateById(templateId.value) ?? templates[0] ?? null;
  });

  const draft = computed<WebPlaygroundDraft>(() => ({
    version: PLAYGROUND_DRAFT_VERSION,
    markdown: markdown.value,
    templateId: templateId.value,
    resumeStyle: cloneResumeStyle(resumeStyle.value),
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
      resumeStyle.value = initialDraft.resumeStyle;
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
      resumeStyle.value = parsed.resumeStyle;
      photoBase64.value = parsed.photoBase64;
      lastSavedAt.value = parsed.updatedAt;
    } catch {
      const initialDraft = createDefaultDraft();
      markdown.value = initialDraft.markdown;
      templateId.value = initialDraft.templateId;
      resumeStyle.value = initialDraft.resumeStyle;
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
    resumeStyle.value = normalizeResumeStyle(undefined, nextTemplateId);
  };

  const patchResumeStyle = (patch: Partial<ResumeStyle>) => {
    resumeStyle.value = normalizeResumeStyle({
      ...resumeStyle.value,
      ...patch,
    }, templateId.value);
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
    resumeStyle.value = initialDraft.resumeStyle;
    photoBase64.value = initialDraft.photoBase64;
    persistNow();
  };

  watch(
    [markdown, templateId, resumeStyle, photoBase64],
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
    resumeStyle,
    photoBase64,
    lastSavedAt,
    hydrated,
    currentTemplate,
    draft,
    hydrate,
    setTemplate,
    patchResumeStyle,
    updateMarkdown,
    setPhotoBase64,
    uploadPhoto,
    resetDraft,
    persistNow,
  };
});
