import { ResumeStyle } from '../stores/resume'

type ContactFieldType = 'phone' | 'email' | 'github' | 'location' | 'age' | 'website' | 'wechat'

interface ContactField {
  type: ContactFieldType
  value: string
}

const CONTACT_FIELD_ALIASES: Record<ContactFieldType, string[]> = {
  phone: ['电话', '手机', '手机号', '手机号码', '联系电话', 'tel', 'phone', 'mobile'],
  email: ['邮箱', '电子邮箱', '邮箱地址', '邮件', 'email', 'e-mail', 'mail'],
  github: ['github', 'github账号', 'github主页', 'github地址', 'github profile'],
  location: ['城市', '地点', '所在地', '现居地', '居住地', '位置', '地址', 'location', 'city'],
  age: ['年龄', 'age'],
  website: ['网站', '主页', '博客', 'portfolio', 'website', 'site', 'blog'],
  wechat: ['微信', 'wechat', 'vx'],
}

export const REGEX_PATTERNS = {
  JOB_INTENTION: /(?:求职意向|期望职位|应聘职位|求职目标)/,

  DATE_BRACKETED: /\[(\d{4}[./-年]\d{1,2}(?:月)?(?:\s*(?:-|–|—|至)\s*(?:\d{4}[./-年]\d{1,2}(?:月)?|至今|今))?)\]/,

  DATE_RANGE: /(\d{4}[./-年]\d{1,2}(?:月)?(?:\s*(?:-|–|—|至)\s*(?:\d{4}[./-年]\d{1,2}(?:月)?|至今|今))?)$/,
}

const DATE_VALUE_SOURCE = String.raw`(?:\d{4}[./-年]\d{1,2}(?:月)?|YYYY\.MM)`
const DATE_END_SOURCE = String.raw`(?:${DATE_VALUE_SOURCE}|至今|今)`
const DATE_SPAN_SOURCE = String.raw`(${DATE_VALUE_SOURCE}(?:\s*(?:-|–|—|至)\s*${DATE_END_SOURCE})?)`
const DATE_BRACKETED_PATTERN = new RegExp(String.raw`\[${DATE_SPAN_SOURCE}\]`)
const DATE_RANGE_PATTERN = new RegExp(`${DATE_SPAN_SOURCE}$`)

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, '')
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function normalizeWebsiteHref(value: string): string {
  const trimmed = value.trim()
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed
  }

  if (/^www\./i.test(trimmed)) {
    return `https://${trimmed}`
  }

  return `https://${trimmed}`
}

function normalizeLabel(label: string): string {
  return label.trim().toLowerCase().replace(/\s+/g, '')
}

function resolveContactType(label: string): ContactFieldType | null {
  const normalized = normalizeLabel(label)

  for (const [type, aliases] of Object.entries(CONTACT_FIELD_ALIASES) as Array<[ContactFieldType, string[]]>) {
    if (aliases.some((alias) => normalizeLabel(alias) === normalized)) {
      return type
    }
  }

  return null
}

function normalizeContactText(rawText: string): string {
  return stripHtml(rawText.replace(/<br\s*\/?>/gi, '\n'))
    .replace(/&nbsp;/gi, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\r\n?/g, '\n')
    .replace(/[^\S\r\n]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .trim()
}

function splitNormalizedContactSegments(text: string): string[] {
  if (!text.includes('\n')) {
    return splitContactSegments(text)
  }

  return text
    .split(/\s*(?:\r?\n|[|｜丨])\s*/)
    .map((segment) => segment.trim())
    .filter(Boolean)
}

function splitContactSegments(text: string): string[] {
  return text
    .split(/\s*[|｜]\s*/)
    .map((segment) => segment.trim())
    .filter(Boolean)
}

function cleanContactValue(value: string): string {
  return value.trim().replace(/^[：:\-]+/, '').replace(/[，,;；]+$/, '').trim()
}

function normalizeContactValue(type: ContactFieldType, value: string): string {
  if (type === 'age') {
    return value.replace(/\s+/g, '')
  }

  if (type === 'github') {
    const githubUrlMatch = value.match(/github\.com\/([A-Za-z0-9-]+)/i)
    if (githubUrlMatch) {
      return githubUrlMatch[1]
    }
  }

  return value
}

function inferContactField(segment: string, parsedItems: ContactField[]): ContactField | null {
  const value = cleanContactValue(segment)
  if (!value) return null

  if (/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(value)) {
    return { type: 'email', value }
  }

  if (/^(?:\+?\d[\d\s\-()]{6,}\d)$/.test(value)) {
    return { type: 'phone', value: value.replace(/\s+/g, ' ') }
  }

  if (/^\d{1,2}\s*岁$/.test(value)) {
    return { type: 'age', value: value.replace(/\s+/g, '') }
  }

  const githubUrlMatch = value.match(/github\.com\/([A-Za-z0-9-]+)/i)
  if (githubUrlMatch) {
    return { type: 'github', value: githubUrlMatch[1] }
  }

  if (/^(https?:\/\/|www\.)\S+$/i.test(value)) {
    return { type: 'website', value }
  }

  if (!parsedItems.some((item) => item.type === 'github') && /^[A-Za-z0-9][A-Za-z0-9-]{1,38}$/.test(value)) {
    return { type: 'github', value }
  }

  if (/^[\u4e00-\u9fffA-Za-z]{2,16}$/.test(value)) {
    return { type: 'location', value }
  }

  return null
}

function parseContactFields(rawText: string): ContactField[] {
  const text = normalizeContactText(rawText)
  if (!text) return []

  const segments = splitNormalizedContactSegments(text)
  const items: ContactField[] = []

  for (const segment of segments) {
    const labeledMatch = segment.match(/^([^:：]{1,24})\s*[:：]\s*(.+)$/)
    if (labeledMatch) {
      const type = resolveContactType(labeledMatch[1])
      const rawValue = cleanContactValue(labeledMatch[2])

      if (type && rawValue) {
        items.push({ type, value: normalizeContactValue(type, rawValue) })
        continue
      }

      const inferredFromValue = inferContactField(rawValue, items)
      if (inferredFromValue) {
        items.push(inferredFromValue)
        continue
      }
    }

    const inferred = inferContactField(segment, items)
    if (inferred) {
      items.push(inferred)
    }
  }

  return items
}

function renderBootstrapIcon(paths: Array<{ d: string; fillRule?: 'evenodd' }>): string {
  return `<svg viewBox="0 0 16 16" aria-hidden="true">${paths
    .map((path) => `<path fill="currentColor"${path.fillRule ? ` fill-rule="${path.fillRule}"` : ''} d="${path.d}"></path>`)
    .join('')}</svg>`
}

function renderContactIcon(type: ContactFieldType): string {
  switch (type) {
    case 'phone':
      return renderBootstrapIcon([
        {
          fillRule: 'evenodd',
          d: 'M1.885.511a1.745 1.745 0 0 1 2.61.163L6.29 2.98c.329.423.445.974.315 1.494l-.547 2.19a.68.68 0 0 0 .178.643l2.457 2.457a.68.68 0 0 0 .644.178l2.189-.547a1.75 1.75 0 0 1 1.494.315l2.306 1.794c.829.645.905 1.87.163 2.611l-1.034 1.034c-.74.74-1.846 1.065-2.877.702a18.6 18.6 0 0 1-7.01-4.42 18.6 18.6 0 0 1-4.42-7.009c-.362-1.03-.037-2.137.703-2.877z',
        },
      ])
    case 'email':
      return renderBootstrapIcon([
        {
          d: 'M0 4a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2zm2-1a1 1 0 0 0-1 1v.217l7 4.2 7-4.2V4a1 1 0 0 0-1-1zm13 2.383-4.708 2.825L15 11.105zm-.034 6.876-5.64-3.471L8 9.583l-1.326-.795-5.64 3.47A1 1 0 0 0 2 13h12a1 1 0 0 0 .966-.741M1 11.105l4.708-2.897L1 5.383z',
        },
      ])
    case 'github':
      return renderBootstrapIcon([
        {
          d: 'M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8',
        },
      ])
    case 'location':
      return renderBootstrapIcon([
        {
          d: 'M8 16s6-5.686 6-10A6 6 0 0 0 2 6c0 4.314 6 10 6 10m0-7a3 3 0 1 1 0-6 3 3 0 0 1 0 6',
        },
      ])
    case 'age':
      return renderBootstrapIcon([
        {
          d: 'm3.494.013-.595.79A.747.747 0 0 0 3 1.814v2.683q-.224.051-.432.107c-.702.187-1.305.418-1.745.696C.408 5.56 0 5.954 0 6.5v7c0 .546.408.94.823 1.201.44.278 1.043.51 1.745.696C3.978 15.773 5.898 16 8 16s4.022-.227 5.432-.603c.701-.187 1.305-.418 1.745-.696.415-.261.823-.655.823-1.201v-7c0-.546-.408-.94-.823-1.201-.44-.278-1.043-.51-1.745-.696A12 12 0 0 0 13 4.496v-2.69a.747.747 0 0 0 .092-1.004l-.598-.79-.595.792A.747.747 0 0 0 12 1.813V4.3a22 22 0 0 0-2-.23V1.806a.747.747 0 0 0 .092-1.004l-.598-.79-.595.792A.747.747 0 0 0 9 1.813v2.204a29 29 0 0 0-2 0V1.806A.747.747 0 0 0 7.092.802l-.598-.79-.595.792A.747.747 0 0 0 6 1.813V4.07c-.71.05-1.383.129-2 .23V1.806A.747.747 0 0 0 4.092.802zm-.668 5.556L3 5.524v.967q.468.111 1 .201V5.315a21 21 0 0 1 2-.242v1.855q.488.036 1 .054V5.018a28 28 0 0 1 2 0v1.964q.512-.018 1-.054V5.073c.72.054 1.393.137 2 .242v1.377q.532-.09 1-.201v-.967l.175.045c.655.175 1.15.374 1.469.575.344.217.356.35.356.356s-.012.139-.356.356c-.319.2-.814.4-1.47.575C11.87 7.78 10.041 8 8 8c-2.04 0-3.87-.221-5.174-.569-.656-.175-1.151-.374-1.47-.575C1.012 6.639 1 6.506 1 6.5s.012-.139.356-.356c.319-.2.814-.4 1.47-.575M15 7.806v1.027l-.68.907a.94.94 0 0 1-1.17.276 1.94 1.94 0 0 0-2.236.363l-.348.348a1 1 0 0 1-1.307.092l-.06-.044a2 2 0 0 0-2.399 0l-.06.044a1 1 0 0 1-1.306-.092l-.35-.35a1.935 1.935 0 0 0-2.233-.362.935.935 0 0 1-1.168-.277L1 8.82V7.806c.42.232.956.428 1.568.591C3.978 8.773 5.898 9 8 9s4.022-.227 5.432-.603c.612-.163 1.149-.36 1.568-.591m0 2.679V13.5c0 .006-.012.139-.356.355-.319.202-.814.401-1.47.576C11.87 14.78 10.041 15 8 15c-2.04 0-3.87-.221-5.174-.569-.656-.175-1.151-.374-1.47-.575-.344-.217-.356-.35-.356-.356v-3.02a1.935 1.935 0 0 0 2.298.43.935.935 0 0 1 1.08.175l.348.349a2 2 0 0 0 2.615.185l.059-.044a1 1 0 0 1 1.2 0l.06.044a2 2 0 0 0 2.613-.185l.348-.348a.94.94 0 0 1 1.082-.175c.781.39 1.718.208 2.297-.426',
        },
      ])
    case 'website':
      return renderBootstrapIcon([
        {
          d: 'M4.715 6.542 3.343 7.914a3 3 0 1 0 4.243 4.243l1.828-1.829A3 3 0 0 0 8.586 5.5L8 6.086a1 1 0 0 0-.154.199 2 2 0 0 1 .861 3.337L6.88 11.45a2 2 0 1 1-2.83-2.83l.793-.792a4 4 0 0 1-.128-1.287z',
        },
        {
          d: 'M6.586 4.672A3 3 0 0 0 7.414 9.5l.775-.776a2 2 0 0 1-.896-3.346L9.12 3.55a2 2 0 1 1 2.83 2.83l-.793.792c.112.42.155.855.128 1.287l1.372-1.372a3 3 0 1 0-4.243-4.243z',
        },
      ])
    case 'wechat':
      return renderBootstrapIcon([
        {
          d: 'M4.715 6.542 3.343 7.914a3 3 0 1 0 4.243 4.243l1.828-1.829A3 3 0 0 0 8.586 5.5L8 6.086a1 1 0 0 0-.154.199 2 2 0 0 1 .861 3.337L6.88 11.45a2 2 0 1 1-2.83-2.83l.793-.792a4 4 0 0 1-.128-1.287z',
        },
        {
          d: 'M6.586 4.672A3 3 0 0 0 7.414 9.5l.775-.776a2 2 0 0 1-.896-3.346L9.12 3.55a2 2 0 1 1 2.83 2.83l-.793.792c.112.42.155.855.128 1.287l1.372-1.372a3 3 0 1 0-4.243-4.243z',
        },
      ])
  }
}

function renderContactField(field: ContactField): string {
  const safeValue = escapeHtml(field.value)
  let valueHtml = `<span class="contact-info-value">${safeValue}</span>`

  if (field.type === 'website') {
    const safeHref = escapeHtml(normalizeWebsiteHref(field.value))
    valueHtml = `<a class="contact-info-value contact-info-link" href="${safeHref}" target="_blank" rel="noopener noreferrer">${safeValue}</a>`
  }

  if (field.type === 'github') {
    const safeHref = escapeHtml(`https://github.com/${field.value}`)
    valueHtml = `<a class="contact-info-value contact-info-link" href="${safeHref}" target="_blank" rel="noopener noreferrer">${safeValue}</a>`
  }

  return `
    <span class="contact-info-item contact-info-item--${field.type}">
      <span class="contact-info-icon" aria-hidden="true">${renderContactIcon(field.type)}</span>
      ${valueHtml}
    </span>
  `.trim()
}

function enhanceModernContactInfo(html: string): string {
  return html.replace(
    /(<p class="job-intention"[^>]*>[\s\S]*?<\/p>)(\s*<p>([\s\S]*?)<\/p>)/i,
    (match, jobIntentionHtml, _contactBlock, contactContent) => {
      const fields = parseContactFields(contactContent)

      if (fields.length < 2) {
        return match
      }

      return `${jobIntentionHtml}<div class="contact-info contact-info--icon">${fields.map(renderContactField).join('')}</div>`
    }
  )
}

function collectContactParagraphs(jobIntentionElement: Element): HTMLParagraphElement[] {
  const paragraphs: HTMLParagraphElement[] = []
  let current = jobIntentionElement.nextElementSibling

  while (current?.tagName === 'P') {
    const paragraph = current as HTMLParagraphElement
    const parsedFields = parseContactFields(paragraph.innerHTML)

    if (parsedFields.length === 0) {
      break
    }

    paragraphs.push(paragraph)
    current = paragraph.nextElementSibling
  }

  return paragraphs
}

function renderTextContactInfo(paragraphs: HTMLParagraphElement[]): string {
  return `
    <div class="contact-info contact-info--text">
      ${paragraphs
        .map((paragraph) => `<p class="contact-info-text-line">${paragraph.innerHTML}</p>`)
        .join('')}
    </div>
  `.trim()
}

function enhanceContactInfo(html: string, styleConfig: ResumeStyle, templateId?: string): string {
  if (typeof document === 'undefined') {
    return templateId === 'modern' && styleConfig.personalInfoMode === 'icon'
      ? enhanceModernContactInfo(html)
      : html
  }

  const container = document.createElement('div')
  container.innerHTML = html

  const isModernIconMode = templateId === 'modern' && styleConfig.personalInfoMode === 'icon'

  container.querySelectorAll('p.job-intention').forEach((jobIntentionElement) => {
    const paragraphs = collectContactParagraphs(jobIntentionElement)
    if (paragraphs.length === 0) {
      return
    }

    const replacementHtml = (() => {
      if (!isModernIconMode) {
        return renderTextContactInfo(paragraphs)
      }

      const fields = parseContactFields(paragraphs.map((paragraph) => paragraph.innerHTML).join('\n'))
      if (fields.length < 2) {
        return renderTextContactInfo(paragraphs)
      }

      return `<div class="contact-info contact-info--icon">${fields.map(renderContactField).join('')}</div>`
    })()

    const replacementWrapper = document.createElement('div')
    replacementWrapper.innerHTML = replacementHtml
    const replacementElement = replacementWrapper.firstElementChild

    if (!replacementElement) {
      return
    }

    paragraphs[0].before(replacementElement)
    paragraphs.forEach((paragraph) => paragraph.remove())
  })

  return container.innerHTML
}

function renderExperienceLine(
  tag: string,
  attrs: string,
  titleHtml: string,
  dateText: string,
): string {
  const lineHtml = `<span class="experience-title">${titleHtml}</span><span class="experience-date">${dateText}</span>`

  if (tag === 'li') {
    return `<${tag}${attrs}><div class="experience-line">${lineHtml}</div></${tag}>`
  }

  return `<${tag}${attrs} class="experience-line">${lineHtml}</${tag}>`
}

export function enhanceResumeHtml(rawHtml: string, styleConfig: ResumeStyle, templateId?: string): string {
  let html = rawHtml

  html = html.replace(
    /<p>(.*?(?:求职意向|期望职位|应聘职位|求职目标).*?)<\/p>/g,
    (_match, text) => {
      return `<p class="job-intention" style="color: ${styleConfig.themeColor};">${text}</p>`
    }
  )

  html = enhanceContactInfo(html, styleConfig, templateId)

  html = html.replace(/<(h[1-6]|p|li)([^>]*)>([\s\S]*?)<\/\1>/g, (match, tag, attrs, content) => {
    if (content.includes('experience-date')) return match

    const plainText = stripHtml(content).trim()
    const bracketedMatch = plainText.match(DATE_BRACKETED_PATTERN)
    const rangeMatch = bracketedMatch ? null : plainText.match(DATE_RANGE_PATTERN)
    if (!bracketedMatch && !rangeMatch) return match

    const dateText = bracketedMatch?.[1] ?? rangeMatch?.[1] ?? ''
    const datePattern = bracketedMatch ? DATE_BRACKETED_PATTERN : DATE_RANGE_PATTERN
    const rawCleaned = content.replace(datePattern, '').trim()
    const titleHtml = rawCleaned.replace(/[\s\-|–—:：,，]+$/, '').trim()

    return renderExperienceLine(tag, attrs, titleHtml, dateText)
  })

  return html
}
