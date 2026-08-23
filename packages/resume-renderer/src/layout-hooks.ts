import type {
  PersonalInfoMode,
  TemplateHeaderLayout,
  TemplatePhotoPlacement,
  TemplateSectionTitlePreset,
} from "../../resume-core/src/domain";

export interface ResumeLayoutConfig {
  headerLayout: TemplateHeaderLayout;
  personalInfoMode: PersonalInfoMode;
  photoPlacement: TemplatePhotoPlacement;
  sectionTitlePreset: TemplateSectionTitlePreset;
}

export const applyResumeDocumentLayoutHooks = (
  documentRoot: HTMLElement,
  layoutConfig: ResumeLayoutConfig,
  photoVisible: boolean,
) => {
  documentRoot.dataset.headerLayout = layoutConfig.headerLayout;
  documentRoot.dataset.personalInfoMode = layoutConfig.personalInfoMode;
  documentRoot.dataset.photoPlacement = layoutConfig.photoPlacement;
  documentRoot.dataset.photoVisible = photoVisible ? "true" : "false";
  documentRoot.dataset.sectionTitlePreset = layoutConfig.sectionTitlePreset;

  const photoWrapper = documentRoot.querySelector(
    ":scope > .resume-photo-wrapper",
  ) as HTMLElement | null;
  const primaryTitle = documentRoot.querySelector(":scope > h1") as HTMLElement | null;
  const personalHeader = documentRoot.querySelector(
    ":scope > .personal-header",
  ) as HTMLElement | null;

  if (!photoWrapper && !primaryTitle && !personalHeader) {
    return null;
  }

  const headerWrapper = document.createElement("div");
  headerWrapper.className = "resume-header";

  const headerBody = document.createElement("div");
  headerBody.className = "resume-header-body";

  const headerMain = document.createElement("div");
  headerMain.className = "resume-header-main";

  const headerMeta = document.createElement("div");
  headerMeta.className = "resume-header-meta";

  const headerPhoto = document.createElement("div");
  headerPhoto.className = "resume-header-photo";

  if (primaryTitle) headerMain.appendChild(primaryTitle);
  if (personalHeader) headerMeta.appendChild(personalHeader);
  if (headerMain.childElementCount > 0) headerBody.appendChild(headerMain);
  if (headerMeta.childElementCount > 0) headerBody.appendChild(headerMeta);
  if (headerBody.childElementCount > 0) headerWrapper.appendChild(headerBody);

  if (photoWrapper) {
    headerPhoto.appendChild(photoWrapper);
    headerWrapper.appendChild(headerPhoto);
  }

  documentRoot.prepend(headerWrapper);

  if (
    photoWrapper &&
    photoVisible &&
    layoutConfig.photoPlacement !== "header-right" &&
    layoutConfig.photoPlacement !== "hidden"
  ) {
    headerBody.classList.add("dodge-photo");
  }

  return { photoWrapper, headerBody };
};

export const createPhotoMarkup = (photoDataUrl: string | null): HTMLDivElement => {
  const wrapper = document.createElement("div");
  wrapper.className = `resume-photo-wrapper ${photoDataUrl ? "has-photo" : "is-empty"}`;
  wrapper.title = "Resume photo";

  if (photoDataUrl) {
    const image = document.createElement("img");
    image.alt = "Resume photo";
    image.src = photoDataUrl;
    wrapper.appendChild(image);
  } else {
    const placeholder = document.createElement("span");
    placeholder.className = "photo-placeholder-label";
    placeholder.textContent = "Photo";
    wrapper.appendChild(placeholder);
  }

  return wrapper;
};
