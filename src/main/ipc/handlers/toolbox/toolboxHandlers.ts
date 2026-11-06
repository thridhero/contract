import { IpcMainInvokeEvent } from 'electron'
import * as channels from '../../channels'
import { fail, ok } from '../../../../shared/types/ipc.types'
import type {
  BatchImageOcrRequest,
  BatchImageOcrResult,
  BatchStampPdfFilesRequest,
  BatchStampPdfFilesResult,
  CompressPdfFileRequest,
  CompressPdfFileResult,
  CreateImagePdfRequest,
  CreateImagePdfResult,
  EstimatePdfCompressionRequest,
  EstimatePdfCompressionResult,
  ExportImageOcrDocxRequest,
  ExportImageOcrDocxResult,
  InspectPdfFilesRequest,
  InspectPdfFilesResult,
  MergePdfFilesRequest,
  MergePdfFilesResult,
  ProcessSignatureImageRequest,
  ProcessSignatureImageResult,
  ProcessSealImageRequest,
  ProcessSealImageResult,
  ScanOcrImageFolderRequest,
  ScanOcrImageFolderResult,
  SplitPdfFilesRequest,
  SplitPdfFilesResult,
  ScanImageFolderRequest,
  ScanImageFolderResult,
} from '../../../../shared/types/toolbox.types'
import { ImagePdfService } from '../../../services/toolbox/ImagePdfService'
import { ImageOcrService } from '../../../services/toolbox/ImageOcrService'
import { PdfBatchStampService } from '../../../services/toolbox/PdfBatchStampService'
import { PdfCompressService } from '../../../services/toolbox/PdfCompressService'
import { PdfMergeService } from '../../../services/toolbox/PdfMergeService'
import { PdfSplitService } from '../../../services/toolbox/PdfSplitService'
import { SealExtractionService } from '../../../services/toolbox/SealExtractionService'
import { SignatureCutoutService } from '../../../services/toolbox/SignatureCutoutService'

export const toolboxHandlers: Record<string, (event: IpcMainInvokeEvent, ...args: unknown[]) => Promise<unknown>> = {
  [channels.TOOLBOX_SCAN_IMAGE_FOLDER]: async (
    _event,
    payload: unknown,
  ): Promise<{ success: boolean; data?: ScanImageFolderResult; error?: string }> => {
    try {
      const result = await ImagePdfService.getInstance().scanImageFolder(payload as ScanImageFolderRequest)
      return ok(result)
    } catch (error) {
      return fail(error)
    }
  },

  [channels.TOOLBOX_SCAN_OCR_IMAGE_FOLDER]: async (
    _event,
    payload: unknown,
  ): Promise<{ success: boolean; data?: ScanOcrImageFolderResult; error?: string }> => {
    try {
      const result = await ImageOcrService.getInstance().scanImageFolder(payload as ScanOcrImageFolderRequest)
      return ok(result)
    } catch (error) {
      return fail(error)
    }
  },

  [channels.TOOLBOX_BATCH_IMAGE_OCR]: async (
    _event,
    payload: unknown,
  ): Promise<{ success: boolean; data?: BatchImageOcrResult; error?: string }> => {
    try {
      const result = await ImageOcrService.getInstance().batchOcr(payload as BatchImageOcrRequest)
      return ok(result)
    } catch (error) {
      return fail(error)
    }
  },

  [channels.TOOLBOX_EXPORT_IMAGE_OCR_DOCX]: async (
    _event,
    payload: unknown,
  ): Promise<{ success: boolean; data?: ExportImageOcrDocxResult; error?: string }> => {
    try {
      const result = await ImageOcrService.getInstance().exportToDocx(payload as ExportImageOcrDocxRequest)
      return ok(result)
    } catch (error) {
      return fail(error)
    }
  },

  [channels.TOOLBOX_CREATE_IMAGE_PDF]: async (
    _event,
    payload: unknown,
  ): Promise<{ success: boolean; data?: CreateImagePdfResult; error?: string }> => {
    try {
      const result = await ImagePdfService.getInstance().createImagePdf(payload as CreateImagePdfRequest)
      return ok(result)
    } catch (error) {
      return fail(error)
    }
  },

  [channels.TOOLBOX_PROCESS_SIGNATURE_IMAGE]: async (
    _event,
    payload: unknown,
  ): Promise<{ success: boolean; data?: ProcessSignatureImageResult; error?: string }> => {
    try {
      const result = await SignatureCutoutService.getInstance().processSignatureImage(payload as ProcessSignatureImageRequest)
      return ok(result)
    } catch (error) {
      return fail(error)
    }
  },

  [channels.TOOLBOX_PROCESS_SEAL_IMAGE]: async (
    _event,
    payload: unknown,
  ): Promise<{ success: boolean; data?: ProcessSealImageResult; error?: string }> => {
    try {
      const result = await SealExtractionService.getInstance().processSealImage(payload as ProcessSealImageRequest)
      return ok(result)
    } catch (error) {
      return fail(error)
    }
  },

  [channels.TOOLBOX_INSPECT_PDF_FILES]: async (
    _event,
    payload: unknown,
  ): Promise<{ success: boolean; data?: InspectPdfFilesResult; error?: string }> => {
    try {
      const result = await PdfMergeService.getInstance().inspectPdfFiles(payload as InspectPdfFilesRequest)
      return ok(result)
    } catch (error) {
      return fail(error)
    }
  },

  [channels.TOOLBOX_MERGE_PDF_FILES]: async (
    _event,
    payload: unknown,
  ): Promise<{ success: boolean; data?: MergePdfFilesResult; error?: string }> => {
    try {
      const result = await PdfMergeService.getInstance().mergePdfFiles(payload as MergePdfFilesRequest)
      return ok(result)
    } catch (error) {
      return fail(error)
    }
  },

  [channels.TOOLBOX_SPLIT_PDF_FILES]: async (
    _event,
    payload: unknown,
  ): Promise<{ success: boolean; data?: SplitPdfFilesResult; error?: string }> => {
    try {
      const result = await PdfSplitService.getInstance().splitPdfFiles(payload as SplitPdfFilesRequest)
      return ok(result)
    } catch (error) {
      return fail(error)
    }
  },

  [channels.TOOLBOX_ESTIMATE_PDF_COMPRESSION]: async (
    _event,
    payload: unknown,
  ): Promise<{ success: boolean; data?: EstimatePdfCompressionResult; error?: string }> => {
    try {
      const result = await PdfCompressService.getInstance().estimateCompression(payload as EstimatePdfCompressionRequest)
      return ok(result)
    } catch (error) {
      return fail(error)
    }
  },

  [channels.TOOLBOX_COMPRESS_PDF_FILE]: async (
    event,
    payload: unknown,
  ): Promise<{ success: boolean; data?: CompressPdfFileResult; error?: string }> => {
    try {
      const result = await PdfCompressService.getInstance().compressPdfFile(
        payload as CompressPdfFileRequest,
        progress => event.sender.send(channels.TOOLBOX_PDF_COMPRESSION_PROGRESS, progress),
      )
      return ok(result)
    } catch (error) {
      return fail(error)
    }
  },

  [channels.TOOLBOX_BATCH_STAMP_PDF_FILES]: async (
    _event,
    payload: unknown,
  ): Promise<{ success: boolean; data?: BatchStampPdfFilesResult; error?: string }> => {
    try {
      const result = await PdfBatchStampService.getInstance().batchStampPdfFiles(payload as BatchStampPdfFilesRequest)
      return ok(result)
    } catch (error) {
      return fail(error)
    }
  },
}
