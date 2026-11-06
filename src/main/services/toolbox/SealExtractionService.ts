import * as path from 'path'
import * as fs from 'fs-extra'
import type { nativeImage as NativeImageModule } from 'electron'
import type {
  ProcessSealImageRequest,
  ProcessSealImageResult,
  SealCropBounds,
  SealShapeType,
} from '../../../shared/types/toolbox.types'

type Bounds = SealCropBounds

type ProcessingOptions = {
  backgroundThreshold: number
  redSensitivity: number
  edgeSoftness: number
  dpi: number
}

type PointStat = {
  count: number
  sumX: number
  sumY: number
  sumXX: number
  sumYY: number
  sumXY: number
}

const BASE_DPI = 96
const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n += 1) {
    let c = n
    for (let k = 0; k < 8; k += 1) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1)
    }
    table[n] = c >>> 0
  }
  return table
})()

export class SealExtractionService {
  private static instance: SealExtractionService

  private constructor() {}

  public static getInstance(): SealExtractionService {
    if (!SealExtractionService.instance) {
      SealExtractionService.instance = new SealExtractionService()
    }
    return SealExtractionService.instance
  }

  public async processSealImage(request: ProcessSealImageRequest): Promise<ProcessSealImageResult> {
    if (!request.legalConfirmed) {
      throw new Error('请先确认法律提示，仅限抠取本单位自有实体公章透明图')
    }

    const filePath = path.resolve(String(request.filePath || '').trim())
    if (!filePath) {
      throw new Error('图片路径不能为空')
    }
    if (!(await fs.pathExists(filePath))) {
      throw new Error(`图片不存在: ${filePath}`)
    }

    const nativeImage = this.getNativeImage()
    if (!nativeImage) {
      throw new Error('当前运行环境无法处理印章图片，请在 Electron 应用内执行该操作')
    }

    const image = nativeImage.createFromPath(filePath)
    if (image.isEmpty()) {
      throw new Error('图片无法读取或格式不受支持')
    }

    const { width, height } = image.getSize()
    if (!width || !height) {
      throw new Error('图片尺寸无效')
    }

    const options = this.resolveOptions(request)
    const originalBitmap = Buffer.from(image.toBitmap())
    const appliedCropBounds = this.resolveCropBounds(request.cropBounds, width, height)
    const croppedSourceBitmap = this.cropBitmap(originalBitmap, width, appliedCropBounds)
    const croppedWidth = appliedCropBounds.right - appliedCropBounds.left + 1
    const croppedHeight = appliedCropBounds.bottom - appliedCropBounds.top + 1

    const processed = this.extractSeal(croppedSourceBitmap, croppedWidth, croppedHeight, options)
    if (!processed.trimBounds) {
      throw new Error('未检测到明显红色印章内容')
    }

    const finalBitmap = this.cropBitmap(croppedSourceBitmap, croppedWidth, processed.trimBounds)
    const trimmedWidth = processed.trimBounds.right - processed.trimBounds.left + 1
    const trimmedHeight = processed.trimBounds.bottom - processed.trimBounds.top + 1
    const trimBounds = this.translateBounds(processed.trimBounds, appliedCropBounds.left, appliedCropBounds.top)
    const previewBytes = nativeImage.createFromBitmap(finalBitmap, {
      width: trimmedWidth,
      height: trimmedHeight,
      scaleFactor: 1,
    }).toPNG()

    const scaleFactor = Math.max(1, options.dpi / BASE_DPI)
    const exportWidth = Math.max(1, Math.round(trimmedWidth * scaleFactor))
    const exportHeight = Math.max(1, Math.round(trimmedHeight * scaleFactor))
    const resizedBitmap = this.resizeBitmapBilinear(finalBitmap, trimmedWidth, trimmedHeight, exportWidth, exportHeight)
    const exportPng = nativeImage.createFromBitmap(resizedBitmap, {
      width: exportWidth,
      height: exportHeight,
      scaleFactor: 1,
    }).toPNG()
    const pngBytes = this.writePngDpi(exportPng, options.dpi)

    return {
      sourcePath: filePath,
      outputFileName: `${path.basename(filePath, path.extname(filePath))}-seal.png`,
      width: trimmedWidth,
      height: trimmedHeight,
      exportWidth,
      exportHeight,
      dpi: options.dpi,
      scaleMode: 'dpi-scale',
      pngBytes: new Uint8Array(pngBytes),
      previewBytes: new Uint8Array(previewBytes),
      trimBounds,
      appliedCropBounds,
      detectedShape: processed.detectedShape,
      warningMessage: processed.warningMessage,
    }
  }

  private resolveOptions(request: ProcessSealImageRequest): ProcessingOptions {
    return {
      backgroundThreshold: this.clampNumber(request.backgroundThreshold, 180, 252, 236),
      redSensitivity: this.clampNumber(request.redSensitivity, 12, 160, 58),
      edgeSoftness: this.clampNumber(request.edgeSoftness, 4, 80, 18),
      dpi: this.clampNumber(request.dpi, 96, 1200, 300),
    }
  }

  private resolveCropBounds(cropBounds: SealCropBounds | null | undefined, width: number, height: number): SealCropBounds {
    if (!cropBounds) {
      return { left: 0, top: 0, right: width - 1, bottom: height - 1 }
    }

    const left = this.clampNumber(cropBounds.left, 0, width - 1, 0)
    const top = this.clampNumber(cropBounds.top, 0, height - 1, 0)
    const right = this.clampNumber(cropBounds.right, left, width - 1, width - 1)
    const bottom = this.clampNumber(cropBounds.bottom, top, height - 1, height - 1)
    return { left, top, right, bottom }
  }

  private extractSeal(
    bitmap: Buffer,
    width: number,
    height: number,
    options: ProcessingOptions,
  ): { trimBounds: Bounds | null; detectedShape: SealShapeType; warningMessage?: string } {
    const backgroundColor = this.estimateBackgroundColor(bitmap, width, height)
    let left = width
    let top = height
    let right = -1
    let bottom = -1
    const stat: PointStat = { count: 0, sumX: 0, sumY: 0, sumXX: 0, sumYY: 0, sumXY: 0 }

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const offset = (y * width + x) * 4
        const blue = bitmap[offset]
        const green = bitmap[offset + 1]
        const red = bitmap[offset + 2]
        const alpha = bitmap[offset + 3]
        if (alpha === 0) {
          bitmap[offset + 3] = 0
          continue
        }

        const nextAlpha = this.computeSealAlpha(red, green, blue, backgroundColor, options)
        bitmap[offset + 3] = nextAlpha
        if (nextAlpha < 20) {
          continue
        }

        left = Math.min(left, x)
        top = Math.min(top, y)
        right = Math.max(right, x)
        bottom = Math.max(bottom, y)
        stat.count += 1
        stat.sumX += x
        stat.sumY += y
        stat.sumXX += x * x
        stat.sumYY += y * y
        stat.sumXY += x * y
      }
    }

    if (right < left || bottom < top || stat.count < 24) {
      return { trimBounds: null, detectedShape: 'unknown' }
    }

    const contentBounds = { left, top, right, bottom }
    const shape = this.detectShape(stat)
    const expandedBounds = this.expandBounds(contentBounds, width, height, 8)

    if (shape === 'unknown') {
      return {
        trimBounds: expandedBounds,
        detectedShape: 'unknown',
        warningMessage: '未稳定识别标准圆章/椭圆章，已按内容区域提取。',
      }
    }

    return {
      trimBounds: expandedBounds,
      detectedShape: shape,
    }
  }

  private detectShape(stat: PointStat): SealShapeType {
    const meanX = stat.sumX / stat.count
    const meanY = stat.sumY / stat.count
    const varianceX = Math.max(stat.sumXX / stat.count - meanX * meanX, 0)
    const varianceY = Math.max(stat.sumYY / stat.count - meanY * meanY, 0)
    const covariance = stat.sumXY / stat.count - meanX * meanY
    const trace = varianceX + varianceY
    const determinant = varianceX * varianceY - covariance * covariance
    const root = Math.sqrt(Math.max(trace * trace - 4 * determinant, 0))
    const eigenMax = Math.max((trace + root) / 2, 0.0001)
    const eigenMin = Math.max((trace - root) / 2, 0.0001)
    const axisRatio = Math.sqrt(eigenMax / eigenMin)

    if (axisRatio <= 1.2) {
      return 'circle'
    }
    if (axisRatio <= 2.4) {
      return 'ellipse'
    }
    return 'unknown'
  }

  private expandBounds(bounds: Bounds, width: number, height: number, padding: number): Bounds {
    return {
      left: Math.max(0, bounds.left - padding),
      top: Math.max(0, bounds.top - padding),
      right: Math.min(width - 1, bounds.right + padding),
      bottom: Math.min(height - 1, bounds.bottom + padding),
    }
  }

  private estimateBackgroundColor(bitmap: Buffer, width: number, height: number) {
    const sampleWidth = Math.max(1, Math.floor(width * 0.12))
    const sampleHeight = Math.max(1, Math.floor(height * 0.12))
    const corners = [
      { startX: 0, startY: 0 },
      { startX: Math.max(0, width - sampleWidth), startY: 0 },
      { startX: 0, startY: Math.max(0, height - sampleHeight) },
      { startX: Math.max(0, width - sampleWidth), startY: Math.max(0, height - sampleHeight) },
    ]

    let redTotal = 0
    let greenTotal = 0
    let blueTotal = 0
    let count = 0

    for (const corner of corners) {
      for (let y = corner.startY; y < corner.startY + sampleHeight; y += 1) {
        for (let x = corner.startX; x < corner.startX + sampleWidth; x += 1) {
          const offset = (y * width + x) * 4
          blueTotal += bitmap[offset]
          greenTotal += bitmap[offset + 1]
          redTotal += bitmap[offset + 2]
          count += 1
        }
      }
    }

    if (count === 0) {
      return { red: 255, green: 255, blue: 255 }
    }

    return {
      red: Math.round(redTotal / count),
      green: Math.round(greenTotal / count),
      blue: Math.round(blueTotal / count),
    }
  }

  private computeSealAlpha(
    red: number,
    green: number,
    blue: number,
    backgroundColor: { red: number; green: number; blue: number },
    options: ProcessingOptions,
  ): number {
    const brightness = (red + green + blue) / 3
    const backgroundBrightness = (backgroundColor.red + backgroundColor.green + backgroundColor.blue) / 3
    const isLight = brightness >= Math.max(175, Math.min(options.backgroundThreshold, backgroundBrightness + 6))
    const redLead = red - Math.max(green, blue)
    const redDominance = red - ((green + blue) / 2)
    const backgroundDistance = Math.abs(red - backgroundColor.red) + Math.abs(green - backgroundColor.green) + Math.abs(blue - backgroundColor.blue)
    const score = redLead * 1.9 + redDominance * 1.2 + backgroundDistance * 0.35 - (isLight ? 40 : 0) - options.redSensitivity

    if (score <= 0) {
      return 0
    }

    const alpha = Math.round((score / Math.max(options.edgeSoftness, 1)) * 255)
    return this.clampNumber(alpha, 0, 255, 0)
  }

  private cropBitmap(bitmap: Buffer, width: number, bounds: Bounds): Buffer {
    const targetWidth = bounds.right - bounds.left + 1
    const targetHeight = bounds.bottom - bounds.top + 1
    const target = Buffer.alloc(targetWidth * targetHeight * 4)

    for (let y = 0; y < targetHeight; y += 1) {
      const sourceStart = ((bounds.top + y) * width + bounds.left) * 4
      const sourceEnd = sourceStart + targetWidth * 4
      const targetStart = y * targetWidth * 4
      bitmap.copy(target, targetStart, sourceStart, sourceEnd)
    }

    return target
  }

  private resizeBitmapBilinear(source: Buffer, srcWidth: number, srcHeight: number, dstWidth: number, dstHeight: number): Buffer {
    if (srcWidth === dstWidth && srcHeight === dstHeight) {
      return Buffer.from(source)
    }

    const target = Buffer.alloc(dstWidth * dstHeight * 4)
    const scaleX = srcWidth / dstWidth
    const scaleY = srcHeight / dstHeight

    for (let y = 0; y < dstHeight; y += 1) {
      const srcY = (y + 0.5) * scaleY - 0.5
      const y0 = Math.max(0, Math.floor(srcY))
      const y1 = Math.min(srcHeight - 1, y0 + 1)
      const wy = srcY - y0

      for (let x = 0; x < dstWidth; x += 1) {
        const srcX = (x + 0.5) * scaleX - 0.5
        const x0 = Math.max(0, Math.floor(srcX))
        const x1 = Math.min(srcWidth - 1, x0 + 1)
        const wx = srcX - x0
        const targetOffset = (y * dstWidth + x) * 4

        for (let c = 0; c < 4; c += 1) {
          const p00 = source[(y0 * srcWidth + x0) * 4 + c]
          const p10 = source[(y0 * srcWidth + x1) * 4 + c]
          const p01 = source[(y1 * srcWidth + x0) * 4 + c]
          const p11 = source[(y1 * srcWidth + x1) * 4 + c]
          const top = p00 + (p10 - p00) * wx
          const bottom = p01 + (p11 - p01) * wx
          target[targetOffset + c] = Math.round(top + (bottom - top) * wy)
        }
      }
    }

    return target
  }

  private translateBounds(bounds: Bounds, offsetX: number, offsetY: number): Bounds {
    return {
      left: bounds.left + offsetX,
      top: bounds.top + offsetY,
      right: bounds.right + offsetX,
      bottom: bounds.bottom + offsetY,
    }
  }

  private writePngDpi(pngBytes: Buffer, dpi: number): Buffer {
    const ppm = Math.max(1, Math.round(dpi / 0.0254))
    const signature = pngBytes.subarray(0, 8)
    const chunks: Buffer[] = [signature]
    let offset = 8
    let inserted = false

    while (offset + 8 <= pngBytes.length) {
      const length = pngBytes.readUInt32BE(offset)
      const type = pngBytes.subarray(offset + 4, offset + 8).toString('ascii')
      const chunkEnd = offset + 12 + length
      if (chunkEnd > pngBytes.length) {
        break
      }

      if (type !== 'pHYs') {
        chunks.push(pngBytes.subarray(offset, chunkEnd))
      }

      if (!inserted && type === 'IHDR') {
        chunks.push(this.createPhysChunk(ppm))
        inserted = true
      }

      offset = chunkEnd
    }

    return Buffer.concat(chunks)
  }

  private createPhysChunk(ppm: number): Buffer {
    const type = Buffer.from('pHYs', 'ascii')
    const data = Buffer.alloc(9)
    data.writeUInt32BE(ppm, 0)
    data.writeUInt32BE(ppm, 4)
    data.writeUInt8(1, 8)
    const length = Buffer.alloc(4)
    length.writeUInt32BE(data.length, 0)
    const crcValue = this.computeCrc32(Buffer.concat([type, data]))
    const crc = Buffer.alloc(4)
    crc.writeUInt32BE(crcValue >>> 0, 0)
    return Buffer.concat([length, type, data, crc])
  }

  private computeCrc32(buffer: Buffer): number {
    let crc = 0xffffffff
    for (const byte of buffer) {
      crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8)
    }
    return (crc ^ 0xffffffff) >>> 0
  }

  private clampNumber(value: unknown, min: number, max: number, fallback: number): number {
    const normalized = Number(value)
    if (!Number.isFinite(normalized)) {
      return fallback
    }
    return Math.min(max, Math.max(min, Math.round(normalized)))
  }

  private getNativeImage(): typeof NativeImageModule | null {
    try {
      const electronModule = require('electron') as typeof import('electron')
      return electronModule?.nativeImage || null
    } catch {
      return null
    }
  }
}
