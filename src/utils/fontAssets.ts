import pingFangScRegularWoff2Url from '../assets/fonts/PingFangSC-Regular.woff2'

const buildPingFangFontFaceCss = (src: string) => `
  @font-face {
    font-family: 'PingFang SC';
    src: url('${src}') format('woff2');
    font-style: normal;
    font-weight: 400;
    font-display: swap;
  }
`

export const pingFangFontFaceCss = buildPingFangFontFaceCss(pingFangScRegularWoff2Url)

const blobToDataUrl = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read font blob'))
    reader.readAsDataURL(blob)
  })

export const getInlinePingFangFontFaceCss = async (): Promise<string> => {
  const response = await fetch(pingFangScRegularWoff2Url)
  if (!response.ok) {
    throw new Error(`Failed to fetch embedded PingFang font: ${response.status}`)
  }

  const blob = await response.blob()
  const dataUrl = await blobToDataUrl(blob)
  return buildPingFangFontFaceCss(dataUrl)
}
