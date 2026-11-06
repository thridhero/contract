import * as path from 'path'
import * as fs from 'fs-extra'
import type { nativeImage as NativeImageModule } from 'electron'
import type {
  SignatureCropBounds,
  ProcessSignatureImageRequest,
  ProcessSignatureImageResult,
} from '../../../shared/types/toolbox.types'

type TrimBounds = ProcessSignatureImageResult['trimBounds']

type RgbColor = {
  red: number
  green: number
  blue: number
}

type ProcessingOptions = {
  backgroundThreshold: number
  saturationThreshold: number
  softness: number
}

export class SignatureCutoutService {
  private static instance: SignatureCutoutService

  private constructor() {}

  public static getInstance(): SignatureCutoutService {
    if (!SignatureCutoutService.instance) {
      SignatureCutoutService.instance = new SignatureCutoutService()
    }
    return SignatureCutoutService.instance
  }

  public async processSignatureImage(request: ProcessSignatureImageRequest): Promise<ProcessSignatureImageResult> {
    const filePath = path.resolve(String(request.filePath || '').trim())
    if (!filePath) {
      throw new Error('图片路径不能为空')
    }
    if (!(await fs.pathExists(filePath))) {
      throw new Error(`图片不存在: ${filePath}`)
    }

    const nativeImage = this.getNativeImage()
    if (!nativeImage) {
      throw new Error('当前运行环境无法处理签名图片，请在 Electron 应用内执行该操作')
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

    const localBounds = this.removeBackground(croppedSourceBitmap, croppedWidth, croppedHeight, options)
    if (!localBounds) {
      throw new Error('未检测到有效签字内容')
    }

    const finalBitmap = this.cropBitmap(croppedSourceBitmap, croppedWidth, localBounds)
    const trimmedWidth = localBounds.right - localBounds.left + 1
    const trimmedHeight = localBounds.bottom - localBounds.top + 1
    const trimBounds = this.translateBounds(localBounds, appliedCropBounds.left, appliedCropBounds.top)
    const pngBytes = nativeImage.createFromBitmap(finalBitmap, {
      width: trimmedWidth,
      height: trimmedHeight,
      scaleFactor: 1,
    }).toPNG()

    const outputFileName = `${path.basename(filePath, path.extname(filePath))}-signature.png`

    return {
      sourcePath: filePath,
      outputFileName,
      width: trimmedWidth,
      height: trimmedHeight,
      pngBytes: new Uint8Array(pngBytes),
      previewBytes: new Uint8Array(pngBytes),
      trimBounds,
      appliedCropBounds,
    }
  }

  private resolveOptions(request: ProcessSignatureImageRequest): ProcessingOptions {
    return {
      backgroundThreshold: this.clampNumber(request.backgroundThreshold, 208, 252, 244),
      saturationThreshold: this.clampNumber(request.saturationThreshold, 8, 80, 26),
      softness: this.clampNumber(request.softness, 4, 64, 18),
    }
  }

  private resolveCropBounds(cropBounds: SignatureCropBounds | null | undefined, width: number, height: number): SignatureCropBounds {
    if (!cropBounds) {
      return { left: 0, top: 0, right: width - 1, bottom: height - 1 }
    }

    const left = this.clampNumber(cropBounds.left, 0, width - 1, 0)
    const top = this.clampNumber(cropBounds.top, 0, height - 1, 0)
    const right = this.clampNumber(cropBounds.right, left, width - 1, width - 1)
    const bottom = this.clampNumber(cropBounds.bottom, top, height - 1, height - 1)

    return { left, top, right, bottom }
  }

  private removeBackground(bitmap: Buffer, width: number, height: number, options: ProcessingOptions): TrimBounds | null {
    const backgroundColor = this.estimateBackgroundColor(bitmap, width, height)
    const backgroundBrightness = (backgroundColor.red + backgroundColor.green + backgroundColor.blue) / 3
    const effectiveBrightnessThreshold = Math.max(180, Math.min(options.backgroundThreshold, Math.round(backgroundBrightness) - 1))
    const trimAlphaThreshold = 18
    let left = width
    let top = height
    let right = -1
    let bottom = -1

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

        const nextAlpha = this.computePixelAlpha(
          red,
          green,
          blue,
          backgroundColor,
          effectiveBrightnessThreshold,
          options.saturationThreshold,
          options.softness,
        )
        bitmap[offset + 3] = nextAlpha

        if (nextAlpha < trimAlphaThreshold) {
          continue
        }

        left = Math.min(left, x)
        top = Math.min(top, y)
        right = Math.max(right, x)
        bottom = Math.max(bottom, y)
      }
    }

    if (right < left || bottom < top) {
      return null
    }

    return { left, top, right, bottom }
  }

  private estimateBackgroundColor(bitmap: Buffer, width: number, height: number): RgbColor {
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
          const blue = bitmap[offset]
          const green = bitmap[offset + 1]
          const red = bitmap[offset + 2]
          redTotal += red
          greenTotal += green
          blueTotal += blue
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

  private computePixelAlpha(
    red: number,
    green: number,
    blue: number,
    backgroundColor: RgbColor,
    brightnessThreshold: number,
    saturationThreshold: number,
    softness: number,
  ): number {
    const brightness = (red + green + blue) / 3
    const brightnessDelta = Math.max(brightnessThreshold - brightness, 0)
    const backgroundDistance = Math.max(
      Math.abs(red - backgroundColor.red),
      Math.abs(green - backgroundColor.green),
      Math.abs(blue - backgroundColor.blue),
    )
    const localSaturation = Math.max(red, green, blue) - Math.min(red, green, blue)
    const colorDelta = Math.max(backgroundDistance, localSaturation) - saturationThreshold
    const inkScore = brightnessDelta + Math.max(colorDelta, 0) * 1.9

    if (inkScore <= 0) {
      return 0
    }

    const alpha = Math.round((inkScore / softness) * 255)
    return this.clampNumber(alpha, 0, 255, 0)
  }

  private cropBitmap(bitmap: Buffer, width: number, bounds: TrimBounds): Buffer {
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

  private translateBounds(bounds: TrimBounds, offsetX: number, offsetY: number): TrimBounds {
    return {
      left: bounds.left + offsetX,
      top: bounds.top + offsetY,
      right: bounds.right + offsetX,
      bottom: bounds.bottom + offsetY,
    }
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
