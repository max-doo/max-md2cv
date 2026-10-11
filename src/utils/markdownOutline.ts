export type OutlineLevel = 2 | 3 | 4

export interface ResumeOutlineNode {
  id: string
  level: OutlineLevel
  title: string
  startOffset: number
  endOffset: number
  startLine: number
  parentId: string | null
  children: ResumeOutlineNode[]
}

interface ParsedHeading {
  level: number
  title: string
  startOffset: number
  startLine: number
}

export interface ParsedMarkdownOutline {
  tree: ResumeOutlineNode[]
  nodesById: Map<string, ResumeOutlineNode>
}

const TRACKED_LEVELS = new Set<OutlineLevel>([2, 3, 4])
const ATX_HEADING_RE = /^\s{0,3}(#{1,6})[ \t]+(.+?)\s*$/
const FENCE_START_RE = /^\s{0,3}(`{3,}|~{3,})(.*)$/

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const normalizeHeadingTitle = (raw: string) => raw.replace(/[ \t]+#+[ \t]*$/, '').trim()

const parseHeadings = (markdown: string): ParsedHeading[] => {
  const headings: ParsedHeading[] = []
  const length = markdown.length
  let offset = 0
  let lineNumber = 1
  let activeFence: { char: '`' | '~'; size: number } | null = null

  while (offset < length) {
    let lineEnd = offset
    while (lineEnd < length && markdown[lineEnd] !== '\n' && markdown[lineEnd] !== '\r') {
      lineEnd += 1
    }

    const line = markdown.slice(offset, lineEnd)
    let nextOffset = lineEnd
    if (markdown[nextOffset] === '\r') {
      nextOffset += 1
    }
    if (markdown[nextOffset] === '\n') {
      nextOffset += 1
    }

    if (activeFence) {
      const fenceEndRe = new RegExp(`^\\s{0,3}${escapeRegExp(activeFence.char)}{${activeFence.size},}\\s*$`)
      if (fenceEndRe.test(line)) {
        activeFence = null
      }
    } else {
      const fenceStartMatch = line.match(FENCE_START_RE)
      if (fenceStartMatch) {
        activeFence = {
          char: fenceStartMatch[1][0] as '`' | '~',
          size: fenceStartMatch[1].length,
        }
      } else {
        const headingMatch = line.match(ATX_HEADING_RE)
        if (headingMatch) {
          headings.push({
            level: headingMatch[1].length,
            title: normalizeHeadingTitle(headingMatch[2]),
            startOffset: offset,
            startLine: lineNumber,
          })
        }
      }
    }

    offset = nextOffset
    lineNumber += 1
  }

  return headings
}

const resolveHeadingEndOffset = (headings: ParsedHeading[], currentIndex: number, markdownLength: number) => {
  const current = headings[currentIndex]
  for (let index = currentIndex + 1; index < headings.length; index += 1) {
    if (headings[index].level <= current.level) {
      return headings[index].startOffset
    }
  }

  return markdownLength
}

export const parseMarkdownOutline = (markdown: string): ParsedMarkdownOutline => {
  const headings = parseHeadings(markdown)
  const tree: ResumeOutlineNode[] = []
  const nodesById = new Map<string, ResumeOutlineNode>()
  const stack: ResumeOutlineNode[] = []

  headings.forEach((heading, index) => {
    if (!TRACKED_LEVELS.has(heading.level as OutlineLevel)) {
      return
    }

    while (stack.length > 0 && stack[stack.length - 1].level >= heading.level) {
      stack.pop()
    }

    const parent = stack.length > 0 ? stack[stack.length - 1] : null
    const node: ResumeOutlineNode = {
      id: `${heading.startOffset}:${heading.level}`,
      level: heading.level as OutlineLevel,
      title: heading.title,
      startOffset: heading.startOffset,
      endOffset: resolveHeadingEndOffset(headings, index, markdown.length),
      startLine: heading.startLine,
      parentId: parent?.id ?? null,
      children: [],
    }

    if (parent) {
      parent.children.push(node)
    } else {
      tree.push(node)
    }

    nodesById.set(node.id, node)
    stack.push(node)
  })

  return { tree, nodesById }
}

export const reorderOutlineSiblings = (
  markdown: string,
  nodeId: string,
  targetIndex: number,
  parentId: string | null,
) => {
  const { tree, nodesById } = parseMarkdownOutline(markdown)
  const siblings = parentId ? nodesById.get(parentId)?.children : tree

  if (!siblings || siblings.length < 2) {
    return markdown
  }

  const currentIndex = siblings.findIndex((node) => node.id === nodeId)
  if (currentIndex === -1) {
    return markdown
  }

  const boundedTargetIndex = Math.max(0, Math.min(targetIndex, siblings.length - 1))
  if (currentIndex === boundedTargetIndex) {
    return markdown
  }

  const regionStart = siblings[0].startOffset
  const regionEnd = siblings[siblings.length - 1].endOffset
  const reordered = [...siblings]
  const [movedNode] = reordered.splice(currentIndex, 1)
  reordered.splice(boundedTargetIndex, 0, movedNode)

  const replacement = reordered
    .map((node, index) => {
      const section = markdown.slice(node.startOffset, node.endOffset)
      // An EOF section may have no final newline. Moving it before another
      // section must not merge that section's heading into its last line.
      if (index < reordered.length - 1 && !/[\r\n]$/.test(section)) {
        return section + (markdown.includes('\r\n') ? '\r\n' : '\n')
      }
      return section
    })
    .join('')

  return `${markdown.slice(0, regionStart)}${replacement}${markdown.slice(regionEnd)}`
}
