export const MANUAL_PAGE_BREAK_MARKER = "\\page";

// Both spellings are documented in the app and in existing user resumes.
const MANUAL_PAGE_BREAK_LINE_RE = /^\s*(?:\\page|\/page)\s*$/gm;

export const renderManualPageBreaks = (markdown: string) =>
  markdown.replace(
    MANUAL_PAGE_BREAK_LINE_RE,
    '\n\n<div class="manual-page-break" aria-hidden="true"></div>\n\n',
  );
