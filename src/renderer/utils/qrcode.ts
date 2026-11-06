import QRCode from 'qrcode'

export type QrCodeImageOptions = {
  size?: number
  margin?: number
  darkColor?: string
  lightColor?: string
}

export async function createQrCodeDataUrl(text: string, options: QrCodeImageOptions = {}): Promise<string> {
  const content = String(text || '').trim()
  if (!content) {
    throw new Error('二维码内容不能为空')
  }

  return QRCode.toDataURL(content, {
    width: options.size ?? 320,
    margin: options.margin ?? 2,
    errorCorrectionLevel: 'M',
    color: {
      dark: options.darkColor ?? '#111827',
      light: options.lightColor ?? '#ffffffff',
    },
  })
}
