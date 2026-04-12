import type { PhotoAdjustments, ResumeStyle } from "@resume-core";

interface RuntimeResumeStyleOptions {
  includePageRule?: boolean;
  includeContactIconRules?: boolean;
  extraCss?: string;
  photoAdjustments?: PhotoAdjustments;
}

export const buildRuntimeResumeStyleCss = (
  cvStyle: ResumeStyle,
  options: RuntimeResumeStyleOptions = {},
): string => {
  const {
    includePageRule = true,
    includeContactIconRules = true,
    extraCss = "",
    photoAdjustments,
  } = options;

  const resolvedPhotoAdjustments = photoAdjustments ?? {
    visible: true,
    size: 100,
    offsetX: 0,
    offsetY: 0,
  };

  return `
  ${extraCss}
  ${includePageRule
    ? `@page {
    size: A4;
    margin: ${cvStyle.marginV}mm ${cvStyle.marginH}mm;
    @bottom-right {
      content: counter(page) " / " counter(pages);
      font-size: 10px;
      color: #c7c4d6;
      font-family: 'Manrope', sans-serif;
      letter-spacing: 0.1em;
    }
  }`
    : ""}
  .resume-document {
    --cv-photo-size-factor: ${resolvedPhotoAdjustments.size / 100};
    --cv-photo-offset-x: ${resolvedPhotoAdjustments.offsetX}px;
    --cv-photo-offset-y: ${resolvedPhotoAdjustments.offsetY}px;
    --cv-photo-width: calc(84px * var(--cv-photo-size-factor));
    --cv-photo-height: calc(112px * var(--cv-photo-size-factor));
    --cv-photo-gap: 12px;
    --cv-photo-radius: 8px;
    --cv-photo-base-reserve: calc(var(--cv-photo-width) + var(--cv-photo-gap));
    --tpl-theme-color: ${cvStyle.themeColor};
    --tpl-font-family: ${cvStyle.fontFamily};
    --tpl-font-size: ${cvStyle.fontSize}px;
    --tpl-line-height: ${cvStyle.lineHeight};
    --tpl-paragraph-spacing: ${cvStyle.paragraphSpacing}px;
    --tpl-h1-size: ${cvStyle.h1Size}px;
    --tpl-h2-size: ${cvStyle.h2Size}px;
    --tpl-h3-size: ${cvStyle.h3Size}px;
    --tpl-h2-margin-top: ${cvStyle.h2MarginTop}px;
    --tpl-h2-margin-bottom: ${cvStyle.h2MarginBottom}px;
    --tpl-h3-margin-top: ${cvStyle.h3MarginTop}px;
    --tpl-h3-margin-bottom: ${cvStyle.h3MarginBottom}px;
    --tpl-date-size: ${cvStyle.dateSize ?? cvStyle.fontSize}px;
    --tpl-date-weight: ${cvStyle.dateWeight ?? "400"};
    --tpl-personal-header-spacing: ${cvStyle.personalHeaderSpacing}px;
    --tpl-page-margin-v: ${cvStyle.marginV}mm;
    --tpl-page-margin-h: ${cvStyle.marginH}mm;
    --cv-theme-color: var(--tpl-theme-color);
    --cv-font-size: var(--tpl-font-size);
    --cv-paragraph-spacing: var(--tpl-paragraph-spacing);
    --cv-h2-margin-top: var(--tpl-h2-margin-top);
    --cv-h2-margin-bottom: var(--tpl-h2-margin-bottom);
    --cv-h3-margin-top: var(--tpl-h3-margin-top);
    --cv-h3-margin-bottom: var(--tpl-h3-margin-bottom);
    --cv-personal-header-spacing: var(--tpl-personal-header-spacing);
    font-family: ${cvStyle.fontFamily} !important;
    font-size: var(--tpl-font-size) !important;
    line-height: var(--tpl-line-height) !important;
    position: relative !important;
    --cv-date-weight: var(--tpl-date-weight);
    --cv-date-size: var(--tpl-date-size);
  }
  .resume-document .resume-photo-wrapper {
    position: absolute !important;
    top: 0;
    right: 0;
    width: var(--cv-photo-width);
    height: var(--cv-photo-height);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
    cursor: pointer;
    z-index: 10;
    transform: translate(var(--cv-photo-offset-x), var(--cv-photo-offset-y));
    transition: border-color 0.2s ease, background-color 0.2s ease, box-shadow 0.2s ease;
  }
  .resume-document .resume-photo-wrapper.is-empty {
    background-color: #f8f9fa;
    border: 1px dashed #ced4da;
    border-radius: var(--cv-photo-radius);
    overflow: hidden;
  }
  .resume-document > .resume-photo-wrapper.is-empty:hover {
    border-color: ${cvStyle.themeColor};
    background-color: color-mix(in srgb, ${cvStyle.themeColor} 5%, #f8f9fa);
  }
  .resume-document .resume-photo-wrapper.has-photo {
    background: transparent;
    border: none;
    border-radius: 0;
    overflow: visible;
    box-shadow: none;
  }
  .resume-document > .resume-photo-wrapper.has-photo:hover {
    background: transparent;
    border: none;
    box-shadow: none;
  }
  .resume-document .resume-photo-wrapper img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
    border: none !important;
    border-radius: 0 !important;
    box-shadow: none !important;
    filter: none !important;
    clip-path: none !important;
    background: transparent;
  }
  .resume-document .resume-photo-wrapper.has-photo img {
    position: absolute;
    inset: 0;
  }
  .resume-document > .resume-photo-wrapper .photo-placeholder-text {
    color: #adb5bd;
    font-size: 12px;
    text-align: center;
    line-height: 1.2;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    padding: 12px;
    box-sizing: border-box;
  }
  .resume-document .dodge-photo:not(h2) {
    box-sizing: border-box;
  }
  .resume-document[data-photo-placement="top-right"] .dodge-photo:not(h2) {
    padding-right: calc(var(--cv-photo-base-reserve) + max(0px, var(--cv-photo-offset-x))) !important;
  }
  .resume-document h1 {
    font-size: var(--tpl-h1-size) !important;
  }
  .resume-document h2 {
    font-size: var(--tpl-h2-size) !important;
    margin-top: var(--tpl-h2-margin-top) !important;
    margin-bottom: var(--tpl-h2-margin-bottom) !important;
  }
  .resume-document h3 {
    font-size: var(--tpl-h3-size) !important;
    margin-top: var(--tpl-h3-margin-top) !important;
    margin-bottom: var(--tpl-h3-margin-bottom) !important;
  }
  .resume-document .experience-line {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.75rem;
  }
  .resume-document h3.experience-line {
    align-items: flex-end;
  }
  .resume-document .experience-title {
    flex: 1 1 auto;
    min-width: 0;
  }
  .resume-document .experience-date {
    font-size: var(--tpl-date-size, inherit);
    font-weight: var(--tpl-date-weight, inherit);
    flex-shrink: 0;
    margin-left: auto;
    text-align: right;
    white-space: nowrap;
  }
  .resume-document p:not(.job-intention),
  .resume-document ul,
  .resume-document ol,
  .resume-document .job-intention + p,
  .resume-document .contact-info--text,
  .resume-document .contact-info-text-line,
  .resume-document .contact-info--icon,
  .resume-document .contact-info-item {
    font-size: var(--tpl-font-size) !important;
  }
  .resume-document blockquote {
    font-size: calc(var(--tpl-font-size) * 0.9) !important;
  }
  .resume-document p,
  .resume-document ul,
  .resume-document ol,
  .resume-document blockquote {
    margin-top: 0 !important;
    margin-bottom: var(--tpl-paragraph-spacing) !important;
  }
  .resume-document li {
    margin-bottom: calc(var(--tpl-paragraph-spacing) * 0.5) !important;
  }
  .resume-document .personal-header {
    margin-bottom: 0 !important;
    padding-bottom: var(--tpl-personal-header-spacing) !important;
    break-inside: avoid;
    box-sizing: border-box;
  }
  .resume-document .resume-header {
    position: relative;
  }
  .resume-document .resume-header-body,
  .resume-document .resume-header-main,
  .resume-document .resume-header-meta,
  .resume-document .resume-header-photo {
    min-width: 0;
  }
  .resume-document[data-header-layout="split"] .resume-header-body {
    display: grid;
    gap: 6px;
  }
  .resume-document[data-header-layout="inline"] .resume-header-body {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 12px 18px;
    flex-wrap: wrap;
  }
  .resume-document[data-photo-placement="header-right"] .resume-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--cv-photo-gap);
  }
  .resume-document[data-photo-placement="header-right"] .resume-header-body {
    flex: 1 1 auto;
  }
  .resume-document[data-photo-placement="header-right"] .resume-header-photo {
    flex: 0 0 var(--cv-photo-width);
    width: var(--cv-photo-width);
  }
  .resume-document[data-photo-placement="header-right"] .resume-photo-wrapper {
    position: relative !important;
    top: auto;
    right: auto;
    left: auto;
  }
  .resume-document[data-photo-visible="false"] .resume-header-photo,
  .resume-document[data-photo-visible="false"] .resume-photo-wrapper {
    display: none !important;
  }
  .resume-document[data-photo-visible="false"] .dodge-photo:not(h2) {
    padding-right: 0 !important;
    padding-left: 0 !important;
  }
  .resume-document[data-photo-placement="header-right"] .dodge-photo:not(h2) {
    padding-right: 0 !important;
    padding-left: 0 !important;
  }
  .resume-document[data-photo-placement="top-left"] .resume-photo-wrapper {
    left: 0;
    right: auto;
  }
  .resume-document[data-photo-placement="top-left"] .dodge-photo:not(h2) {
    padding-right: 0 !important;
    padding-left: calc(var(--cv-photo-base-reserve) + max(0px, calc(var(--cv-photo-offset-x) * -1))) !important;
  }
  .resume-document[data-photo-placement="hidden"] .resume-header-photo,
  .resume-document[data-photo-placement="hidden"] .resume-photo-wrapper {
    display: none !important;
  }
  .resume-document[data-photo-placement="hidden"] .dodge-photo:not(h2) {
    padding-right: 0 !important;
    padding-left: 0 !important;
  }
  .resume-document[data-photo-visible="false"] .resume-header,
  .resume-document[data-photo-placement="hidden"] .resume-header {
    display: flex;
    justify-content: center;
  }
  .resume-document[data-photo-visible="false"] .resume-header-body,
  .resume-document[data-photo-placement="hidden"] .resume-header-body {
    display: flex !important;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    width: 100%;
  }
  .resume-document[data-photo-visible="false"] .resume-header-main,
  .resume-document[data-photo-visible="false"] .resume-header-meta,
  .resume-document[data-photo-visible="false"] .personal-header,
  .resume-document[data-photo-placement="hidden"] .resume-header-main,
  .resume-document[data-photo-placement="hidden"] .resume-header-meta,
  .resume-document[data-photo-placement="hidden"] .personal-header {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    width: 100%;
  }
  .resume-document[data-photo-visible="false"] .job-intention,
  .resume-document[data-photo-visible="false"] .contact-info--text,
  .resume-document[data-photo-visible="false"] .contact-info-text-line,
  .resume-document[data-photo-visible="false"] .job-intention + p,
  .resume-document[data-photo-placement="hidden"] .job-intention,
  .resume-document[data-photo-placement="hidden"] .contact-info--text,
  .resume-document[data-photo-placement="hidden"] .contact-info-text-line,
  .resume-document[data-photo-placement="hidden"] .job-intention + p {
    text-align: center;
  }
  .resume-document[data-photo-visible="false"] .contact-info--icon,
  .resume-document[data-photo-visible="false"] .job-intention + p,
  .resume-document[data-photo-placement="hidden"] .contact-info--icon,
  .resume-document[data-photo-placement="hidden"] .job-intention + p {
    justify-content: center;
  }
  .resume-document .contact-info--text,
  .resume-document .contact-info--icon,
  .resume-document .job-intention + p {
    margin-bottom: 0 !important;
  }
  .resume-document[data-section-title-preset="plain"] h2 {
    background: transparent !important;
    border-left: none !important;
    padding-left: 0 !important;
    padding-right: 0 !important;
  }
  .resume-document[data-section-title-preset="underline"] h2 {
    background: transparent !important;
    border-left-width: 0 !important;
    padding-left: 0 !important;
    padding-right: 0 !important;
    border-bottom-width: 2px !important;
  }
  ${includeContactIconRules
    ? `.resume-document .contact-info-item::before {
    content: "";
    display: inline-block;
    width: 14px;
    height: 14px;
    flex-shrink: 0;
    background-color: var(--tpl-theme-color);
    -webkit-mask-size: contain;
    mask-size: contain;
    -webkit-mask-repeat: no-repeat;
    mask-repeat: no-repeat;
    -webkit-mask-position: center;
    mask-position: center;
  }
  .resume-document .contact-info-item[data-icon="call"]::before {
    -webkit-mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z'/%3E%3C/svg%3E");
    mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z'/%3E%3C/svg%3E");
  }
  .resume-document .contact-info-item[data-icon="mail"]::before {
    -webkit-mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4-8 5-8-5V6l8 5 8-5v2z'/%3E%3C/svg%3E");
    mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4-8 5-8-5V6l8 5 8-5v2z'/%3E%3C/svg%3E");
  }
  .resume-document .contact-info-item[data-icon="location_on"]::before {
    -webkit-mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z'/%3E%3C/svg%3E");
    mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z'/%3E%3C/svg%3E");
  }
  .resume-document .contact-info-item[data-icon="cake"]::before {
    -webkit-mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M12 6c1.11 0 2-.9 2-2 0-.38-.1-.73-.29-1.03L12 0l-1.71 2.97c-.19.3-.29.65-.29 1.03 0 1.1.9 2 2 2zm4.6 9.99-1.07-1.07-1.08 1.07c-1.3 1.3-3.58 1.31-4.89 0l-1.07-1.07-1.09 1.07C6.75 16.64 5.88 17 4.96 17c-.73 0-1.4-.23-1.96-.61V21c0 .55.45 1 1 1h16c.55 0 1-.45 1-1v-4.61c-.56.38-1.23.61-1.96.61-.92 0-1.79-.36-2.44-1.01zM18 9h-5V7h-2v2H6c-1.66 0-3 1.34-3 3v1.54c0 1.08.88 1.96 1.96 1.96.52 0 1.02-.2 1.38-.57l2.14-2.13 2.13 2.13c.74.74 2.03.74 2.77 0l2.14-2.13 2.13 2.13c.37.37.86.57 1.38.57 1.08 0 1.96-.88 1.96-1.96V12c.01-1.66-1.33-3-2.99-3z'/%3E%3C/svg%3E");
    mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M12 6c1.11 0 2-.9 2-2 0-.38-.1-.73-.29-1.03L12 0l-1.71 2.97c-.19.3-.29.65-.29 1.03 0 1.1.9 2 2 2zm4.6 9.99-1.07-1.07-1.08 1.07c-1.3 1.3-3.58 1.31-4.89 0l-1.07-1.07-1.09 1.07C6.75 16.64 5.88 17 4.96 17c-.73 0-1.4-.23-1.96-.61V21c0 .55.45 1 1 1h16c.55 0 1-.45 1-1v-4.61c-.56.38-1.23.61-1.96.61-.92 0-1.79-.36-2.44-1.01zM18 9h-5V7h-2v2H6c-1.66 0-3 1.34-3 3v1.54c0 1.08.88 1.96 1.96 1.96.52 0 1.02-.2 1.38-.57l2.14-2.13 2.13 2.13c.74.74 2.03.74 2.77 0l2.14-2.13 2.13 2.13c.37.37.86.57 1.38.57 1.08 0 1.96-.88 1.96-1.96V12c.01-1.66-1.33-3-2.99-3z'/%3E%3C/svg%3E");
  }
  .resume-document .contact-info-item[data-icon="link_2"]::before {
    -webkit-mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z'/%3E%3C/svg%3E");
    mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z'/%3E%3C/svg%3E");
  }
  .resume-document .contact-info-item[data-icon="work"]::before {
    -webkit-mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M20 6h-4V4c0-1.11-.89-2-2-2h-4c-1.11 0-2 .89-2 2v2H4c-1.11 0-1.99.89-1.99 2L2 19c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-6 0h-4V4h4v2z'/%3E%3C/svg%3E");
    mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M20 6h-4V4c0-1.11-.89-2-2-2h-4c-1.11 0-2 .89-2 2v2H4c-1.11 0-1.99.89-1.99 2L2 19c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-6 0h-4V4h4v2z'/%3E%3C/svg%3E");
  }
  .resume-document .contact-info-item[data-icon="github"]::before {
    -webkit-mask-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 16 16' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8'/%3E%3C/svg%3E");
    mask-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 16 16' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8'/%3E%3C/svg%3E");
  }
  .resume-document .contact-info-item[data-icon="wechat"]::before {
    -webkit-mask-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 16 16' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M11.176 14.429c-2.665 0-4.826-1.8-4.826-4.018 0-2.22 2.159-4.02 4.824-4.02S16 8.191 16 10.411c0 1.21-.65 2.301-1.666 3.036a.32.32 0 0 0-.12.366l.218.81a.6.6 0 0 1 .029.117.166.166 0 0 1-.162.162.2.2 0 0 1-.092-.03l-1.057-.61a.5.5 0 0 0-.256-.074.5.5 0 0 0-.142.021 5.7 5.7 0 0 1-1.576.22M9.064 9.542a.647.647 0 1 0 .557-1 .645.645 0 0 0-.646.647.6.6 0 0 0 .09.353Zm3.232.001a.646.646 0 1 0 .546-1 .645.645 0 0 0-.644.644.63.63 0 0 0 .098.356'/%3E%3Cpath d='M0 6.826c0 1.455.781 2.765 2.001 3.656a.385.385 0 0 1 .143.439l-.161.6-.1.373a.5.5 0 0 0-.032.14.19.19 0 0 0 .193.193q.06 0 .111-.029l1.268-.733a.6.6 0 0 1 .308-.088q.088 0 .171.025a6.8 6.8 0 0 0 1.625.26 4.5 4.5 0 0 1-.177-1.251c0-2.936 2.785-5.02 5.824-5.02l.15.002C10.587 3.429 8.392 2 5.796 2 2.596 2 0 4.16 0 6.826m4.632-1.555a.77.77 0 1 1-1.54 0 .77.77 0 0 1 1.54 0m3.875 0a.77.77 0 1 1-1.54 0 .77.77 0 0 1 1.54 0'/%3E%3C/svg%3E");
    mask-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 16 16' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M11.176 14.429c-2.665 0-4.826-1.8-4.826-4.018 0-2.22 2.159-4.02 4.824-4.02S16 8.191 16 10.411c0 1.21-.65 2.301-1.666 3.036a.32.32 0 0 0-.12.366l.218.81a.6.6 0 0 1 .029.117.166.166 0 0 1-.162.162.2.2 0 0 1-.092-.03l-1.057-.61a.5.5 0 0 0-.256-.074.5.5 0 0 0-.142.021 5.7 5.7 0 0 1-1.576.22M9.064 9.542a.647.647 0 1 0 .557-1 .645.645 0 0 0-.646.647.6.6 0 0 0 .09.353Zm3.232.001a.646.646 0 1 0 .546-1 .645.645 0 0 0-.644.644.63.63 0 0 0 .098.356'/%3E%3Cpath d='M0 6.826c0 1.455.781 2.765 2.001 3.656a.385.385 0 0 1 .143.439l-.161.6-.1.373a.5.5 0 0 0-.032.14.19.19 0 0 0 .193.193q.06 0 .111-.029l1.268-.733a.6.6 0 0 1 .308-.088q.088 0 .171.025a6.8 6.8 0 0 0 1.625.26 4.5 4.5 0 0 1-.177-1.251c0-2.936 2.785-5.02 5.824-5.02l.15.002C10.587 3.429 8.392 2 5.796 2 2.596 2 0 4.16 0 6.826m4.632-1.555a.77.77 0 1 1-1.54 0 .77.77 0 0 1 1.54 0m3.875 0a.77.77 0 1 1-1.54 0 .77.77 0 0 1 1.54 0'/%3E%3C/svg%3E");
  }`
    : ""}
  .resume-document .manual-page-break {
    break-before: page;
    page-break-before: always;
    height: 0;
    margin: 0;
    padding: 0;
    border: 0;
  }
`;
};
