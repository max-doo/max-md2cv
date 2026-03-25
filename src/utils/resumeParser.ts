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

const CONTACT_ICON_MAP: Record<ContactFieldType, string> = {
  phone: 'call',
  email: 'mail',
  github: 'github',
  location: 'location_on',
  age: 'cake',
  website: 'link_2',
  wechat: 'wechat',
  experience: 'work',
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

  return `<span class="contact-info-item contact-info-item--${field.type}" data-icon="${CONTACT_ICON_MAP[field.type]}">${valueHtml}</span>`
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

    if (parsedFields.length < 2) {
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

  const jobIntentions = container.querySelectorAll('p.job-intention')

  jobIntentions.forEach((jobIntentionElement) => {
    const paragraphs = collectContactParagraphs(jobIntentionElement)
    if (paragraphs.length === 0) {
      return
    }

    const replacementHtml = (() => {
      if (!isIconMode) {
        return renderTextContactInfo(paragraphs)
      }

      const joinedHtml = paragraphs.map((paragraph) => paragraph.innerHTML).join('\n')
      const fields = parseContactFields(joinedHtml)
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

    // Wrap job-intention + contact-info in a personal-header container
    // to prevent Paged.js from breaking their sibling layout relationship
    const headerWrapper = document.createElement('div')
    headerWrapper.className = 'personal-header'
    jobIntentionElement.before(headerWrapper)
    headerWrapper.appendChild(jobIntentionElement)
    headerWrapper.appendChild(replacementElement)
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
          .join('<span class="job-intention-sep"> | </span>')
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

  return html
}
