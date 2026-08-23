# MD2CV layout tuning

Read this reference only when the user asks for a page-count or spacing adjustment, or when the first render reports `PAGE_OVERFLOW`, `PAGE_COUNT_EXCEEDED`, or a visually obvious blank/awkward page.

## Adjustment order

- Slightly over the target: reduce paragraph spacing first, then H2/H3 spacing, then line height, then vertical page margin, and only then body font size.
- Too much empty space: increase line height or paragraph/heading spacing, then consider a larger vertical page margin. Preserve readable type and do not force content into an artificial single page.
- A large overflow: check manual `/page` breaks, empty paragraphs, unusually long unbroken URLs, broken images, and font fallback before shrinking typography.

Change only one to three related values per round. Read the exact ranges and field names from `md2cv templates schema <id> --json`; this reference intentionally does not duplicate template schemas.

After every change, render again with `--json` and inspect every page image. Stop after three automatic rounds for a requested page count and report the remaining gap. If satisfying the target would require changing the resume text, ask the user first.

Font fallback can change line widths and pagination. Prefer a schema-supported font and validate the resulting screenshots instead of compensating with aggressive spacing changes.
