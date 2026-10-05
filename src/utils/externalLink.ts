/**
 * 外部链接处理工具
 * 确保应用内点击外部链接时，在桌面端调用系统默认浏览器打开，在 Web 端使用新标签页打开，
 * 防止桌面端 Webview 跳转到外部网页后无法返回原页面。
 */

/**
 * 判断给定的 URL 是否为需要用系统默认浏览器打开的外部链接
 */
export function isExternalUrl(url: string | null | undefined): boolean {
  if (!url || typeof url !== 'string') {
    return false
  }

  const trimmed = url.trim()
  if (
    !trimmed ||
    trimmed.startsWith('#') ||
    trimmed.startsWith('javascript:') ||
    trimmed.startsWith('data:') ||
    trimmed.startsWith('blob:')
  ) {
    return false
  }

  if (/^(?:mailto:|tel:)/i.test(trimmed)) {
    return true
  }

  try {
    const base = typeof window !== 'undefined' && window.location?.href
      ? window.location.href
      : 'http://localhost:18080'
    const parsed = new URL(trimmed, base)

    if (parsed.protocol === 'mailto:' || parsed.protocol === 'tel:') {
      return true
    }

    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      const hostname = parsed.hostname.toLowerCase()
      // 本地开发服务器与 Tauri 内部 scheme/host 不视为外部链接
      if (
        hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname === 'tauri.localhost' ||
        hostname.endsWith('.localhost')
      ) {
        return false
      }
      return true
    }

    return false
  } catch {
    return /^(?:https?:\/\/|mailto:|tel:)/i.test(trimmed)
  }
}

/**
 * 打开外部链接：
 * - 桌面端 (Tauri)：优先通过 Tauri command open_external_url 或 plugin-opener openUrl 打开系统默认浏览器
 * - Web 端：使用 window.open(url, '_blank') 打开新标签页
 */
export async function openExternalUrl(url: string): Promise<boolean> {
  const targetUrl = url?.trim()
  if (!targetUrl) {
    return false
  }

  const isTauriEnv =
    typeof window !== 'undefined' &&
    ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)

  if (isTauriEnv) {
    try {
      const { invoke } = await import('@tauri-apps/api/core')
      await invoke('open_external_url', { url: targetUrl })
      return true
    } catch {
      try {
        const { openUrl } = await import('@tauri-apps/plugin-opener')
        await openUrl(targetUrl)
        return true
      } catch (err) {
        console.error('Failed to open external url in Tauri:', err)
      }
    }
  }

  if (typeof window !== 'undefined') {
    try {
      const opened = window.open(targetUrl, '_blank', 'noopener,noreferrer')
      return Boolean(opened)
    } catch (err) {
      console.error('Failed to open external url in window:', err)
    }
  }

  return false
}

/**
 * 全局拦截容器或文档内的外部链接点击与中键点击
 */
export function setupExternalLinkHandler(target?: EventTarget): () => void {
  const resolvedTarget = target ?? (typeof document !== 'undefined' ? document : undefined)
  if (!resolvedTarget) {
    return () => {}
  }

  const handleLinkClick = (event: Event) => {
    const mouseEvent = event as MouseEvent

    // 仅拦截鼠标左键 (0) 和中键 (1)
    if (mouseEvent.button !== 0 && mouseEvent.button !== 1) {
      return
    }

    const element = mouseEvent.target as HTMLElement | null
    const anchor = element?.closest?.('a')
    if (!anchor) {
      return
    }

    const href = anchor.getAttribute('href')
    if (!href || !isExternalUrl(href)) {
      return
    }

    mouseEvent.preventDefault()
    mouseEvent.stopPropagation()
    void openExternalUrl(href)
  }

  // 在桌面端拦截 window.open 防止代码或第三方库调用导致内部窗口失控
  if (
    typeof window !== 'undefined' &&
    ('__TAURI_INTERNALS__' in window || '__TAURI__' in window) &&
    !(window as unknown as { __EXTERNAL_LINK_GUARD_INSTALLED__?: boolean }).__EXTERNAL_LINK_GUARD_INSTALLED__
  ) {
    ;(window as unknown as { __EXTERNAL_LINK_GUARD_INSTALLED__?: boolean }).__EXTERNAL_LINK_GUARD_INSTALLED__ = true
    const originalOpen = window.open.bind(window)
    window.open = ((url?: string | URL, targetWin?: string, features?: string) => {
      const urlStr = url instanceof URL ? url.toString() : typeof url === 'string' ? url : ''
      if (urlStr && isExternalUrl(urlStr)) {
        void openExternalUrl(urlStr)
        return null
      }
      return originalOpen(url, targetWin, features)
    }) as typeof window.open
  }

  resolvedTarget.addEventListener('click', handleLinkClick, { capture: true })
  resolvedTarget.addEventListener('auxclick', handleLinkClick, { capture: true })

  return () => {
    resolvedTarget.removeEventListener('click', handleLinkClick, { capture: true })
    resolvedTarget.removeEventListener('auxclick', handleLinkClick, { capture: true })
  }
}
