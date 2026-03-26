const CSS_URL_PATTERN = /url\(([^)]+)\)/g

const blobToDataUrl = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read blob'))
    reader.readAsDataURL(blob)
  })

const normalizeCssUrl = (rawUrl: string) => rawUrl.trim().replace(/^['"]|['"]$/g, '')

const shouldInlineCssUrl = (url: string) => {
  if (!url || url.startsWith('data:') || url.startsWith('#')) {
    return false
  }

  return !url.startsWith('blob:')
}

const inlineCssAssetUrls = async (
  cssText: string,
  baseUrl: string,
  assetCache: Map<string, string>,
) => {
  const replacements = new Map<string, string>()
  const matches = [...cssText.matchAll(CSS_URL_PATTERN)]

  for (const match of matches) {
    const rawUrl = match[1]
    const normalizedUrl = normalizeCssUrl(rawUrl)

    if (!shouldInlineCssUrl(normalizedUrl) || replacements.has(rawUrl)) {
      continue
    }

    let resolvedUrl: string
    try {
      resolvedUrl = new URL(normalizedUrl, baseUrl).href
    } catch {
      continue
    }

    try {
      let dataUrl = assetCache.get(resolvedUrl)
      if (!dataUrl) {
        const response = await fetch(resolvedUrl)
        if (!response.ok) {
          throw new Error(`Failed to fetch asset: ${response.status}`)
        }

        dataUrl = await blobToDataUrl(await response.blob())
        assetCache.set(resolvedUrl, dataUrl)
      }

      replacements.set(rawUrl, `'${dataUrl}'`)
    } catch (error) {
      console.warn(`Failed to inline CSS asset: ${resolvedUrl}`, error)
    }
  }

  let nextCssText = cssText
  for (const [rawUrl, dataUrl] of replacements) {
    nextCssText = nextCssText.split(rawUrl).join(dataUrl)
  }

  return nextCssText
}

const serializeStyleNode = async (
  node: HTMLStyleElement,
  assetCache: Map<string, string>,
) => {
  const cssText = await inlineCssAssetUrls(node.textContent ?? '', window.location.href, assetCache)
  return `<style>\n${cssText}\n</style>`
}

const serializeStylesheetLink = async (
  node: HTMLLinkElement,
  assetCache: Map<string, string>,
) => {
  try {
    const response = await fetch(node.href)
    if (!response.ok) {
      throw new Error(`Failed to fetch stylesheet: ${response.status}`)
    }

    const cssText = await inlineCssAssetUrls(await response.text(), node.href, assetCache)
    return `<style>\n${cssText}\n</style>`
  } catch (error) {
    console.warn(`Failed to inline stylesheet: ${node.href}`, error)
    return node.outerHTML
  }
}

export const buildSelfContainedExportStyles = async () => {
  const assetCache = new Map<string, string>()
  const styleNodes = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))

  const serializedNodes = await Promise.all(
    styleNodes.map((node) =>
      node instanceof HTMLStyleElement
        ? serializeStyleNode(node, assetCache)
        : serializeStylesheetLink(node as HTMLLinkElement, assetCache),
    ),
  )

  return serializedNodes.join('\n')
}
