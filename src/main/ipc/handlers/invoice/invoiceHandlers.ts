import { IpcMainInvokeEvent } from 'electron';
import * as channels from '../../channels';
import { ok, fail, IpcResponse } from '../../../../shared/types/ipc.types';
import type { InvoiceParseResult } from '../../../../shared/types/invoice.types';
import { detectInvoiceFromMarkdown, parseInvoiceFromMarkdown } from '../../../services/invoice/InvoiceMarkdownParser';
import { createLogger } from '../../../utils/logger';

const logger = createLogger('InvoiceHandlers');

export const invoiceHandlers: Record<string, (event: IpcMainInvokeEvent, ...args: unknown[]) => Promise<unknown>> = {
  [channels.INVOICE_DETECT_FROM_MD]: async (_event: IpcMainInvokeEvent, markdown: unknown): Promise<IpcResponse<{ isInvoice: boolean; confidence: number }>> => {
    try {
      const text = typeof markdown === 'string' ? markdown : String(markdown ?? '');
      const result = detectInvoiceFromMarkdown(text);
      return ok({
        isInvoice: result.isInvoice,
        confidence: result.confidence,
      });
    } catch (error) {
      logger.error('检测发票 Markdown 失败:', error);
      return fail(error);
    }
  },

  [channels.INVOICE_PARSE_FROM_MD]: async (_event: IpcMainInvokeEvent, markdown: unknown): Promise<IpcResponse<InvoiceParseResult>> => {
    try {
      const text = typeof markdown === 'string' ? markdown : String(markdown ?? '');
      const result = parseInvoiceFromMarkdown(text);
      return ok(result);
    } catch (error) {
      logger.error('解析发票 Markdown 失败:', error);
      return fail(error);
    }
  },
};

