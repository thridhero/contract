import * as path from 'path';
import { pathToFileURL } from 'url';

const READABLE_STREAM_ASYNC_ITERATOR_POLYFILL = `
          if (typeof ReadableStream !== 'undefined' && !ReadableStream.prototype[Symbol.asyncIterator]) {
            ReadableStream.prototype[Symbol.asyncIterator] = async function* () {
              const reader = this.getReader();
              try {
                while (true) {
                  const result = await reader.read();
                  if (result.done) {
                    break;
                  }
                  yield result.value;
                }
              } finally {
                reader.releaseLock();
              }
            };
          }
`;

export function buildPdfPageCountScript(filePath: string, pdfModulePath: string): string {
  const pdfModuleUrl = pathToFileURL(pdfModulePath).href;
  const pdfWorkerPath = pathToFileURL(path.join(path.dirname(pdfModulePath), 'pdf.worker.mjs')).href;
  return `
      (async () => {
        try {
          const fs = require('fs');
${READABLE_STREAM_ASYNC_ITERATOR_POLYFILL}
          const pdfjsLib = await import(${JSON.stringify(pdfModuleUrl)});
          pdfjsLib.GlobalWorkerOptions.workerSrc = ${JSON.stringify(pdfWorkerPath)};
          
          const data = new Uint8Array(fs.readFileSync(${JSON.stringify(filePath)}));
          const loadingTask = pdfjsLib.getDocument({
            data,
            disableWorker: true,
            useWorkerFetch: false,
            isEvalSupported: false,
          });
          const pdf = await loadingTask.promise;
          return pdf.numPages;
        } catch (err) {
          console.error('PDF 页面统计脚本执行失败:', err);
          throw err;
        }
      })()
    `;
}

export function buildPdfRenderScript(
  filePath: string,
  startPage: number,
  endPage: number,
  pdfModulePath: string,
  scale: number,
): string {
  const pdfModuleUrl = pathToFileURL(pdfModulePath).href;
  const pdfWorkerPath = pathToFileURL(path.join(path.dirname(pdfModulePath), 'pdf.worker.mjs')).href;
  return `
      (async () => {
        try {
          const fs = require('fs');
${READABLE_STREAM_ASYNC_ITERATOR_POLYFILL}
          const pdfjsLib = await import(${JSON.stringify(pdfModuleUrl)});
          pdfjsLib.GlobalWorkerOptions.workerSrc = ${JSON.stringify(pdfWorkerPath)};

          const data = new Uint8Array(fs.readFileSync(${JSON.stringify(filePath)}));
          const loadingTask = pdfjsLib.getDocument({
            data,
            disableWorker: true,
            useWorkerFetch: false,
            isEvalSupported: false,
          });
          const pdf = await loadingTask.promise;
          const pages = [];
          for (let pageNumber = ${startPage}; pageNumber <= ${endPage}; pageNumber += 1) {
            const page = await pdf.getPage(pageNumber);
            const viewport = page.getViewport({ scale: ${scale} });
            const canvas = document.createElement('canvas');
            canvas.width = Math.max(1, Math.ceil(viewport.width));
            canvas.height = Math.max(1, Math.ceil(viewport.height));
            const context = canvas.getContext('2d', { alpha: false });
            if (!context) {
              throw new Error('无法创建 OCR Canvas 上下文');
            }
            await page.render({ canvasContext: context, viewport }).promise;
            pages.push({
              pageNumber,
              dataUrl: canvas.toDataURL('image/png'),
              width: canvas.width,
              height: canvas.height,
            });
          }
          return pages;
        } catch (err) {
          console.error('PDF 页面渲染脚本执行失败:', err);
          throw err;
        }
      })()
    `;
}

export function buildPdfTextExtractionScript(filePath: string, pdfModulePath: string): string {
  const pdfModuleUrl = pathToFileURL(pdfModulePath).href;
  const pdfWorkerPath = pathToFileURL(path.join(path.dirname(pdfModulePath), 'pdf.worker.mjs')).href;
  return `
      (async () => {
        try {
          const fs = require('fs');
${READABLE_STREAM_ASYNC_ITERATOR_POLYFILL}
          const pdfjsLib = await import(${JSON.stringify(pdfModuleUrl)});
          pdfjsLib.GlobalWorkerOptions.workerSrc = ${JSON.stringify(pdfWorkerPath)};

          const data = new Uint8Array(fs.readFileSync(${JSON.stringify(filePath)}));
          const loadingTask = pdfjsLib.getDocument({
            data,
            disableWorker: true,
            useWorkerFetch: false,
            isEvalSupported: false,
          });
          const pdf = await loadingTask.promise;
          const pages = [];
          for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
            const page = await pdf.getPage(pageNumber);
            const content = await page.getTextContent();
            const text = (content.items || [])
              .map((item) => String(item && item.str ? item.str : '').trim())
              .filter(Boolean)
              .join(' ')
              .trim();
            if (text) {
              pages.push(text);
            }
          }
          return pages.join('\\n\\n');
        } catch (err) {
          console.error('PDF 文本提取脚本执行失败:', err);
          throw err;
        }
      })()
    `;
}

export function buildPdfTextBlocksExtractionScript(filePath: string, pdfModulePath: string): string {
  const pdfModuleUrl = pathToFileURL(pdfModulePath).href;
  const pdfWorkerPath = pathToFileURL(path.join(path.dirname(pdfModulePath), 'pdf.worker.mjs')).href;
  return `
      (async () => {
        try {
          const fs = require('fs');
${READABLE_STREAM_ASYNC_ITERATOR_POLYFILL}
          const pdfjsLib = await import(${JSON.stringify(pdfModuleUrl)});
          pdfjsLib.GlobalWorkerOptions.workerSrc = ${JSON.stringify(pdfWorkerPath)};

          const data = new Uint8Array(fs.readFileSync(${JSON.stringify(filePath)}));
          const loadingTask = pdfjsLib.getDocument({
            data,
            disableWorker: true,
            useWorkerFetch: false,
            isEvalSupported: false,
          });
          const pdf = await loadingTask.promise;
          const pages = [];
          for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
            const page = await pdf.getPage(pageNumber);
            const viewport = page.getViewport({ scale: 1 });
            const content = await page.getTextContent();
            const blocks = (content.items || [])
              .map((item) => {
                const text = String(item && item.str ? item.str : '').trim();
                if (!text) return null;
                const transform = Array.isArray(item.transform) ? item.transform : [];
                const x = Number(transform[4] || 0);
                const y = Number(transform[5] || 0);
                const rawWidth = Number(item.width || 0);
                const rawHeight = Math.abs(Number(transform[3] || item.height || 0));
                const width = Math.max(rawWidth, 1);
                const height = Math.max(rawHeight, 1);
                const top = viewport.height - y;
                const left = x;
                if (!(viewport.width > 0) || !(viewport.height > 0)) return null;
                return {
                  text,
                  rect: {
                    left: Math.max(0, Math.min(1, left / viewport.width)),
                    top: Math.max(0, Math.min(1, top / viewport.height)),
                    width: Math.max(0, Math.min(1, width / viewport.width)),
                    height: Math.max(0, Math.min(1, height / viewport.height)),
                  },
                };
              })
              .filter(Boolean);
            pages.push({ pageNumber, blocks });
          }
          return pages;
        } catch (err) {
          console.error('PDF 文本块提取脚本执行失败:', err);
          throw err;
        }
      })()
    `;
}
