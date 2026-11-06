import { createApp, h, ComponentPublicInstance } from 'vue';
import { createRendererLogger } from '@/utils/logger';
import VueOfficeDocx from '@vue-office/docx';
import VueOfficeExcel from '@vue-office/excel';
import VueOfficePptx from '@vue-office/pptx';
import html2canvas from 'html2canvas';
import pdfWorkerSrc from 'pdfjs-dist/legacy/build/pdf.worker.mjs';
import * as XLSX from 'xlsx';

const logger = createRendererLogger('PreviewAdapter');

export interface PreviewOptions {
  width?: number;
  height?: number;
  quality?: number; // 0 to 1
}

export class PreviewAdapter {
  private static pdfjsLoadPromise: Promise<any> | null = null

  private static toAbsoluteAssetUrl(input: string): string {
    const value = String(input || '').trim()
    if (!value) return value
    if (value.startsWith('file://') || value.startsWith('http://') || value.startsWith('https://')) {
      return value
    }
    return new URL(value, window.location.href).toString()
  }

  private static async getPdfjs() {
    if (this.pdfjsLoadPromise) return this.pdfjsLoadPromise

    this.pdfjsLoadPromise = (async () => {
      const P = Promise as any
      if (typeof P.try !== 'function') {
        P.try = (fn: any, ...args: any[]) => Promise.resolve().then(() => fn(...args))
      }
      if (typeof P.withResolvers !== 'function') {
        P.withResolvers = () => {
          let resolve: (value: any) => void = () => void 0
          let reject: (reason?: any) => void = () => void 0
          const promise = new Promise((res, rej) => {
            resolve = res
            reject = rej
          })
          return { promise, resolve, reject }
        }
      }

      const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs')
      if (!pdfjsLib.GlobalWorkerOptions?.workerSrc) {
        pdfjsLib.GlobalWorkerOptions.workerSrc = this.toAbsoluteAssetUrl(pdfWorkerSrc)
      }
      return pdfjsLib
    })()

    return this.pdfjsLoadPromise
  }

  private static toFetchableUrl(input: string): string {
    if (input.startsWith('file://') || input.startsWith('http://') || input.startsWith('https://')) {
      return input
    }

    const p = String(input || '')
    if (!p) return input

    const normalized = p.replace(/\\/g, '/')
    const isUnc = normalized.startsWith('//')
    const prefix = isUnc ? 'file:' : 'file:///'
    const encoded = isUnc
      ? `//${encodeURI(normalized.slice(2))}`
      : encodeURI(normalized)

    return `${prefix}${encoded}`
  }

  private static fileUrlToPath(input: string): string {
    const s = String(input || '').trim()
    if (!s.startsWith('file://')) return s
    if (s.startsWith('file:///')) {
      return decodeURI(s.slice('file:///'.length)).replace(/\//g, '\\')
    }
    const rest = decodeURI(s.slice('file://'.length)).replace(/\//g, '\\')
    return `\\\\${rest.replace(/^[\\]+/, '')}`
  }

  private static async readFileBuffer(filePath: string): Promise<ArrayBuffer> {
    const p = String(filePath || '').trim()
    if (!p) return new ArrayBuffer(0)

    const isHttp = p.startsWith('http://') || p.startsWith('https://')
    const api: any = (window as any)?.electronAPI
    const readFileBytes: any = api?.fs?.readFileBytes

    if (!isHttp && typeof readFileBytes === 'function') {
      const localPath = p.startsWith('file://') ? this.fileUrlToPath(p) : p
      const res = await readFileBytes(localPath)
      if (res?.success && res?.data) {
        const u8 = res.data instanceof Uint8Array ? res.data : new Uint8Array(res.data as any)
        return u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength)
      }
    }

    const url = this.toFetchableUrl(p)
    const response = await fetch(url)
    return await response.arrayBuffer()
  }

  /**
   * Automatically detect file type and extract a preview image (Data URL).
   * @param filePath The local file path (or file URL)
   * @param options Options for the extracted image
   * @returns DataURL string of the preview image
   */
  static async extractPreview(filePath: string, options: PreviewOptions = {}): Promise<string> {
    const ext = filePath.split('.').pop()?.toLowerCase();
    
    // Read file as ArrayBuffer or Blob depending on environment
    let fileBuffer: ArrayBuffer;
    try {
      fileBuffer = await this.readFileBuffer(filePath)
    } catch (error) {
      logger.error('Failed to read file:', error);
      throw new Error(`Failed to read file: ${filePath}`);
    }

    if (ext === 'pdf') {
      return this.extractPdf(fileBuffer, options);
    } else if (ext === 'jpg' || ext === 'jpeg' || ext === 'png' || ext === 'gif' || ext === 'webp') {
      return this.extractImage(fileBuffer, ext, options);
    } else if (ext === 'docx') {
      return this.extractOffice(VueOfficeDocx, fileBuffer, options);
    } else if (ext === 'xlsx' || ext === 'xls') {
      return this.extractExcel(fileBuffer, options);
    } else if (ext === 'pptx' || ext === 'ppt') {
      return this.extractOffice(VueOfficePptx, fileBuffer, options);
    } else {
      throw new Error(`Unsupported file extension: ${ext}`);
    }
  }

  private static async extractExcel(buffer: ArrayBuffer, options: PreviewOptions): Promise<string> {
    try {
      return await this.extractOffice(VueOfficeExcel, buffer, options);
    } catch (error) {
      logger.error('Excel preview via vue-office failed, fallback to xlsx renderer', error);
      return await this.extractExcelFallback(buffer, options);
    }
  }

  private static async extractExcelFallback(buffer: ArrayBuffer, options: PreviewOptions): Promise<string> {
    const u8 = new Uint8Array(buffer);
    const workbook = XLSX.read(u8, { type: 'array', cellDates: true });
    const sheetName = (workbook.SheetNames || [])[0];
    if (!sheetName) {
      throw new Error('Excel workbook has no sheets');
    }
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) {
      throw new Error('Excel sheet is missing');
    }

    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false, raw: false }) as unknown as any[][];
    const maxRows = 30;
    const maxCols = 12;
    const clippedRows = (Array.isArray(rows) ? rows : []).slice(0, maxRows).map((r) => (Array.isArray(r) ? r.slice(0, maxCols) : []));
    const cols = clippedRows.reduce((m, r) => Math.max(m, Array.isArray(r) ? r.length : 0), 0);

    const escapeHtml = (v: unknown) => String(v ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');

    const header = clippedRows[0] || [];
    const body = clippedRows.slice(1);

    const cellsToTr = (r: any[]) => {
      const out: string[] = [];
      for (let i = 0; i < cols; i += 1) {
        const val = i < r.length ? r[i] : '';
        out.push(`<td>${escapeHtml(val)}</td>`);
      }
      return `<tr>${out.join('')}</tr>`;
    };

    const html = [
      `<div style="font-family: -apple-system,BlinkMacSystemFont,'Segoe UI',Arial,'PingFang SC','Microsoft YaHei',sans-serif; font-size: 12px; color: #111; padding: 16px;">`,
      `<div style="font-weight: 600; margin-bottom: 10px;">${escapeHtml(sheetName)}</div>`,
      `<table style="border-collapse: collapse; width: 100%; background: #fff;">`,
      `<tbody>`,
      cellsToTr(header),
      ...body.map(cellsToTr),
      `</tbody>`,
      `</table>`,
      `<style>td{border:1px solid #e5e7eb;padding:6px 8px;vertical-align:top;white-space:nowrap;max-width:260px;overflow:hidden;text-overflow:ellipsis;}</style>`,
      `</div>`,
    ].join('');

    return await this.renderHtmlToDataUrl(html, options);
  }

  private static async renderHtmlToDataUrl(html: string, options: PreviewOptions): Promise<string> {
    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.top = '-9999px';
    container.style.left = '-9999px';
    container.style.width = '800px';
    container.style.background = '#fff';
    container.innerHTML = html;
    document.body.appendChild(container);

    try {
      await new Promise(r => setTimeout(r, 50));
      const canvas = await html2canvas(container, {
        scale: 1,
        useCORS: true,
        logging: false,
      });
      const quality = typeof options.quality === 'number' ? options.quality : 0.75
      return canvas.toDataURL('image/webp', quality);
    } finally {
      if (container.parentNode) {
        container.parentNode.removeChild(container);
      }
    }
  }

  private static async extractImage(buffer: ArrayBuffer, ext: string, options: PreviewOptions): Promise<string> {
    const mimeMap: Record<string, string> = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      webp: 'image/webp',
    }

    const mimeType = mimeMap[ext] || 'application/octet-stream'
    const blob = new Blob([buffer], { type: mimeType })

    const targetWidth = Math.max(1, Math.floor(options.width || 480))
    const quality = typeof options.quality === 'number' ? options.quality : 0.75

    let bitmap: ImageBitmap | null = null
    let objectUrl: string | null = null

    try {
      bitmap = await createImageBitmap(blob)
    } catch {
      objectUrl = URL.createObjectURL(blob)
      const img = new Image()
      img.decoding = 'async'
      img.src = objectUrl
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve()
        img.onerror = () => reject(new Error('Failed to decode image'))
      })
      const canvas = document.createElement('canvas')
      const scale = img.width > 0 ? targetWidth / img.width : 1
      const w = img.width > 0 ? targetWidth : targetWidth
      const h = img.height > 0 ? Math.max(1, Math.round(img.height * scale)) : targetWidth
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Could not get canvas context')
      ctx.drawImage(img, 0, 0, w, h)
      return canvas.toDataURL('image/webp', quality)
    } finally {
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }

    try {
      const canvas = document.createElement('canvas')
      const scale = bitmap.width > 0 ? targetWidth / bitmap.width : 1
      const w = bitmap.width > 0 ? targetWidth : targetWidth
      const h = bitmap.height > 0 ? Math.max(1, Math.round(bitmap.height * scale)) : targetWidth
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Could not get canvas context')
      ctx.drawImage(bitmap, 0, 0, w, h)
      return canvas.toDataURL('image/webp', quality)
    } finally {
      bitmap.close()
    }
  }

  /**
   * Extract a preview image from a PDF file.
   */
  private static async extractPdf(buffer: ArrayBuffer, options: PreviewOptions): Promise<string> {
    const pdfjsLib = await this.getPdfjs()
    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(buffer),
      disableWorker: true
    });
    const pdf = await loadingTask.promise;

    try {
      const page = await pdf.getPage(1);
      const initialViewport = page.getViewport({ scale: 1 });

      const targetWidth = Math.max(1, Math.floor(options.width || 480))
      const scale = initialViewport.width > 0 ? targetWidth / initialViewport.width : 1
      const viewport = page.getViewport({ scale: Math.max(0.1, scale) });

      const maxPixels = 4096 * 4096
      const pixelCount = Math.floor(viewport.width) * Math.floor(viewport.height)
      const safeViewport =
        pixelCount > maxPixels && pixelCount > 0
          ? page.getViewport({ scale: Math.max(0.1, scale * Math.sqrt(maxPixels / pixelCount)) })
          : viewport

      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');

      if (!context) {
        throw new Error('Could not get canvas context');
      }

      canvas.width = Math.max(1, Math.floor(safeViewport.width));
      canvas.height = Math.max(1, Math.floor(safeViewport.height));

      await page.render({ canvasContext: context, viewport: safeViewport }).promise;
      const quality = typeof options.quality === 'number' ? options.quality : 0.75
      return canvas.toDataURL('image/webp', quality);
    } finally {
      await pdf.destroy().catch(() => void 0)
    }
  }

  /**
   * Extract a preview image from an Office file using Vue components.
   */
  private static async extractOffice(
    Component: any,
    buffer: ArrayBuffer,
    options: PreviewOptions
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      // Create a hidden container
      const container = document.createElement('div');
      container.style.position = 'absolute';
      container.style.top = '-9999px';
      container.style.left = '-9999px';
      container.style.width = '800px';
      container.style.height = '1000px';
      container.style.overflow = 'hidden';
      container.style.background = '#fff';
      document.body.appendChild(container);

      let app: any = null;
      const capturedErrors: any[] = [];
      let settled = false;
      let timeoutId: number | null = null;

      const serializeUnknown = (value: unknown) => {
        const t = typeof value
        if (!value || (t !== 'object' && t !== 'function')) return { typeof: t, raw: value }
        const v: any = value as any
        const name = typeof v?.name === 'string' ? v.name : undefined
        const message = typeof v?.message === 'string' ? v.message : undefined
        const stack = typeof v?.stack === 'string' ? v.stack : undefined
        const raw = String(value)
        const keys = (() => {
          try { return Object.keys(v || {}) } catch { return [] }
        })()
        return { typeof: t, name, message, stack, raw, keys }
      }

      const onWindowError = (ev: ErrorEvent) => {
        capturedErrors.push({
          type: 'error',
          message: ev.message,
          filename: ev.filename,
          lineno: ev.lineno,
          colno: ev.colno,
          error: serializeUnknown(ev.error),
        })
      }

      const onUnhandledRejection = (ev: PromiseRejectionEvent) => {
        capturedErrors.push({
          type: 'unhandledrejection',
          reason: serializeUnknown(ev.reason),
        })
      }

      window.addEventListener('error', onWindowError)
      window.addEventListener('unhandledrejection', onUnhandledRejection)

      // The @vue-office components usually emit a "rendered" event
      const onRendered = async () => {
        if (settled) return
        settled = true
        try {
          // Wait a bit for DOM to fully settle
          await new Promise(r => setTimeout(r, 500));
          
          const canvas = await html2canvas(container, {
            scale: 1,
            useCORS: true,
            logging: false,
          });
          
          const dataUrl = canvas.toDataURL('image/webp', options.quality || 0.75);
          if (timeoutId !== null) {
            window.clearTimeout(timeoutId)
            timeoutId = null
          }
          cleanup();
          resolve(dataUrl);
        } catch (error) {
          logger.error('Office preview html2canvas failed', { error: serializeUnknown(error), capturedErrors });
          if (timeoutId !== null) {
            window.clearTimeout(timeoutId)
            timeoutId = null
          }
          cleanup();
          reject(error);
        }
      };

      const onError = (error: any) => {
        if (settled) return
        settled = true
        const sig = (() => {
          try {
            const u8 = new Uint8Array(buffer)
            const head = u8.slice(0, 16)
            return Array.from(head).map(b => b.toString(16).padStart(2, '0')).join('')
          } catch {
            return ''
          }
        })()
        logger.error('Office preview component onError', {
          error: serializeUnknown(error),
          capturedErrors,
          bufferBytes: buffer?.byteLength ?? 0,
          signatureHex: sig,
        });
        if (timeoutId !== null) {
          window.clearTimeout(timeoutId)
          timeoutId = null
        }
        cleanup();
        reject(error);
      };

      const cleanup = () => {
        if (timeoutId !== null) {
          window.clearTimeout(timeoutId)
          timeoutId = null
        }
        window.removeEventListener('error', onWindowError)
        window.removeEventListener('unhandledrejection', onUnhandledRejection)
        if (app) {
          app.unmount();
        }
        if (container.parentNode) {
          container.parentNode.removeChild(container);
        }
      };

      // Create a temporary Vue app to render the component
      app = createApp({
        render() {
          return h(Component, {
            src: buffer,
            onRendered: onRendered,
            onError: onError
          });
        }
      });

      app.mount(container);
      
      // Fallback timeout in case "rendered" is never emitted
      timeoutId = window.setTimeout(() => {
        logger.error('Office preview render timeout', { capturedErrors, bufferBytes: buffer?.byteLength ?? 0 })
        onError(new Error('Office render timeout'));
      }, 10000);
    });
  }
}
