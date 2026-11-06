export type ToolboxCollectionKey =
  | 'image-ocr'
  | 'image-processing'
  | 'image-to-pdf'
  | 'pdf-tools'

export type ToolboxToolKey =
  | 'batch-image-ocr'
  | 'signature-cutout'
  | 'seal-extraction'
  | 'multi-image-to-pdf'
  | 'pdf-merge'
  | 'pdf-split'
  | 'pdf-compress'
  | 'pdf-batch-stamp'

export type ToolboxImageSource = 'file' | 'folder'
export type ToolboxOcrStatus = 'idle' | 'processing' | 'success' | 'error'

export interface ToolboxImageItem {
  id: string
  name: string
  path: string
  relativePath?: string
  width?: number
  height?: number
  size: number
  source: ToolboxImageSource
}

export interface ScanImageFolderRequest {
  folderPath: string
  recursive: boolean
}

export interface ScanImageFolderResult {
  folderPath: string
  items: ToolboxImageItem[]
}

export interface CreateImagePdfRequest {
  images: ToolboxImageItem[]
  outputPath: string
  pagePreset: 'A4'
  marginPx: number
  openAfterSave?: boolean
}

export interface CreateImagePdfResult {
  outputPath: string
  pageCount: number
  fileSize: number
}

export type ScanEnhanceSourceKind = 'pdf' | 'image'
export type ScanEnhanceProfile = 'document'
export type ScanEnhanceOutputKind = 'pdf' | 'images'
export type ScanEnhanceImageFormat = 'png' | 'jpg'

export interface ScanEnhanceItem {
  id: string
  sourceKind: ScanEnhanceSourceKind
  sourcePath: string
  sourceName: string
  name: string
  pageNumber?: number
  pageCount?: number
  width: number
  height: number
  size: number
  previewDataUrl?: string
  outputPath?: string
  processedPreviewDataUrl?: string
  status?: 'idle' | 'processing' | 'success' | 'error'
  errorMessage?: string
}

export interface InspectScanEnhanceInputsRequest {
  sourceKind: ScanEnhanceSourceKind
  filePaths: string[]
}

export interface InspectScanEnhanceInputsResult {
  sourceKind: ScanEnhanceSourceKind
  items: ScanEnhanceItem[]
}

export interface RunScanEnhanceRequest {
  sourceKind: ScanEnhanceSourceKind
  items: ScanEnhanceItem[]
  profile: ScanEnhanceProfile
  outputKind: ScanEnhanceOutputKind
  outputPath: string
  imageFormat?: ScanEnhanceImageFormat
  openAfterSave?: boolean
}

export interface ScanEnhanceItemResult {
  id: string
  outputPath?: string
  processedPreviewDataUrl?: string
  width?: number
  height?: number
  status: 'success' | 'error'
  errorMessage?: string
}

export interface RunScanEnhanceResult {
  outputKind: ScanEnhanceOutputKind
  outputPath: string
  fileSize: number
  totalCount: number
  successCount: number
  failureCount: number
  generatedFiles: string[]
  itemResults: ScanEnhanceItemResult[]
}

export type ScanEnhanceProgressStage =
  | 'checking'
  | 'rendering'
  | 'enhancing'
  | 'writing'
  | 'completed'

export interface ScanEnhanceProgressPayload {
  stage: ScanEnhanceProgressStage
  percent: number
  currentPage: number
  totalPages: number
  message: string
}

export interface ToolboxOcrImageItem extends ToolboxImageItem {
  status: ToolboxOcrStatus
  recognizedText?: string
  elapsedMs?: number
  errorMessage?: string
}

export interface ScanOcrImageFolderRequest {
  folderPath: string
  recursive: boolean
}

export interface ScanOcrImageFolderResult {
  folderPath: string
  items: ToolboxImageItem[]
}

export interface BatchImageOcrRequest {
  images: ToolboxImageItem[]
}

export interface BatchImageOcrResult {
  items: ToolboxOcrImageItem[]
  successCount: number
  failureCount: number
}

export interface ExportImageOcrDocxRequest {
  items: ToolboxOcrImageItem[]
  outputPath: string
  documentTitle?: string
}

export interface ExportImageOcrDocxResult {
  outputPath: string
  fileSize: number
  exportedCount: number
}

export interface SignatureCutoutInputImage {
  filePath: string
}

export interface SignatureCropBounds {
  left: number
  top: number
  right: number
  bottom: number
}

export interface ProcessSignatureImageRequest {
  filePath: string
  backgroundThreshold?: number
  saturationThreshold?: number
  softness?: number
  cropBounds?: SignatureCropBounds | null
}

export interface ProcessSignatureImageResult {
  sourcePath: string
  outputFileName: string
  width: number
  height: number
  pngBytes: Uint8Array
  previewBytes: Uint8Array
  trimBounds: SignatureCropBounds
  appliedCropBounds: SignatureCropBounds
}

export type SealShapeType = 'circle' | 'ellipse' | 'unknown'
export type SealExportScaleMode = 'dpi-scale'

export interface SealCropBounds {
  left: number
  top: number
  right: number
  bottom: number
}

export interface ProcessSealImageRequest {
  filePath: string
  legalConfirmed: boolean
  backgroundThreshold?: number
  redSensitivity?: number
  edgeSoftness?: number
  dpi?: number
  scaleMode?: SealExportScaleMode
  cropBounds?: SealCropBounds | null
}

export interface ProcessSealImageResult {
  sourcePath: string
  outputFileName: string
  width: number
  height: number
  exportWidth: number
  exportHeight: number
  dpi: number
  scaleMode: SealExportScaleMode
  pngBytes: Uint8Array
  previewBytes: Uint8Array
  trimBounds: SealCropBounds
  appliedCropBounds: SealCropBounds
  detectedShape: SealShapeType
  warningMessage?: string
}

export interface ToolboxPdfItem {
  id: string
  name: string
  path: string
  size: number
  pageCount: number
  selected: boolean
  rangeStart: number
  rangeEnd: number
}

export interface InspectPdfFilesRequest {
  filePaths: string[]
}

export interface InspectPdfFilesResult {
  items: ToolboxPdfItem[]
}

export interface MergePdfFilesRequest {
  files: ToolboxPdfItem[]
  outputPath: string
  openAfterSave?: boolean
}

export interface MergePdfFilesResult {
  outputPath: string
  pageCount: number
  fileSize: number
}

export type ToolboxPdfSplitMode = 'max-pages' | 'custom-ranges'

export interface ToolboxPdfSplitRange {
  start: number
  end: number
  label?: string
}

export interface ToolboxPdfSplitItem extends ToolboxPdfItem {
  splitMode: ToolboxPdfSplitMode
  pagesPerChunk: number
  customRanges: ToolboxPdfSplitRange[]
}

export interface SplitPdfFilesRequest {
  files: ToolboxPdfSplitItem[]
  outputDir: string
  openAfterSave?: boolean
}

export interface SplitPdfGeneratedFile {
  outputPath: string
  pageCount: number
  fileSize: number
  sourceName: string
}

export interface SplitPdfFilesResult {
  outputDir: string
  generatedFiles: SplitPdfGeneratedFile[]
  fileCount: number
  pageCount: number
  totalSize: number
}

export interface ConvertPdfToWordRequest {
  files: ToolboxPdfItem[]
  outputDir: string
  openAfterSave?: boolean
}

export interface PdfToWordGeneratedFile {
  sourcePath: string
  sourceName: string
  outputPath: string
  fileSize: number
  markdownPath: string
  pageCount: number
}

export interface ConvertPdfToWordResult {
  outputDir: string
  generatedFiles: PdfToWordGeneratedFile[]
  fileCount: number
  pageCount: number
  totalSize: number
  runtimeVersion: string
}

export type ToolboxPdfCompressionLevel = 'light' | 'standard' | 'strong'

export interface InspectSinglePdfResult {
  path: string
  name: string
  size: number
  pageCount: number
  hasTextLayer: boolean
  isPureScan: boolean
}

export interface EstimatePdfCompressionRequest {
  filePath: string
  level: ToolboxPdfCompressionLevel
}

export interface EstimatePdfCompressionResult extends InspectSinglePdfResult {
  level: ToolboxPdfCompressionLevel
  estimatedMinSize: number
  estimatedMaxSize: number
  summary: string
}

export interface CompressPdfFileRequest {
  filePath: string
  outputPath: string
  level: ToolboxPdfCompressionLevel
  openAfterSave?: boolean
}

export type PdfCompressionProgressStage =
  | 'checking'
  | 'rendering'
  | 'rebuilding'
  | 'writing'
  | 'completed'

export interface PdfCompressionProgressPayload {
  stage: PdfCompressionProgressStage
  percent: number
  currentPage: number
  totalPages: number
  message: string
}

export interface CompressPdfFileResult {
  outputPath: string
  originalSize: number
  compressedSize: number
  savedBytes: number
  compressionRatio: number
  pageCount: number
  level: ToolboxPdfCompressionLevel
  hasTextLayer: boolean
  isPureScan: boolean
}

export type ToolboxPdfStampMode = 'position' | 'seam'

export interface ToolboxPdfStampImage {
  filePath: string
}

export interface ToolboxPdfStampPlacement {
  x: number
  y: number
}

export interface BatchStampPdfFilesRequest {
  files: ToolboxPdfItem[]
  stampImage: ToolboxPdfStampImage
  mode: ToolboxPdfStampMode
  placement?: ToolboxPdfStampPlacement
  stampWidthPt: number
  rotationDegrees: number
  opacity: number
  outputDir: string
  openAfterSave?: boolean
}

export interface BatchStampPdfGeneratedFile {
  sourcePath: string
  sourceName: string
  outputPath: string
  fileSize: number
  pageCount: number
}

export interface BatchStampPdfFilesResult {
  outputDir: string
  generatedFiles: BatchStampPdfGeneratedFile[]
  fileCount: number
  pageCount: number
  totalSize: number
}
