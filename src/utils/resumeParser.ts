import { ResumeStyle } from '../stores/resume'

type ContactFieldType = 'phone' | 'email' | 'github' | 'location' | 'age' | 'website' | 'wechat' | 'experience'

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
  experience: ['工作经验', '工作经历', '经验', '年限', '工作年限', 'experience', 'exp'],
}

export interface SectionTypeDef {
  key: string
  aliases: string[]
  emoji: string
}

export const SECTION_TYPES: SectionTypeDef[] = [
  { key: 'advantage', aliases: ['个人优势', '优势评述', '自我评价', '个人总结', '个人简介', '个人画像', '个人亮点', '自我介绍', 'about', 'profile', 'summary', 'advantage'], emoji: '✨' },
  { key: 'education', aliases: ['教育背景', '教育经历', '学历背景', '学历', '学习经历', 'education', 'study'], emoji: '🎓' },
  { key: 'work', aliases: ['工作经历', '实习经历', '工作经验', '实践经历', '职业经历', '任职经历', 'experience', 'work', 'intern'], emoji: '💼' },
  { key: 'project', aliases: ['项目经历', '项目经验', '项目实践', '项目案例', '开源贡献', 'project'], emoji: '🚀' },
  { key: 'skill', aliases: ['技能', '专业技能', '技术能力', '核心技能', '技术栈', '能力清单', '技能特长', '技能清单', '技能概览', '工具', 'skills', 'competence'], emoji: '🛠️' },
  { key: 'campus', aliases: ['校园经历', '校园实践', '校园活动', '校内经历', '校内实践', '校内活动', '学生工作', '社团经历'], emoji: '🏫' },
  { key: 'award', aliases: ['荣誉', '奖项', '奖励', '证书', '获得荣誉', '荣誉奖项', '比赛', 'award', 'certificate', 'honor'], emoji: '🏆' },
  { key: 'hobby', aliases: ['爱好', '兴趣爱好', '兴趣特长'], emoji: '🎨' },
  { key: 'other', aliases: ['其他经历', '其他经验', '其他信息', '补充经历', '补充信息', '附加经历', '附加信息'], emoji: '🗂️' },
]

export function resolveSectionType(title: string): SectionTypeDef | null {
  const normalized = title.replace(/\s+/g, '').toLowerCase()
  return SECTION_TYPES.find((def) =>
    def.aliases.some((alias) => normalized.includes(alias.toLowerCase()))
  ) ?? null
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

  if (/^\d+(\.\d+)?[年个月]\s*(工作)?经验?$|^\d+(\.\d+)?年$/.test(value)) {
    return { type: 'experience', value: value.replace(/\s+/g, '') }
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

function renderMaterialIcon(name: string): string {
  return `<span class="material-symbols-outlined" aria-hidden="true">${name}</span>`
}

function renderContactIcon(type: ContactFieldType): string {
  switch (type) {
    case 'phone':
      return renderMaterialIcon('call')
    case 'email':
      return renderMaterialIcon('mail')
    case 'github':
      return renderBootstrapIcon([
        {
          d: 'M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8',
        },
      ])
    case 'location':
      return renderMaterialIcon('location_on')
    case 'age':
      return renderMaterialIcon('cake')
    case 'website':
      return renderMaterialIcon('link_2')
    case 'wechat':
      return renderBootstrapIcon([
        {
          d: 'M11.176 14.429c-2.665 0-4.826-1.8-4.826-4.018 0-2.22 2.159-4.02 4.824-4.02S16 8.191 16 10.411c0 1.21-.65 2.301-1.666 3.036a.32.32 0 0 0-.12.366l.218.81a.6.6 0 0 1 .029.117.166.166 0 0 1-.162.162.2.2 0 0 1-.092-.03l-1.057-.61a.5.5 0 0 0-.256-.074.5.5 0 0 0-.142.021 5.7 5.7 0 0 1-1.576.22M9.064 9.542a.647.647 0 1 0 .557-1 .645.645 0 0 0-.646.647.6.6 0 0 0 .09.353Zm3.232.001a.646.646 0 1 0 .546-1 .645.645 0 0 0-.644.644.63.63 0 0 0 .098.356',
        },
        {
          d: 'M0 6.826c0 1.455.781 2.765 2.001 3.656a.385.385 0 0 1 .143.439l-.161.6-.1.373a.5.5 0 0 0-.032.14.19.19 0 0 0 .193.193q.06 0 .111-.029l1.268-.733a.6.6 0 0 1 .308-.088q.088 0 .171.025a6.8 6.8 0 0 0 1.625.26 4.5 4.5 0 0 1-.177-1.251c0-2.936 2.785-5.02 5.824-5.02l.15.002C10.587 3.429 8.392 2 5.796 2 2.596 2 0 4.16 0 6.826m4.632-1.555a.77.77 0 1 1-1.54 0 .77.77 0 0 1 1.54 0m3.875 0a.77.77 0 1 1-1.54 0 .77.77 0 0 1 1.54 0',
        },
      ])
    case 'experience':
      return renderMaterialIcon('work')
  }
}

function renderContactField(field: ContactField): string {
  const safeValue = escapeHtml(field.value)
  let valueHtml = `<span class="contact-info-value">${safeValue}</span>`

  if (field.type === 'website') {
    const safeHref = escapeHtml(normalizeWebsiteHref(field.value))
    const displayValue = field.value
      .replace(/^https?:\/\//i, '')
      .replace(/^www\./i, '')
      .replace(/\/$/, '')
    valueHtml = `<a class="contact-info-value contact-info-link" href="${safeHref}" target="_blank" rel="noopener noreferrer">${escapeHtml(displayValue)}</a>`
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

function enhanceContactInfo(html: string, styleConfig: ResumeStyle, _templateId?: string): string {
  if (typeof document === 'undefined') {
    return styleConfig.personalInfoMode === 'icon'
      ? enhanceModernContactInfo(html)
      : html
  }

  const container = document.createElement('div')
  container.innerHTML = html

  const isIconMode = styleConfig.personalInfoMode === 'icon'

  container.querySelectorAll('p.job-intention').forEach((jobIntentionElement) => {
    const paragraphs = collectContactParagraphs(jobIntentionElement)
    if (paragraphs.length === 0) {
      return
    }

    const replacementHtml = (() => {
      if (!isIconMode) {
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
    /<p>(.*?(?:求职意向|期望职位|应聘职位|求职目标|意向岗位).*?)<\/p>/g,
    (_match, text) => {
      const plainText = stripHtml(text)
      if (plainText.includes('|') || plainText.includes('｜')) {
        const segments = text
          .split(/\s*[|｜]\s*/)
          .map((s: string) => s.trim())
          .filter(Boolean)
        const itemsHtml = segments
          .map((seg: string) => `<span class="job-intention-item">${seg}</span>`)
          .join('<span class="job-intention-sep">|</span>')
        return `<p class="job-intention" style="color: ${styleConfig.themeColor};">${itemsHtml}</p>`
      }
      return `<p class="job-intention" style="color: ${styleConfig.themeColor};">${text}</p>`
    }
  )

  html = enhanceContactInfo(html, styleConfig, templateId)

  html = html.replace(/<(h[1-6]|p|li)([^>]*)>([\s\S]*?)<\/\1>/g, (match, tag, attrs, content) => {
    if (content.includes('experience-date')) return match

    let finalTag = tag
    let finalAttrs = attrs

    // Process section headers for h2
    if (tag === 'h2') {
      const plainTextTitle = stripHtml(content)
      const sectionDef = resolveSectionType(plainTextTitle)
      const sectionClass = sectionDef ? `section-${sectionDef.key}` : 'section-default'

      if (finalAttrs.includes('class="')) {
        finalAttrs = finalAttrs.replace('class="', `class="${sectionClass} `)
      } else {
        finalAttrs = `${finalAttrs} class="${sectionClass}"`
      }
    }

    const plainText = stripHtml(content).trim()
    const bracketedMatch = plainText.match(DATE_BRACKETED_PATTERN)
    const rangeMatch = bracketedMatch ? null : plainText.match(DATE_RANGE_PATTERN)
    if (!bracketedMatch && !rangeMatch) return `<${finalTag}${finalAttrs}>${content}</${finalTag}>`

    const dateText = bracketedMatch?.[1] ?? rangeMatch?.[1] ?? ''
    const datePattern = bracketedMatch ? DATE_BRACKETED_PATTERN : DATE_RANGE_PATTERN
    const rawCleaned = content.replace(datePattern, '').trim()
    const titleHtml = rawCleaned.replace(/[\s\-|–—:：,，]+$/, '').trim()

    return renderExperienceLine(finalTag, finalAttrs, titleHtml, dateText)
  })

  // DOM-based fallback: ensure all h2 elements have section classes
  // Catches cases where the regex fails after DOM roundtrip in enhanceContactInfo
  if (typeof document !== 'undefined') {
    const sectionContainer = document.createElement('div')
    sectionContainer.innerHTML = html
    let patched = false
    sectionContainer.querySelectorAll('h2').forEach((h2) => {
      const hasSection = Array.from(h2.classList).some((c) => c.startsWith('section-'))
      if (hasSection) return
      const plainText = (h2.textContent ?? '').trim()
      const sectionDef = resolveSectionType(plainText)
      h2.classList.add(sectionDef ? `section-${sectionDef.key}` : 'section-default')
      patched = true
    })
    if (patched) {
      html = sectionContainer.innerHTML
    }
  }

  return html
}
