import { IpcMainInvokeEvent } from 'electron';
import * as channels from '../../channels';
import { FileConversionService } from '../../../services/file/FileConversionService';
import { PdfOcrService } from '../../../services/file/PdfOcrService';
import { ok, fail } from '../../../../shared/types/ipc.types';
import {
  FileConversionResult,
  PdfTextSearchHighlightRequest,
  PdfTextSearchHighlightResult,
} from '../../../../shared/types/fileConversion.types';

export const fileConversionHandlers: Record<string, (event: IpcMainInvokeEvent, ...args: unknown[]) => Promise<unknown>> = {

  [channels.FILE_CONVERT_TO_MD]: async (_, filePath: unknown): Promise<{ success: boolean; data?: FileConversionResult; error?: string }> => {
    try {
      const service = FileConversionService.getInstance();
      const result = await service.convertToMarkdown(String(filePath));
      return ok(result);
    } catch (error) {
      return fail(error);
    }
  },

  [channels.FILE_OCR_CHECK_STATUS]: async (): Promise<{ success: boolean; data?: unknown; error?: string }> => {
    try {
      const service = PdfOcrService.getInstance();
      const result = await service.checkStatus();
      return ok(result);
    } catch (error) {
      return fail(error);
    }
  },

  [channels.FILE_OCR_TEST]: async (_, imagePath: unknown): Promise<{ success: boolean; data?: unknown; error?: string }> => {
    try {
      const service = PdfOcrService.getInstance();
      const result = await service.testOcr(String(imagePath));
      return ok(result);
    } catch (error) {
      return fail(error);
    }
  },

  [channels.FILE_PDF_SEARCH_HIGHLIGHTS]: async (
    _,
    payload: unknown,
  ): Promise<{ success: boolean; data?: PdfTextSearchHighlightResult; error?: string }> => {
    try {
      const service = PdfOcrService.getInstance();
      const result = await service.findTextHighlightsInPdf(payload as PdfTextSearchHighlightRequest);
      return ok(result);
    } catch (error) {
      return fail(error);
    }
  },

};
