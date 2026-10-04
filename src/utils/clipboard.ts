/**
 * 复制文本到剪贴板工具函数（优先使用 Clipboard API，降级使用 execCommand）
 */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      // 降级使用传统方法
    }
  }

  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  textarea.style.left = '-9999px'
  document.body.appendChild(textarea)
  textarea.select()

  let success = false
  try {
    success = document.execCommand('copy')
  } catch {
    success = false
  } finally {
    document.body.removeChild(textarea)
  }

  return success
}
