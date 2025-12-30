/**
 * Grade Service for scantron processing and grading
 *
 * Handles PDF parsing, QR code reading, bubble detection, and grade calculation.
 */

import { cv } from 'opencv-wasm'
import sharp from 'sharp'
import { readBarcodesFromImageData, prepareZXingModule, type ReaderOptions } from 'zxing-wasm/reader'
import Tesseract from 'tesseract.js'
import * as mupdf from 'mupdf'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { BrowserWindow } from 'electron'
import { driveService } from './drive.service'
import { scantronLookupService } from './scantron-lookup.service'
import type { GradeProgressEvent, ResolvedScantronData, ScantronQRDataV1V2 } from '../../shared/types'
// Note: registrationService removed - phone scan deskewing is not reliably supported

// Initialize zxing-wasm for Node.js environment
// We need to load the WASM binary from the filesystem
let zxingInitialized = false
async function initZXing(): Promise<void> {
  if (zxingInitialized) return

  try {
    // Find the wasm file in node_modules
    // In production, this will be bundled differently, but for dev we can find it
    const possiblePaths = [
      join(process.cwd(), 'node_modules', 'zxing-wasm', 'dist', 'reader', 'zxing_reader.wasm'),
      join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'node_modules', 'zxing-wasm', 'dist', 'reader', 'zxing_reader.wasm')
    ]

    let wasmBuffer: Buffer | null = null
    for (const wasmPath of possiblePaths) {
      try {
        wasmBuffer = readFileSync(wasmPath)
        console.log('[GradeService] Loaded zxing-wasm from:', wasmPath)
        break
      } catch {
        // Try next path
      }
    }

    if (!wasmBuffer) {
      console.error('[GradeService] Could not find zxing_reader.wasm file')
      return
    }

    prepareZXingModule({
      overrides: {
        wasmBinary: wasmBuffer.buffer as ArrayBuffer
      }
    })

    zxingInitialized = true
    console.log('[GradeService] zxing-wasm initialized successfully')
  } catch (error) {
    console.error('[GradeService] Failed to initialize zxing-wasm:', error)
  }
}

import type {
  GradeProcessRequest,
  GradeProcessResult,
  ParsedScantron,
  DetectedBubble,
  BubbleDetection,
  AssignmentGrades,
  GradeRecord,
  AnswerResult,
  GradeFlag,
  GradeStats,
  GradeOverride,
  SaveGradesInput,
  BubbleDetectionOptions,
  FlaggedBubbleImage,
  ServiceResult,
  Assignment,
  Assessment,
  Roster,
  VersionId,
  UnidentifiedPage,
  PageType,
  AnswerKeyEntry,
  Gradebook,
  GradebookEntry,
  GradebookAssessment,
  GradeInfo,
  Question
} from '../../shared/types'

// Log OpenCV load status at module initialization
console.log('[GradeService] opencv-wasm module loaded')
console.log('[GradeService] cv object:', cv ? 'present' : 'undefined')
console.log('[GradeService] cv.Mat:', typeof cv?.Mat)
console.log('[GradeService] cv.CV_8UC1:', cv?.CV_8UC1)

// Layout constants from pdf.service.ts (at 72 DPI)
// BUBBLE_GRID_Y_START calculated from pdf.service.ts:
//   MARGIN (50) + header (86) = 136pt, then QR section ends at 236pt, +20 spacing = 256pt
const LAYOUT = {
  MARGIN: 50,
  BUBBLE_RADIUS: 7,
  BUBBLE_SPACING: 22,
  ROW_HEIGHT: 24,
  QUESTIONS_PER_COLUMN: 25,
  QR_SIZE: 80,
  QR_Y_START: 146, // Y position where QR code starts (header ends at 136, +10 offset)
  BUBBLE_GRID_Y_START: 256, // FIXED: Header + QR section + spacing = 256pt at 72 DPI
  QUESTION_NUM_WIDTH: 30,
  CHOICE_LABELS: ['A', 'B', 'C', 'D'] as const,
  LETTER_WIDTH: 612,
  LETTER_HEIGHT: 792
}


// Default bubble detection options
const DEFAULT_DETECTION_OPTIONS: Required<BubbleDetectionOptions> = {
  minRadius: 10,
  maxRadius: 30,
  fillThreshold: 0.4,
  confidenceThreshold: 0.7
}

// Disable worker for Node.js environment
// The worker is not needed in Node.js and causes issues

interface CircleData {
  x: number
  y: number
  radius: number
  fillPercentage: number
}

class GradeService {
  /**
   * Broadcast progress to all renderer windows
   */
  private broadcastProgress(progress: GradeProgressEvent): void {
    const windows = BrowserWindow.getAllWindows()
    for (const win of windows) {
      win.webContents.send('grade:progress', progress)
    }
  }

  /**
   * Main entry point: Process a scantron PDF and extract grades
   */
  async processScantronPDF(request: GradeProcessRequest): Promise<ServiceResult<GradeProcessResult>> {
    const startTime = performance.now()
    console.log('[GradeService] Starting processScantronPDF')

    try {
      // Decode PDF from base64
      console.log('[GradeService] Decoding PDF from base64...')
      const pdfBuffer = Buffer.from(request.pdfBase64, 'base64')
      console.log('[GradeService] PDF buffer size:', pdfBuffer.length)

      // Get assignment and assessment for grading
      const assignmentResult = await driveService.getAssignment(request.assignmentId)
      if (!assignmentResult.success || !assignmentResult.data) {
        return {
          success: false,
          error: `Assignment not found: ${request.assignmentId}`
        }
      }
      const assignment = assignmentResult.data

      const assessmentResult = await driveService.getAssessment(assignment.assessmentId)
      if (!assessmentResult.success || !assessmentResult.data) {
        return {
          success: false,
          error: `Assessment not found: ${assignment.assessmentId}`
        }
      }
      const assessment = assessmentResult.data

      // Get roster for student lookup
      const rosterResult = await driveService.getRoster(request.sectionId)
      if (!rosterResult.success || !rosterResult.data) {
        return {
          success: false,
          error: `Roster not found for section: ${request.sectionId}`
        }
      }
      const roster = rosterResult.data

      // Extract pages as images
      console.log('[GradeService] Extracting pages as images...')
      this.broadcastProgress({
        stage: 'extracting',
        currentPage: 0,
        totalPages: 0,
        message: 'Extracting pages from PDF...'
      })
      const pageImages = await this.extractPagesAsImages(pdfBuffer)
      console.log('[GradeService] Extracted', pageImages.length, 'pages')

      // Parse each page using the new V2 method (registration marks + position-based detection)
      const parsedPages: ParsedScantron[] = []
      for (let i = 0; i < pageImages.length; i++) {
        console.log(`[GradeService] Parsing page ${i + 1}/${pageImages.length}...`)
        this.broadcastProgress({
          stage: 'parsing',
          currentPage: i + 1,
          totalPages: pageImages.length,
          message: `Grading test ${i + 1} of ${pageImages.length}...`
        })
        const parsed = await this.parseScantronPageV2(
          pageImages[i],
          i + 1,
          assessment.questions.length
        )
        parsedPages.push(parsed)
      }

      // Broadcast grading stage
      this.broadcastProgress({
        stage: 'grading',
        currentPage: pageImages.length,
        totalPages: pageImages.length,
        message: 'Calculating grades...'
      })

      // Calculate grades and identify unidentified pages
      const { grades, unidentifiedPages, answerKey } = this.calculateGradesWithUnidentified(
        parsedPages,
        assignment,
        assessment,
        roster
      )

      // Identify flagged records
      const flaggedRecords = grades.records.filter((r) => r.needsReview)

      // Calculate summary statistics
      const totalPages = parsedPages.length
      const identifiedPages = grades.records.length
      const unidentifiedCount = unidentifiedPages.length
      const blankPages = parsedPages.filter((p) => this.isBlankPage(p)).length
      const unknownDocuments = totalPages - identifiedPages - unidentifiedCount - blankPages

      const processingTimeMs = performance.now() - startTime

      console.log(`[GradeService] Processing complete:
        - Total pages: ${totalPages}
        - Identified: ${identifiedPages}
        - Unidentified: ${unidentifiedCount}
        - Blank: ${blankPages}
        - Unknown: ${unknownDocuments}
        - Time: ${processingTimeMs.toFixed(0)}ms`)

      // Broadcast completion
      this.broadcastProgress({
        stage: 'complete',
        currentPage: totalPages,
        totalPages,
        message: `Grading complete: ${identifiedPages} graded, ${unidentifiedCount} need review`
      })

      return {
        success: true,
        data: {
          success: true,
          parsedPages,
          grades,
          flaggedRecords,
          unidentifiedPages,
          answerKey,
          processingTimeMs,
          summary: {
            totalPages,
            identifiedPages,
            unidentifiedPages: unidentifiedCount,
            blankPages,
            unknownDocuments
          }
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to process scantron PDF'
      return {
        success: false,
        error: message
      }
    }
  }

  /**
   * Extract pages from PDF as image buffers using mupdf
   */
  private async extractPagesAsImages(pdfBuffer: Buffer): Promise<Buffer[]> {
    const images: Buffer[] = []

    try {
      console.log('[GradeService] Loading PDF document with mupdf...')

      // Open PDF document with mupdf
      const doc = mupdf.Document.openDocument(pdfBuffer, 'application/pdf')
      const pageCount = doc.countPages()
      console.log('[GradeService] PDF loaded, numPages:', pageCount)

      // Process each page
      for (let pageNum = 0; pageNum < pageCount; pageNum++) {
        console.log(`[GradeService] Extracting page ${pageNum + 1}/${pageCount}...`)

        const page = doc.loadPage(pageNum)
        const bounds = page.getBounds()

        // Calculate dimensions at 150 DPI (default is 72 DPI)
        const scale = 150 / 72
        const width = Math.floor((bounds[2] - bounds[0]) * scale)
        const height = Math.floor((bounds[3] - bounds[1]) * scale)
        console.log(`[GradeService] Page dimensions: ${width}x${height}`)

        // Render page to pixmap
        const matrix = mupdf.Matrix.scale(scale, scale)
        const pixmap = page.toPixmap(matrix, mupdf.ColorSpace.DeviceRGB, false, true)

        // Get PNG data
        const pngData = pixmap.asPNG()
        const pngBuffer = Buffer.from(pngData)
        console.log(`[GradeService] Page ${pageNum + 1} converted to PNG, size: ${pngBuffer.length}`)
        images.push(pngBuffer)

        // Clean up
        pixmap.destroy()
        page.destroy()
      }

      doc.destroy()
    } catch (error) {
      console.error('[GradeService] Error extracting pages:', error)
      throw error
    }

    return images
  }

  /**
   * Parse a single scantron page
   */
  async parseScantronPage(
    imageBuffer: Buffer,
    pageNumber: number,
    expectedQuestionCount: number
  ): Promise<ParsedScantron> {
    const startTime = performance.now()
    const flags: string[] = []

    // Get image dimensions
    const metadata = await sharp(imageBuffer).metadata()
    const imageWidth = metadata.width || 0
    const imageHeight = metadata.height || 0

    // Calculate DPI scale factor
    const dpiScale = imageWidth / LAYOUT.LETTER_WIDTH

    // Read QR code
    let qrData: ResolvedScantronData | null = null
    let qrError: string | undefined

    console.log(`[GradeService] Page ${pageNumber}: Reading QR code (dpiScale: ${dpiScale.toFixed(2)})...`)
    try {
      qrData = await this.extractQRCode(imageBuffer, dpiScale)
      if (!qrData) {
        qrError = 'QR code not found or unreadable'
        flags.push('qr_error')
        console.log(`[GradeService] Page ${pageNumber}: QR code not found`)
      } else {
        console.log(`[GradeService] Page ${pageNumber}: QR code found - student: ${qrData.studentId}`)
      }
    } catch (error) {
      qrError = error instanceof Error ? error.message : 'QR code read error'
      flags.push('qr_error')
      console.log(`[GradeService] Page ${pageNumber}: QR code error:`, error)
    }

    // Detect bubbles
    // Question count comes from the assessment, not QR (QR is simplified to just aid+sid)
    const detectedBubbles = await this.detectBubbles(imageBuffer, expectedQuestionCount, dpiScale)

    // Check for issues
    let overallConfidence = 1.0
    for (const bubble of detectedBubbles) {
      if (bubble.multipleDetected) {
        flags.push(`multiple_bubbles_q${bubble.questionNumber}`)
        overallConfidence = Math.min(overallConfidence, 0.5)
      }
      if (bubble.selected === null) {
        flags.push(`no_answer_q${bubble.questionNumber}`)
      }
      const maxConfidence = Math.max(...bubble.bubbles.map((b) => b.confidence))
      overallConfidence = Math.min(overallConfidence, maxConfidence)
    }

    const processingTimeMs = performance.now() - startTime

    return {
      pageNumber,
      success: !qrError && flags.length === 0,
      qrData,
      qrError,
      answers: detectedBubbles,
      confidence: overallConfidence,
      processingTimeMs,
      flags,
      imageWidth,
      imageHeight
    }
  }

  /**
   * Try to decode QR code from image data using zxing-wasm
   * Returns ResolvedScantronData which normalizes v1/v2/v3 formats
   */
  private async tryDecodeQR(data: Buffer, width: number, height: number): Promise<ResolvedScantronData | null> {
    // Ensure zxing-wasm is initialized
    await initZXing()

    // Convert grayscale to RGBA for zxing-wasm
    const rgbaData = new Uint8ClampedArray(width * height * 4)
    for (let j = 0; j < data.length; j++) {
      const idx = j * 4
      rgbaData[idx] = data[j]
      rgbaData[idx + 1] = data[j]
      rgbaData[idx + 2] = data[j]
      rgbaData[idx + 3] = 255
    }

    // Create ImageData-like object for zxing
    const imageData = {
      data: rgbaData,
      width,
      height,
      colorSpace: 'srgb' as const
    }

    // Configure reader for QR codes with high tolerance
    const readerOptions: ReaderOptions = {
      formats: ['QRCode'],
      tryHarder: true,
      tryRotate: true,
      tryInvert: true,
      tryDownscale: true,
      maxNumberOfSymbols: 1
    }

    try {
      const results = await readBarcodesFromImageData(imageData, readerOptions)

      if (results.length > 0) {
        const qrText = results[0].text
        console.log('[GradeService] zxing decoded QR text:', qrText)

        // Try v3 format first (short key: "TH:XXXXXXXX")
        if (scantronLookupService.isV3Format(qrText)) {
          const key = scantronLookupService.parseQRString(qrText)
          if (key) {
            const lookup = scantronLookupService.getLookup(key)
            if (lookup) {
              console.log('[GradeService] v3 QR resolved from database:', lookup.studentId)
              return {
                assignmentId: lookup.assignmentId,
                studentId: lookup.studentId,
                format: lookup.format,
                dokLevel: lookup.dokLevel,
                versionId: lookup.versionId
              }
            }
            console.log('[GradeService] v3 QR key not found in database:', key)
          }
          return null
        }

        // Try v1/v2 JSON format
        try {
          const parsed = JSON.parse(qrText) as ScantronQRDataV1V2
          // Accept both v1 (standard scantron) and v2 (quiz format with DOK/version)
          if (parsed.v === 1 || parsed.v === 2) {
            return {
              assignmentId: parsed.aid,
              studentId: parsed.sid,
              format: parsed.fmt,
              dokLevel: parsed.dok,
              versionId: parsed.ver
            }
          }
          console.log('[GradeService] Unknown QR version:', parsed.v)
        } catch {
          console.log('[GradeService] QR text is not valid JSON:', qrText)
        }
      }
    } catch (error) {
      console.log('[GradeService] zxing decode error:', error)
    }

    return null
  }

  /**
   * Extract QR code from scantron image
   * Tries multiple strategies for robust detection:
   * 1. Full page scan at different scales
   * 2. Region-specific extraction (quiz QR in top-left, standard in different location)
   * 3. Multiple image processing techniques (sharpen, threshold, normalize)
   * Returns ResolvedScantronData which normalizes v1/v2/v3 formats
   */
  private async extractQRCode(imageBuffer: Buffer, dpiScale: number): Promise<ResolvedScantronData | null> {
    // Get original dimensions for scaling
    const metadata = await sharp(imageBuffer).metadata()
    const originalWidth = metadata.width || 1275
    const originalHeight = metadata.height || 1650

    // Strategy 1: Try full page at 2x scale (fastest if QR is clear)
    console.log('[GradeService] Strategy 1: Full page 2x scale...')
    let result = await this.tryQRWithProcessing(imageBuffer, originalWidth, 2, false)
    if (result) return result

    // Strategy 2: Extract just the top-left region where quiz QR codes are located
    // Quiz QR is at (36, 36) with size 50 at 72 DPI
    // At current DPI: position and size scale accordingly
    console.log('[GradeService] Strategy 2: Quiz QR region extraction...')
    const qrRegionSize = Math.floor(120 * dpiScale) // Extract 120pt square (generous margin)
    const qrRegionX = Math.floor(20 * dpiScale) // Start slightly before expected position
    const qrRegionY = Math.floor(20 * dpiScale)

    try {
      const qrRegion = await sharp(imageBuffer)
        .extract({
          left: Math.max(0, qrRegionX),
          top: Math.max(0, qrRegionY),
          width: Math.min(qrRegionSize, originalWidth - qrRegionX),
          height: Math.min(qrRegionSize, originalHeight - qrRegionY)
        })
        .toBuffer()

      // Try the region with multiple processing techniques
      result = await this.tryQRWithProcessing(qrRegion, qrRegionSize, 3, false) // 3x scale for small region
      if (result) {
        console.log('[GradeService] QR found in quiz region')
        return result
      }

      // Try with sharpening
      result = await this.tryQRWithProcessing(qrRegion, qrRegionSize, 3, true)
      if (result) {
        console.log('[GradeService] QR found in quiz region (sharpened)')
        return result
      }
    } catch (error) {
      console.log('[GradeService] Error extracting quiz QR region:', error)
    }

    // Strategy 3: Try full page rotated 180 degrees (upside down)
    console.log('[GradeService] Strategy 3: Full page rotated 180°...')
    try {
      const rotatedBuffer = await sharp(imageBuffer).rotate(180).toBuffer()
      result = await this.tryQRWithProcessing(rotatedBuffer, originalWidth, 2, false)
      if (result) {
        console.log('[GradeService] QR found (page was upside down)')
        return result
      }
    } catch (error) {
      console.log('[GradeService] Error with rotated scan:', error)
    }

    // Strategy 4: Try different scales on full page
    console.log('[GradeService] Strategy 4: Trying multiple scales...')
    for (const scale of [1.5, 2.5, 3]) {
      result = await this.tryQRWithProcessing(imageBuffer, originalWidth, scale, false)
      if (result) {
        console.log(`[GradeService] QR found at ${scale}x scale`)
        return result
      }
    }

    // Strategy 5: Try with aggressive image processing
    console.log('[GradeService] Strategy 5: Aggressive processing...')
    result = await this.tryQRWithProcessing(imageBuffer, originalWidth, 2, true)
    if (result) {
      console.log('[GradeService] QR found with sharpening')
      return result
    }

    // Strategy 6: Try with thresholding (binarization)
    console.log('[GradeService] Strategy 6: Thresholded image...')
    try {
      const thresholdedBuffer = await sharp(imageBuffer)
        .grayscale()
        .threshold(128)
        .toBuffer()
      result = await this.tryQRWithProcessing(thresholdedBuffer, originalWidth, 2, false)
      if (result) {
        console.log('[GradeService] QR found with thresholding')
        return result
      }
    } catch (error) {
      // Continue
    }

    console.log('[GradeService] No QR code found after all strategies')
    return null
  }

  /**
   * Try to decode QR with specific processing options
   */
  private async tryQRWithProcessing(
    imageBuffer: Buffer,
    baseWidth: number,
    scale: number,
    sharpen: boolean
  ): Promise<ResolvedScantronData | null> {
    try {
      let pipeline = sharp(imageBuffer)
        .resize({ width: Math.floor(baseWidth * scale) })
        .grayscale()

      if (sharpen) {
        pipeline = pipeline.sharpen({ sigma: 1.5 })
      }

      pipeline = pipeline.normalize()

      const { data, info } = await pipeline.raw().toBuffer({ resolveWithObject: true })
      return await this.tryDecodeQR(data, info.width, info.height)
    } catch (error) {
      return null
    }
  }


  /**
   * Detect filled bubbles in scantron image
   */
  private async detectBubbles(
    imageBuffer: Buffer,
    questionCount: number,
    dpiScale: number,
    options: BubbleDetectionOptions = {}
  ): Promise<DetectedBubble[]> {
    const opts = { ...DEFAULT_DETECTION_OPTIONS, ...options }

    // Scale detection parameters for DPI
    const scaledMinRadius = Math.floor(opts.minRadius * dpiScale)
    const scaledMaxRadius = Math.ceil(opts.maxRadius * dpiScale)
    const scaledMinDist = Math.floor(20 * dpiScale)

    // Load image as grayscale
    const { data, info } = await sharp(imageBuffer)
      .grayscale()
      .raw()
      .toBuffer({ resolveWithObject: true })

    // Validate image data
    if (!data || data.length === 0) {
      console.error('Empty image data received')
      return []
    }

    if (info.width === 0 || info.height === 0) {
      console.error('Invalid image dimensions:', info)
      return []
    }

    // Convert Buffer to Uint8Array for OpenCV
    const imageData = new Uint8Array(data)

    let mat: ReturnType<typeof cv.Mat> | null = null
    let blurred: ReturnType<typeof cv.Mat> | null = null
    let circles: ReturnType<typeof cv.Mat> | null = null
    const detectedCircles: CircleData[] = []

    try {
      console.log('[GradeService] Creating OpenCV Mat:', { height: info.height, width: info.width, dataLength: imageData.length })

      // Check if cv is properly loaded
      if (!cv || !cv.Mat) {
        throw new Error('OpenCV not properly initialized - cv.Mat is undefined')
      }

      // Create OpenCV matrix
      mat = new cv.Mat(info.height, info.width, cv.CV_8UC1)
      console.log('[GradeService] Mat created, setting data...')
      mat.data.set(imageData)
      console.log('[GradeService] Data set successfully')

      // Apply Gaussian blur
      console.log('[GradeService] Applying Gaussian blur...')
      blurred = new cv.Mat()
      cv.GaussianBlur(mat, blurred, new cv.Size(5, 5), 0)
      console.log('[GradeService] Gaussian blur complete')

      // Detect circles using Hough Circle Transform
      console.log('[GradeService] Running HoughCircles...')
      circles = new cv.Mat()
      cv.HoughCircles(
        blurred,
        circles,
        cv.HOUGH_GRADIENT,
        1, // dp
        scaledMinDist, // minDist
        50, // param1 (Canny threshold)
        30, // param2 (accumulator threshold)
        scaledMinRadius,
        scaledMaxRadius
      )

      // Extract circle data
      for (let i = 0; i < circles.cols; i++) {
        const x = Math.round(circles.data32F[i * 3])
        const y = Math.round(circles.data32F[i * 3 + 1])
        const radius = Math.round(circles.data32F[i * 3 + 2])

        const fillPercentage = this.calculateFillPercentage(mat, x, y, radius)
        detectedCircles.push({ x, y, radius, fillPercentage })
      }
    } catch (cvError) {
      console.error('OpenCV error during bubble detection:', cvError)
      console.error('Image info:', { width: info.width, height: info.height, dataLength: imageData.length })
    } finally {
      // Clean up OpenCV objects
      if (mat) mat.delete()
      if (blurred) blurred.delete()
      if (circles) circles.delete()
    }

    // Map circles to question grid
    const bubbles = this.mapCirclesToQuestions(
      detectedCircles,
      questionCount,
      dpiScale,
      opts.fillThreshold,
      opts.confidenceThreshold
    )

    return bubbles
  }

  /**
   * Calculate fill percentage for a bubble
   */
  private calculateFillPercentage(
    mat: { cols: number; rows: number; ucharPtr: (y: number, x: number) => number[] },
    centerX: number,
    centerY: number,
    radius: number
  ): number {
    let darkPixels = 0
    let totalPixels = 0

    // Sample inner 70% of bubble
    const innerRadius = Math.floor(radius * 0.7)

    for (let dy = -innerRadius; dy <= innerRadius; dy++) {
      for (let dx = -innerRadius; dx <= innerRadius; dx++) {
        if (dx * dx + dy * dy <= innerRadius * innerRadius) {
          const px = centerX + dx
          const py = centerY + dy

          if (px >= 0 && px < mat.cols && py >= 0 && py < mat.rows) {
            totalPixels++
            const pixelValue = mat.ucharPtr(py, px)[0]
            if (pixelValue < 128) {
              darkPixels++
            }
          }
        }
      }
    }

    return totalPixels > 0 ? darkPixels / totalPixels : 0
  }

  /**
   * Map detected circles to question/choice grid
   */
  private mapCirclesToQuestions(
    circles: CircleData[],
    questionCount: number,
    dpiScale: number,
    fillThreshold: number,
    _confidenceThreshold: number
  ): DetectedBubble[] {
    const bubbles: DetectedBubble[] = []
    const columnCount = Math.ceil(questionCount / LAYOUT.QUESTIONS_PER_COLUMN)

    // Calculate expected positions
    const gridStartY = Math.floor(LAYOUT.BUBBLE_GRID_Y_START * dpiScale)
    const rowHeight = Math.floor(LAYOUT.ROW_HEIGHT * dpiScale)
    const bubbleSpacing = Math.floor(LAYOUT.BUBBLE_SPACING * dpiScale)
    const columnWidth = Math.floor((LAYOUT.LETTER_WIDTH - 2 * LAYOUT.MARGIN) / columnCount * dpiScale)
    const bubbleStartOffset = Math.floor((LAYOUT.QUESTION_NUM_WIDTH + 5) * dpiScale)

    for (let q = 0; q < questionCount; q++) {
      const column = Math.floor(q / LAYOUT.QUESTIONS_PER_COLUMN)
      const row = q % LAYOUT.QUESTIONS_PER_COLUMN

      const columnX = Math.floor(LAYOUT.MARGIN * dpiScale) + column * columnWidth
      const rowY = gridStartY + row * rowHeight + Math.floor(rowHeight / 2)

      const bubbleDetections: BubbleDetection[] = []

      // Find bubbles for each choice (A, B, C, D)
      for (let c = 0; c < LAYOUT.CHOICE_LABELS.length; c++) {
        const expectedX = columnX + bubbleStartOffset + c * bubbleSpacing + Math.floor(LAYOUT.BUBBLE_RADIUS * dpiScale)
        const expectedY = rowY

        // Find closest circle to expected position
        let bestMatch: CircleData | null = null
        let bestDistance = Infinity

        for (const circle of circles) {
          const dx = circle.x - expectedX
          const dy = circle.y - expectedY
          const distance = Math.sqrt(dx * dx + dy * dy)

          // Accept circles within reasonable tolerance
          const tolerance = LAYOUT.BUBBLE_RADIUS * dpiScale * 2
          if (distance < tolerance && distance < bestDistance) {
            bestDistance = distance
            bestMatch = circle
          }
        }

        const filled = bestMatch ? bestMatch.fillPercentage >= fillThreshold : false

        bubbleDetections.push({
          id: LAYOUT.CHOICE_LABELS[c],
          filled,
          confidence: bestMatch ? (filled ? bestMatch.fillPercentage : 1 - bestMatch.fillPercentage) : 0,
          x: bestMatch?.x || expectedX,
          y: bestMatch?.y || expectedY,
          radius: bestMatch?.radius || Math.floor(LAYOUT.BUBBLE_RADIUS * dpiScale),
          fillPercentage: bestMatch?.fillPercentage || 0
        })
      }

      // Determine selected answer
      const filledBubbles = bubbleDetections.filter((b) => b.filled)
      let selected: string | null = null
      let multipleDetected = false

      if (filledBubbles.length === 1) {
        selected = filledBubbles[0].id
      } else if (filledBubbles.length > 1) {
        // Multiple bubbles filled - pick the darkest one but flag it
        const darkest = filledBubbles.reduce((a, b) =>
          a.fillPercentage > b.fillPercentage ? a : b
        )
        selected = darkest.id
        multipleDetected = true
      }

      bubbles.push({
        questionNumber: q + 1,
        row,
        column,
        bubbles: bubbleDetections,
        selected,
        multipleDetected
      })
    }

    return bubbles
  }

  // ============================================================
  // NEW: Position-Based Bubble Detection (Replaces HoughCircles)
  // ============================================================

  // Layout constants for normalized image (at 150 DPI)
  // All values are 72 DPI constants × (150/72) = × 2.083
  // IMPORTANT: FIRST_BUBBLE_X is empirically adjusted to account for registration
  // mark centroid offset (blob detection finds centroid, not corner of L-shapes)
  private static readonly NORMALIZED_LAYOUT = {
    WIDTH: 1275, // 8.5" × 150 DPI
    HEIGHT: 1650, // 11" × 150 DPI
    MARGIN: 104, // 50pt × 150/72
    BUBBLE_GRID_Y_START: 533, // 256pt × 150/72 = 533 at 150 DPI
    ROW_HEIGHT: 50, // 24pt × 150/72
    BUBBLE_SPACING: 46, // 22pt × 150/72
    BUBBLE_RADIUS: 15, // 7pt × 150/72
    FIRST_BUBBLE_X: 181, // ADJUSTED: Empirically measured (was 187 calculated)
    QUESTIONS_PER_COLUMN: 25,
    SAMPLE_SIZE: 20 // Size of square sample region
  }

  // Quiz layout constants for normalized image (at 150 DPI)
  // Quiz format: questions on top, horizontal bubble rows at bottom
  // 72 DPI values × (150/72) = × 2.083
  private static readonly QUIZ_NORMALIZED_LAYOUT = {
    WIDTH: 1275, // 8.5" × 150 DPI
    HEIGHT: 1650, // 11" × 150 DPI
    MARGIN: 75, // 36pt × 150/72
    // Bubble grid at bottom: bubbleGridY = 792 - 36 - 85 = 671pt at 72 DPI
    // At 150 DPI: 671 × 150/72 = 1398
    BUBBLE_GRID_Y: 1398,
    // Grid starts at bubbleGridY + 16pt = 687pt → 1431 at 150 DPI
    GRID_START_Y: 1431,
    // Bubble center Y for row 0 = gridStartY + 8pt = 695pt → 1448 at 150 DPI
    FIRST_ROW_BUBBLE_Y: 1448,
    ROW_HEIGHT: 58, // 28pt × 150/72
    QUESTIONS_PER_ROW: 4,
    // Content width = 612 - 2*36 = 540pt, question width = 540/4 = 135pt → 281 at 150 DPI
    QUESTION_WIDTH: 281,
    // Bubble start offset from cellX: 24pt → 50 at 150 DPI
    BUBBLE_START_OFFSET: 50,
    // Bubble spacing: 26pt → 54 at 150 DPI
    BUBBLE_SPACING: 54,
    BUBBLE_RADIUS: 15, // 7pt × 150/72
    SAMPLE_SIZE: 20 // Size of square sample region
  }

  /**
   * Parse a scantron page using position-based bubble detection
   *
   * IMPORTANT: Only flatbed scans are reliably supported. Phone scans have
   * variable aspect ratios, perspective distortion, and cropping that make
   * accurate bubble detection unreliable.
   *
   * Expected dimensions at 150 DPI: 1275 x 1650 (US Letter)
   */
  async parseScantronPageV2(
    imageBuffer: Buffer,
    pageNumber: number,
    expectedQuestionCount: number
  ): Promise<ParsedScantron> {
    const startTime = performance.now()
    const flags: string[] = []

    // Get image dimensions
    const metadata = await sharp(imageBuffer).metadata()
    const imageWidth = metadata.width || 0
    const imageHeight = metadata.height || 0

    console.log(`[GradeService] Page ${pageNumber}: Starting V2 processing (${imageWidth}x${imageHeight})...`)

    // Check if image matches expected flatbed scan dimensions (150 DPI US Letter)
    // Allow small tolerance for rounding differences
    const widthDiff = Math.abs(imageWidth - GradeService.NORMALIZED_LAYOUT.WIDTH)
    const heightDiff = Math.abs(imageHeight - GradeService.NORMALIZED_LAYOUT.HEIGHT)
    const isValidFlatbedScan = widthDiff < 20 && heightDiff < 20

    let processBuffer = imageBuffer

    if (!isValidFlatbedScan) {
      // Non-standard dimensions detected - likely a phone scan
      // Phone scans are not reliably supported due to aspect ratio and distortion issues
      const aspectRatio = imageWidth / imageHeight
      const letterRatio = 1275 / 1650 // 0.773
      const a4Ratio = 1240 / 1754 // 0.707

      const isLikelyA4 = Math.abs(aspectRatio - a4Ratio) < Math.abs(aspectRatio - letterRatio)

      console.warn(`[GradeService] Page ${pageNumber}: NON-STANDARD DIMENSIONS DETECTED`)
      console.warn(`[GradeService]   Actual: ${imageWidth}x${imageHeight} (ratio: ${aspectRatio.toFixed(3)})`)
      console.warn(`[GradeService]   Expected: 1275x1650 (ratio: 0.773)`)
      console.warn(`[GradeService]   Detected format: ${isLikelyA4 ? 'A4 (phone scan?)' : 'Unknown'}`)
      console.warn(`[GradeService]   Phone scans are NOT reliably supported. Use a flatbed scanner for accurate results.`)

      flags.push('non_standard_dimensions')
      flags.push('low_confidence')

      // Still attempt processing but mark as unreliable
      // Check orientation and continue with degraded accuracy
      const isUpsideDown = await this.detectPageOrientation(imageBuffer, imageWidth, imageHeight)
      if (isUpsideDown) {
        processBuffer = await sharp(imageBuffer).rotate(180).toBuffer()
        flags.push('rotated_180')
      }
    } else {
      // Valid flatbed scan - just check orientation
      console.log(`[GradeService] Page ${pageNumber}: Valid flatbed scan dimensions, checking orientation...`)

      const isUpsideDown = await this.detectPageOrientation(imageBuffer, imageWidth, imageHeight)
      console.log(`[GradeService] Page ${pageNumber}: Orientation: ${isUpsideDown ? 'UPSIDE DOWN - rotating' : 'correct'}`)

      if (isUpsideDown) {
        processBuffer = await sharp(imageBuffer).rotate(180).toBuffer()
        flags.push('rotated_180')
      }
    }

    // Step 3: Read QR code
    let qrData: ResolvedScantronData | null = null
    let qrError: string | undefined

    // Calculate DPI scale for QR extraction
    const dpiScale = imageWidth / LAYOUT.LETTER_WIDTH

    console.log(`[GradeService] Page ${pageNumber}: Reading QR code...`)
    try {
      qrData = await this.extractQRCode(processBuffer, dpiScale)
      if (!qrData) {
        qrError = 'QR code not found or unreadable'
        flags.push('qr_error')
        console.log(`[GradeService] Page ${pageNumber}: QR code not found`)
      } else {
        console.log(`[GradeService] Page ${pageNumber}: QR code found - student: ${qrData.studentId}`)
      }
    } catch (error) {
      qrError = error instanceof Error ? error.message : 'QR code read error'
      flags.push('qr_error')
      console.log(`[GradeService] Page ${pageNumber}: QR code error:`, error)
    }

    // Step 4: If QR failed, try OCR to extract student name
    let ocrStudentName: string | undefined
    if (!qrData) {
      console.log(`[GradeService] Page ${pageNumber}: Attempting OCR to extract student name...`)
      const ocrResult = await this.extractStudentNameOCR(processBuffer)
      if (ocrResult) {
        ocrStudentName = ocrResult
        console.log(`[GradeService] Page ${pageNumber}: OCR extracted name: "${ocrStudentName}"`)
      } else {
        console.log(`[GradeService] Page ${pageNumber}: OCR could not extract student name`)
      }
    }

    // Step 5: Detect bubbles using position-based sampling
    // Use quiz-specific detection if QR indicates quiz format
    const isQuizFormat = qrData?.format === 'quiz'
    console.log(`[GradeService] Page ${pageNumber}: Detecting bubbles (${isQuizFormat ? 'quiz' : 'standard'} format)...`)

    const detectedBubbles = isQuizFormat
      ? await this.detectQuizBubblesPositionBased(
          processBuffer,
          expectedQuestionCount,
          true // Always treat as normalized after rotation correction
        )
      : await this.detectBubblesPositionBased(
          processBuffer,
          expectedQuestionCount,
          true // Always treat as normalized after rotation correction
        )

    // Check for issues
    let overallConfidence = 0.8 // Start with reasonable confidence
    for (const bubble of detectedBubbles) {
      if (bubble.multipleDetected) {
        flags.push(`multiple_bubbles_q${bubble.questionNumber}`)
        overallConfidence = Math.min(overallConfidence, 0.5)
      }
      if (bubble.selected === null) {
        flags.push(`no_answer_q${bubble.questionNumber}`)
      }
      const maxConfidence = Math.max(...bubble.bubbles.map((b) => b.confidence))
      overallConfidence = Math.min(overallConfidence, maxConfidence)
    }

    // Step 6: Generate cropped images for flagged questions (multiple bubbles or no answer)
    // This provides visual context for teachers reviewing grading errors
    const flaggedQuestions = detectedBubbles.filter(
      (b) => b.multipleDetected || b.selected === null
    )

    const flaggedBubbleImages: FlaggedBubbleImage[] = []
    for (const flagged of flaggedQuestions) {
      try {
        const imageBase64 = await this.cropBubbleRow(
          processBuffer,
          flagged.questionNumber,
          isQuizFormat,
          imageWidth,
          imageHeight
        )
        flaggedBubbleImages.push({
          questionNumber: flagged.questionNumber,
          imageBase64
        })
      } catch (error) {
        console.warn(
          `[GradeService] Page ${pageNumber}: Failed to crop Q${flagged.questionNumber}:`,
          error
        )
      }
    }

    // Step 7: For pages with QR errors, generate a compressed full page image
    // This helps teachers identify which student the page belongs to
    let pageImageBase64: string | undefined
    if (!qrData) {
      try {
        const compressedPage = await sharp(processBuffer)
          .resize(400, 518, { fit: 'inside' }) // ~30% of original 1275x1650
          .jpeg({ quality: 70 })
          .toBuffer()
        pageImageBase64 = compressedPage.toString('base64')
      } catch (error) {
        console.warn(`[GradeService] Page ${pageNumber}: Failed to compress page image:`, error)
      }
    }

    const processingTimeMs = performance.now() - startTime
    console.log(`[GradeService] Page ${pageNumber}: Completed in ${processingTimeMs.toFixed(0)}ms`)

    return {
      pageNumber,
      success: !qrError && flags.filter(f => !f.startsWith('no_answer') && f !== 'rotated_180').length === 0,
      qrData,
      qrError,
      ocrStudentName,
      answers: detectedBubbles,
      confidence: overallConfidence,
      processingTimeMs,
      flags,
      imageWidth,
      imageHeight,
      flaggedBubbleImages: flaggedBubbleImages.length > 0 ? flaggedBubbleImages : undefined,
      pageImageBase64
    }
  }

  /**
   * Detect if page is upside down by checking corner marks
   *
   * Registration mark positions at 72 DPI:
   * - Top-left: L-shape (not filled) at (25, 25)
   * - Top-right: Filled SQUARE at (567, 25), size 20x20
   * - Bottom-left: Filled CIRCLE center at (35, 757), radius 10
   * - Bottom-right: L-shape (not filled)
   *
   * When page is UPSIDE DOWN:
   * - The filled CIRCLE appears in TOP-RIGHT
   * - The filled SQUARE appears in BOTTOM-LEFT
   *
   * Key insight for detection:
   * - Filled square samples at ~70-80% darkness (fills entire region)
   * - Filled circle samples at ~60-65% darkness (circle fills π/4 ≈ 78.5% of bounding box)
   *
   * When CORRECT: TR (square ~75%) > BL (circle ~65%)
   * When UPSIDE DOWN: TR (circle ~65%) < BL (square ~75%)
   */
  private async detectPageOrientation(
    imageBuffer: Buffer,
    width: number,
    height: number
  ): Promise<boolean> {
    const { data } = await sharp(imageBuffer)
      .grayscale()
      .raw()
      .toBuffer({ resolveWithObject: true })

    const dpiScale = width / LAYOUT.LETTER_WIDTH

    // Registration mark constants from pdf.service.ts
    const REG_MARK_SIZE = 20
    const REG_MARK_OFFSET = 25

    // Calculate positions at current DPI
    const markSize = Math.floor(REG_MARK_SIZE * dpiScale)
    const offset = Math.floor(REG_MARK_OFFSET * dpiScale)

    // Top-right position (square when correct, circle when upside down)
    const topRightX = width - offset - markSize
    const topRightY = offset

    // Bottom-left position (circle when correct, square when upside down)
    const bottomLeftX = offset
    const bottomLeftY = height - offset - markSize

    // Sample the filled shapes
    const topRightDarkness = this.sampleCornerDarkness(data, width, height, topRightX, topRightY, markSize)
    const bottomLeftDarkness = this.sampleCornerDarkness(data, width, height, bottomLeftX, bottomLeftY, markSize)

    // Also sample all corners for debugging
    const topLeftDarkness = this.sampleCornerDarkness(data, width, height, offset, offset, markSize)
    const bottomRightDarkness = this.sampleCornerDarkness(data, width, height, width - offset - markSize, height - offset - markSize, markSize)

    console.log(`[GradeService] Corner darkness: TL=${topLeftDarkness.toFixed(0)}%, TR=${topRightDarkness.toFixed(0)}%, BL=${bottomLeftDarkness.toFixed(0)}%, BR=${bottomRightDarkness.toFixed(0)}%`)

    // Both TR and BL should have high darkness (filled shapes in both orientations)
    // The key difference is WHICH shape is where:
    // - Square samples ~70-80% (fills entire region)
    // - Circle samples ~60-65% (only fills π/4 of bounding box)
    //
    // When CORRECT: TR has square (higher), BL has circle (lower) → TR > BL
    // When UPSIDE DOWN: TR has circle (lower), BL has square (higher) → BL > TR

    const bothHaveFilledShapes = topRightDarkness > 40 && bottomLeftDarkness > 40

    if (bothHaveFilledShapes) {
      // Compare which corner has the denser shape (square vs circle)
      // If BL is significantly darker than TR, the square is in BL → upside down
      const isUpsideDown = bottomLeftDarkness > topRightDarkness + 5 // 5% threshold

      console.log(`[GradeService] Shape comparison: TR=${topRightDarkness.toFixed(0)}% vs BL=${bottomLeftDarkness.toFixed(0)}% → ${isUpsideDown ? 'UPSIDE DOWN' : 'correct'}`)
      return isUpsideDown
    }

    // Fallback: if we don't detect both filled shapes, check for unexpected darkness
    // If neither TR nor BL has marks, but TL and BR do, page is upside down
    if (topLeftDarkness > 40 && bottomRightDarkness > 40 && topRightDarkness < 30 && bottomLeftDarkness < 30) {
      console.log(`[GradeService] Fallback detection: marks in TL/BR instead of TR/BL → UPSIDE DOWN`)
      return true
    }

    console.log(`[GradeService] Could not reliably detect orientation, assuming correct`)
    return false
  }

  // Name region layout constants at 72 DPI (for OCR extraction)
  // The name is printed after "Name: " label at approximately:
  // - X starts at MARGIN (50) + "Name: " label width (~35pt) = ~85pt
  // - Y is at header line 3: MARGIN + title(25) + divider(15) = 90pt
  // - Width extends to about pageWidth/2 (306pt) minus some margin = ~220pt
  // - Height is about 1.5x the font size (11pt) = ~16pt
  private static readonly NAME_REGION_72DPI = {
    X: 85,        // After "Name: " label
    Y: 88,        // Header row with student info
    WIDTH: 220,   // Wide enough for long names like "Bartholomew-Richardson, Alexandria"
    HEIGHT: 18    // Tall enough for the text
  }

  /**
   * Sample a corner region and return the percentage of dark pixels (0-100)
   */
  private sampleCornerDarkness(
    data: Buffer,
    width: number,
    height: number,
    startX: number,
    startY: number,
    size: number
  ): number {
    let darkPixels = 0
    let totalPixels = 0

    for (let y = startY; y < startY + size && y < height; y++) {
      for (let x = startX; x < startX + size && x < width; x++) {
        const idx = y * width + x
        totalPixels++
        if (data[idx] < 128) { // Dark pixel threshold
          darkPixels++
        }
      }
    }

    return totalPixels > 0 ? (darkPixels / totalPixels) * 100 : 0
  }

  /**
   * Extract student name from scantron image using OCR
   * Returns the detected name or null if OCR fails
   */
  private async extractStudentNameOCR(imageBuffer: Buffer): Promise<string | null> {
    try {
      const metadata = await sharp(imageBuffer).metadata()
      const imageWidth = metadata.width || 1275

      // Calculate DPI scale (image is rendered at 150 DPI, layout is at 72 DPI)
      const dpiScale = imageWidth / LAYOUT.LETTER_WIDTH

      // Calculate name region in current image coordinates
      const region = GradeService.NAME_REGION_72DPI
      const cropX = Math.floor(region.X * dpiScale)
      const cropY = Math.floor(region.Y * dpiScale)
      const cropWidth = Math.floor(region.WIDTH * dpiScale)
      const cropHeight = Math.floor(region.HEIGHT * dpiScale)

      console.log(`[GradeService] OCR: Extracting name region (${cropX}, ${cropY}, ${cropWidth}x${cropHeight})`)

      // Crop the name region and enhance for OCR
      const nameRegion = await sharp(imageBuffer)
        .extract({ left: cropX, top: cropY, width: cropWidth, height: cropHeight })
        .resize({ width: cropWidth * 2 }) // Upscale 2x for better OCR
        .normalize() // Enhance contrast
        .sharpen() // Sharpen text edges
        .png()
        .toBuffer()

      // Run OCR on the cropped region
      const result = await Tesseract.recognize(nameRegion, 'eng', {
        logger: () => {} // Suppress progress logs
      })

      const text = result.data.text.trim()
      console.log(`[GradeService] OCR result: "${text}" (confidence: ${result.data.confidence.toFixed(0)}%)`)

      // Only return if we have reasonable confidence
      if (result.data.confidence > 50 && text.length > 2) {
        return text
      }

      return null
    } catch (error) {
      console.log('[GradeService] OCR failed:', error)
      return null
    }
  }

  /**
   * Find students whose names match the OCR text using fuzzy matching
   * Returns array of student IDs sorted by match quality
   */
  private findMatchingStudents(
    ocrText: string,
    availableStudentIds: string[],
    roster: { students: Array<{ id: string; firstName: string; lastName: string }> }
  ): string[] {
    if (!ocrText || availableStudentIds.length === 0) return []

    const normalizedOcr = ocrText.toLowerCase().replace(/[^a-z]/g, '')

    const matches: Array<{ id: string; score: number }> = []

    for (const studentId of availableStudentIds) {
      const student = roster.students.find(s => s.id === studentId)
      if (!student) continue

      // Create normalized versions of names to compare
      const fullName = `${student.lastName}${student.firstName}`.toLowerCase().replace(/[^a-z]/g, '')
      const reverseName = `${student.firstName}${student.lastName}`.toLowerCase().replace(/[^a-z]/g, '')

      // Calculate similarity score (simple substring matching)
      let score = 0

      // Check if OCR text contains significant parts of the name
      if (normalizedOcr.includes(student.lastName.toLowerCase().replace(/[^a-z]/g, ''))) {
        score += 50
      }
      if (normalizedOcr.includes(student.firstName.toLowerCase().replace(/[^a-z]/g, ''))) {
        score += 30
      }

      // Check reverse - if name contains OCR text
      if (fullName.includes(normalizedOcr) || reverseName.includes(normalizedOcr)) {
        score += 20
      }

      // Levenshtein-like bonus for close matches
      const minLen = Math.min(normalizedOcr.length, fullName.length)
      let matchingChars = 0
      for (let i = 0; i < minLen; i++) {
        if (normalizedOcr[i] === fullName[i]) matchingChars++
      }
      score += (matchingChars / minLen) * 20

      if (score > 20) {
        matches.push({ id: studentId, score })
      }
    }

    // Sort by score descending and return top 3
    matches.sort((a, b) => b.score - a.score)
    return matches.slice(0, 3).map(m => m.id)
  }

  /**
   * Detect bubbles using position-based region sampling (no HoughCircles)
   * This method samples rectangular regions at known bubble positions and measures intensity
   */
  private async detectBubblesPositionBased(
    imageBuffer: Buffer,
    questionCount: number,
    isNormalized: boolean
  ): Promise<DetectedBubble[]> {
    const layout = GradeService.NORMALIZED_LAYOUT

    // Load image as grayscale
    const { data, info } = await sharp(imageBuffer)
      .grayscale()
      .raw()
      .toBuffer({ resolveWithObject: true })

    // Calculate scale factor if image isn't normalized
    const scaleX = info.width / layout.WIDTH
    const scaleY = info.height / layout.HEIGHT
    const scale = isNormalized ? 1 : Math.min(scaleX, scaleY)

    // Scaled layout values
    const gridStartY = Math.floor(layout.BUBBLE_GRID_Y_START * scale)
    const rowHeight = Math.floor(layout.ROW_HEIGHT * scale)
    const bubbleSpacing = Math.floor(layout.BUBBLE_SPACING * scale)
    const sampleSize = Math.floor(layout.SAMPLE_SIZE * scale)
    const halfSample = Math.floor(sampleSize / 2)

    const columnCount = Math.ceil(questionCount / layout.QUESTIONS_PER_COLUMN)
    const columnWidth = Math.floor((layout.WIDTH - 2 * layout.MARGIN) / columnCount * scale)
    // Use empirically adjusted FIRST_BUBBLE_X instead of calculated offset
    const firstBubbleOffset = Math.floor((layout.FIRST_BUBBLE_X - layout.MARGIN) * scale)

    // Collect all bubble intensities for adaptive thresholding
    const allIntensities: { questionNumber: number; choice: number; intensity: number }[] = []

    // First pass: sample all bubble positions
    for (let q = 0; q < questionCount; q++) {
      const column = Math.floor(q / layout.QUESTIONS_PER_COLUMN)
      const row = q % layout.QUESTIONS_PER_COLUMN

      const columnX = Math.floor(layout.MARGIN * scale) + column * columnWidth
      const rowY = gridStartY + row * rowHeight + Math.floor(rowHeight / 2)

      for (let c = 0; c < LAYOUT.CHOICE_LABELS.length; c++) {
        // FIRST_BUBBLE_X is already the center of bubble A, so no radius offset needed
        const bubbleX = columnX + firstBubbleOffset + c * bubbleSpacing
        const bubbleY = rowY

        // Sample rectangular region centered on bubble
        const intensity = this.sampleRegionIntensity(
          data,
          info.width,
          info.height,
          bubbleX,
          bubbleY,
          halfSample
        )

        allIntensities.push({ questionNumber: q + 1, choice: c, intensity })
      }
    }

    // Calculate adaptive threshold
    const threshold = this.calculateAdaptiveThreshold(allIntensities, questionCount)

    // Second pass: classify bubbles based on threshold
    const bubbles: DetectedBubble[] = []

    for (let q = 0; q < questionCount; q++) {
      const column = Math.floor(q / layout.QUESTIONS_PER_COLUMN)
      const row = q % layout.QUESTIONS_PER_COLUMN

      const columnX = Math.floor(layout.MARGIN * scale) + column * columnWidth
      const rowY = gridStartY + row * rowHeight + Math.floor(rowHeight / 2)

      const bubbleDetections: BubbleDetection[] = []

      for (let c = 0; c < LAYOUT.CHOICE_LABELS.length; c++) {
        const bubbleX = columnX + firstBubbleOffset + c * bubbleSpacing
        const bubbleY = rowY

        // Find the intensity we already calculated
        const intensityData = allIntensities.find(
          (d) => d.questionNumber === q + 1 && d.choice === c
        )
        const intensity = intensityData?.intensity ?? 255

        // Classify: lower intensity = darker = filled
        const filled = intensity < threshold.fillThreshold
        const confidence = this.calculateBubbleConfidence(intensity, threshold)

        bubbleDetections.push({
          id: LAYOUT.CHOICE_LABELS[c],
          filled,
          confidence,
          x: bubbleX,
          y: bubbleY,
          radius: Math.floor(layout.BUBBLE_RADIUS * scale),
          fillPercentage: 1 - intensity / 255 // Convert to fill percentage
        })
      }

      // Determine selected answer
      const filledBubbles = bubbleDetections.filter((b) => b.filled)
      let selected: string | null = null
      let multipleDetected = false

      if (filledBubbles.length === 1) {
        selected = filledBubbles[0].id
      } else if (filledBubbles.length > 1) {
        // Multiple bubbles filled - pick the darkest one but flag it
        const darkest = filledBubbles.reduce((a, b) =>
          a.fillPercentage > b.fillPercentage ? a : b
        )
        selected = darkest.id
        multipleDetected = true
      }

      bubbles.push({
        questionNumber: q + 1,
        row,
        column,
        bubbles: bubbleDetections,
        selected,
        multipleDetected
      })
    }

    return bubbles
  }

  /**
   * Detect bubbles for QUIZ format using position-based region sampling
   * Quiz layout: horizontal rows at bottom of page (4 questions per row)
   */
  private async detectQuizBubblesPositionBased(
    imageBuffer: Buffer,
    questionCount: number,
    isNormalized: boolean
  ): Promise<DetectedBubble[]> {
    const layout = GradeService.QUIZ_NORMALIZED_LAYOUT

    // Load image as grayscale
    const { data, info } = await sharp(imageBuffer)
      .grayscale()
      .raw()
      .toBuffer({ resolveWithObject: true })

    // Calculate scale factor if image isn't normalized
    const scaleX = info.width / layout.WIDTH
    const scaleY = info.height / layout.HEIGHT
    const scale = isNormalized ? 1 : Math.min(scaleX, scaleY)

    // Scaled layout values for quiz format
    const firstRowBubbleY = Math.floor(layout.FIRST_ROW_BUBBLE_Y * scale)
    const rowHeight = Math.floor(layout.ROW_HEIGHT * scale)
    const bubbleSpacing = Math.floor(layout.BUBBLE_SPACING * scale)
    const questionWidth = Math.floor(layout.QUESTION_WIDTH * scale)
    const bubbleStartOffset = Math.floor(layout.BUBBLE_START_OFFSET * scale)
    const margin = Math.floor(layout.MARGIN * scale)
    const sampleSize = Math.floor(layout.SAMPLE_SIZE * scale)
    const halfSample = Math.floor(sampleSize / 2)

    // Collect all bubble intensities for adaptive thresholding
    const allIntensities: { questionNumber: number; choice: number; intensity: number }[] = []

    // First pass: sample all bubble positions (quiz layout: rows of 4 questions)
    for (let q = 0; q < questionCount; q++) {
      const row = Math.floor(q / layout.QUESTIONS_PER_ROW)
      const col = q % layout.QUESTIONS_PER_ROW

      // Cell position for this question
      const cellX = margin + col * questionWidth
      const bubbleY = firstRowBubbleY + row * rowHeight

      for (let c = 0; c < 4; c++) { // A, B, C, D
        // Bubble X position: cellX + bubbleStartOffset + c * bubbleSpacing
        const bubbleX = cellX + bubbleStartOffset + c * bubbleSpacing

        // Sample rectangular region centered on bubble
        const intensity = this.sampleRegionIntensity(
          data,
          info.width,
          info.height,
          bubbleX,
          bubbleY,
          halfSample
        )

        allIntensities.push({ questionNumber: q + 1, choice: c, intensity })
      }
    }

    // Calculate adaptive threshold
    const threshold = this.calculateAdaptiveThreshold(allIntensities, questionCount)

    // Second pass: classify bubbles based on threshold
    const bubbles: DetectedBubble[] = []
    const choiceLabels = ['A', 'B', 'C', 'D'] as const

    for (let q = 0; q < questionCount; q++) {
      const row = Math.floor(q / layout.QUESTIONS_PER_ROW)
      const col = q % layout.QUESTIONS_PER_ROW

      const cellX = margin + col * questionWidth
      const bubbleY = firstRowBubbleY + row * rowHeight

      const bubbleDetections: BubbleDetection[] = []

      for (let c = 0; c < 4; c++) {
        const bubbleX = cellX + bubbleStartOffset + c * bubbleSpacing

        // Find the intensity we already calculated
        const intensityData = allIntensities.find(
          (d) => d.questionNumber === q + 1 && d.choice === c
        )
        const intensity = intensityData?.intensity ?? 255

        // Classify: lower intensity = darker = filled
        const filled = intensity < threshold.fillThreshold
        const confidence = this.calculateBubbleConfidence(intensity, threshold)

        bubbleDetections.push({
          id: choiceLabels[c],
          filled,
          confidence,
          x: bubbleX,
          y: bubbleY,
          radius: Math.floor(layout.BUBBLE_RADIUS * scale),
          fillPercentage: 1 - intensity / 255
        })
      }

      // Determine selected answer
      const filledBubbles = bubbleDetections.filter((b) => b.filled)
      let selected: string | null = null
      let multipleDetected = false

      if (filledBubbles.length === 1) {
        selected = filledBubbles[0].id
      } else if (filledBubbles.length > 1) {
        // Multiple bubbles filled - pick the darkest one but flag it
        const darkest = filledBubbles.reduce((a, b) =>
          a.fillPercentage > b.fillPercentage ? a : b
        )
        selected = darkest.id
        multipleDetected = true
      }

      bubbles.push({
        questionNumber: q + 1,
        row,
        column: col,
        bubbles: bubbleDetections,
        selected,
        multipleDetected
      })
    }

    return bubbles
  }

  /**
   * Sample the mean intensity of a rectangular region
   */
  private sampleRegionIntensity(
    data: Buffer,
    width: number,
    height: number,
    centerX: number,
    centerY: number,
    halfSize: number
  ): number {
    let sum = 0
    let count = 0

    const x1 = Math.max(0, centerX - halfSize)
    const x2 = Math.min(width - 1, centerX + halfSize)
    const y1 = Math.max(0, centerY - halfSize)
    const y2 = Math.min(height - 1, centerY + halfSize)

    for (let y = y1; y <= y2; y++) {
      for (let x = x1; x <= x2; x++) {
        const idx = y * width + x
        sum += data[idx]
        count++
      }
    }

    return count > 0 ? sum / count : 255
  }

  /**
   * Crop a single question's bubble row from the scantron image
   * Returns base64 PNG of the bubble region for visual verification
   * Used to provide visual context for flagged questions (multiple bubbles, no answer)
   *
   * Handles two formats:
   * - Normal scantron: Bubbles in vertical columns (25 questions per column)
   * - Quiz format: Bubbles in horizontal rows at bottom of page (4 questions per row)
   */
  private async cropBubbleRow(
    imageBuffer: Buffer,
    questionNumber: number,
    isQuizFormat: boolean,
    imageWidth: number,
    imageHeight: number
  ): Promise<string> {
    let cropX: number
    let cropY: number
    let cropWidth: number
    let cropHeight: number

    if (isQuizFormat) {
      // Quiz format: bubbles at bottom in horizontal rows of 4 questions
      const layout = GradeService.QUIZ_NORMALIZED_LAYOUT
      const scale = imageWidth / layout.WIDTH

      const row = Math.floor((questionNumber - 1) / layout.QUESTIONS_PER_ROW)
      const col = (questionNumber - 1) % layout.QUESTIONS_PER_ROW

      // Cell position for this question
      const cellX = Math.floor(layout.MARGIN * scale) + col * Math.floor(layout.QUESTION_WIDTH * scale)
      const bubbleY = Math.floor(layout.FIRST_ROW_BUBBLE_Y * scale) + row * Math.floor(layout.ROW_HEIGHT * scale)

      // Crop the bubble area (4 bubbles wide + padding)
      cropWidth = Math.floor(200 * scale)
      cropHeight = Math.floor(40 * scale)
      cropX = Math.max(0, cellX + Math.floor(layout.BUBBLE_START_OFFSET * scale) - Math.floor(10 * scale))
      cropY = Math.max(0, bubbleY - Math.floor(20 * scale))
    } else {
      // Normal scantron: bubbles in vertical columns
      const layout = GradeService.NORMALIZED_LAYOUT
      const scale = imageWidth / layout.WIDTH

      const column = Math.floor((questionNumber - 1) / layout.QUESTIONS_PER_COLUMN)
      const row = (questionNumber - 1) % layout.QUESTIONS_PER_COLUMN

      // Calculate bubble position using same logic as detectBubblesPositionBased
      const columnCount = 2 // Typically 2 columns for 50 questions
      const columnWidth = Math.floor((layout.WIDTH - 2 * layout.MARGIN) / columnCount * scale)
      const columnX = Math.floor(layout.MARGIN * scale) + column * columnWidth
      const firstBubbleOffset = Math.floor((layout.FIRST_BUBBLE_X - layout.MARGIN) * scale)
      const rowY = Math.floor(layout.BUBBLE_GRID_Y_START * scale) + row * Math.floor(layout.ROW_HEIGHT * scale)

      // Crop the bubble area (4 bubbles: A B C D + padding)
      cropWidth = Math.floor(200 * scale)
      cropHeight = Math.floor(40 * scale)
      cropX = Math.max(0, columnX + firstBubbleOffset - Math.floor(15 * scale))
      cropY = Math.max(0, rowY + Math.floor(layout.ROW_HEIGHT * scale / 2) - Math.floor(20 * scale))
    }

    // Use sharp to crop and convert to base64
    const croppedBuffer = await sharp(imageBuffer)
      .extract({
        left: Math.floor(cropX),
        top: Math.floor(cropY),
        width: Math.min(Math.floor(cropWidth), imageWidth - Math.floor(cropX)),
        height: Math.min(Math.floor(cropHeight), imageHeight - Math.floor(cropY))
      })
      .png()
      .toBuffer()

    return croppedBuffer.toString('base64')
  }

  /**
   * Calculate adaptive threshold based on distribution of intensities
   */
  private calculateAdaptiveThreshold(
    intensities: { questionNumber: number; choice: number; intensity: number }[],
    questionCount: number
  ): { fillThreshold: number; emptyThreshold: number } {
    // Sort by intensity (darkest first)
    const sorted = [...intensities].sort((a, b) => a.intensity - b.intensity)

    // For a typical test, expect ~questionCount filled bubbles (one per question)
    // and ~3*questionCount empty bubbles
    const expectedFilled = questionCount
    // const expectedEmpty = questionCount * 3  // Not used currently but kept for reference

    // The threshold should be between the darkest expected filled and lightest expected empty
    // Use the gap between expectedFilled and expectedFilled+1 positions
    const filledMax = sorted[Math.min(expectedFilled - 1, sorted.length - 1)]?.intensity ?? 100
    const emptyMin = sorted[Math.min(expectedFilled, sorted.length - 1)]?.intensity ?? 180

    // Set threshold in the middle of the gap
    const fillThreshold = (filledMax + emptyMin) / 2

    // If there's no clear gap, use more lenient default thresholds
    // This handles cases where bubbles are lightly filled
    if (emptyMin - filledMax < 20) {
      return { fillThreshold: 180, emptyThreshold: 220 }
    }

    return {
      fillThreshold,
      emptyThreshold: Math.min(emptyMin + 20, 220)
    }
  }

  /**
   * Calculate confidence score for a bubble based on its intensity and thresholds
   */
  private calculateBubbleConfidence(
    intensity: number,
    threshold: { fillThreshold: number; emptyThreshold: number }
  ): number {
    // Very dark (< 60): filled, high confidence
    if (intensity < 60) return 0.95

    // Clearly filled (below threshold with margin)
    if (intensity < threshold.fillThreshold - 20) return 0.9

    // Near threshold (unclear)
    if (intensity >= threshold.fillThreshold - 20 && intensity <= threshold.fillThreshold + 20) {
      // Low confidence in the uncertain zone
      return 0.5
    }

    // Clearly empty (above threshold with margin)
    if (intensity > threshold.emptyThreshold) return 0.95

    // Light but not clearly empty
    return 0.8
  }

  /**
   * Calculate grades from parsed scantrons, also returning unidentified pages
   * IMPORTANT: This method never skips pages - unidentified pages are returned separately
   */
  private calculateGradesWithUnidentified(
    parsedPages: ParsedScantron[],
    assignment: Assignment,
    assessment: Assessment,
    roster: Roster
  ): { grades: AssignmentGrades; unidentifiedPages: UnidentifiedPage[]; answerKey: AnswerKeyEntry[] } {
    const records: GradeRecord[] = []
    const unidentifiedPages: UnidentifiedPage[] = []
    const studentMap = new Map(roster.students.map((s) => [s.id, s]))
    const gradedStudentIds = new Set<string>()

    // Helper to get questions for a specific DOK level
    // If a variant exists for the DOK level, use variant questions; otherwise use base
    const getQuestionsForDOK = (dokLevel?: number): Question[] => {
      if (dokLevel && assessment.variants) {
        const variant = assessment.variants.find(v => v.dokLevel === dokLevel)
        if (variant) {
          console.log(`[GradeService] Using DOK ${dokLevel} variant questions (${variant.questions.length} questions)`)
          return variant.questions
        }
      }
      return assessment.questions
    }

    // Build base answer key for export (default/most common case)
    // Individual student grading will use DOK-specific answer keys
    const baseAnswerKeyArray: AnswerKeyEntry[] = []
    assessment.questions.forEach((q, index) => {
      if (q.type === 'multiple_choice') {
        const questionNumber = index + 1
        baseAnswerKeyArray.push({
          questionNumber,
          questionId: q.id,
          correctAnswer: q.correctAnswer.toUpperCase(),
          points: q.points
        })
      }
    })

    // Process each parsed page
    for (const page of parsedPages) {
      const flags: GradeFlag[] = []
      let needsReview = false

      // Classify the page
      const pageType = this.classifyPage(page)

      // Handle pages without QR code
      if (!page.qrData) {
        // Still create an unidentified page record - DON'T skip!
        // IMPORTANT: Any page with a QR error should be reported
        if (pageType === 'unidentified_scantron') {
          // Get list of students who haven't been graded yet
          const ungradedStudentIds = roster.students
            .filter((s) => !gradedStudentIds.has(s.id))
            .map((s) => s.id)

          console.log(`[GradeService] Page ${page.pageNumber}: Unidentified scantron - QR error: ${page.qrError}`)

          // Use OCR name to suggest matching students
          let suggestedStudents: string[] | undefined
          if (page.ocrStudentName) {
            suggestedStudents = this.findMatchingStudents(page.ocrStudentName, ungradedStudentIds, roster)
            if (suggestedStudents.length > 0) {
              const suggestedNames = suggestedStudents.map(id => {
                const s = roster.students.find(st => st.id === id)
                return s ? `${s.lastName}, ${s.firstName}` : id
              })
              console.log(`[GradeService] Page ${page.pageNumber}: OCR suggests: ${suggestedNames.join(', ')}`)
            }
          }

          unidentifiedPages.push({
            pageNumber: page.pageNumber,
            pageType,
            confidence: page.confidence,
            detectedAnswers: page.answers,
            registrationMarkCount: this.countRegistrationMarks(page),
            qrError: page.qrError,
            ocrStudentName: page.ocrStudentName,
            suggestedStudents,
            possibleStudents: ungradedStudentIds,
            imageDataBase64: page.pageImageBase64 // Compressed page image for review
          })
        } else {
          console.log(`[GradeService] Page ${page.pageNumber}: Classified as ${pageType} - skipping`)
        }
        continue // Skip to next page - but we've recorded this one!
      }

      // Mark this student as graded
      gradedStudentIds.add(page.qrData.studentId)

      // Check if student exists
      const student = studentMap.get(page.qrData.studentId)
      if (!student) {
        flags.push({
          type: 'student_not_found',
          message: `Student ID ${page.qrData.studentId} not found in roster`
        })
        needsReview = true
      }

      // Get questions based on student's DOK level (from QR code)
      const studentDOK = page.qrData.dokLevel
      const questionsForStudent = getQuestionsForDOK(studentDOK)

      // Build answer key map for this student's questions
      const studentAnswerKeyMap = new Map<number, string>()
      questionsForStudent.forEach((q, index) => {
        if (q.type === 'multiple_choice') {
          studentAnswerKeyMap.set(index + 1, q.correctAnswer.toUpperCase())
        }
      })

      // Calculate answers and score
      const answers: AnswerResult[] = []
      let rawScore = 0
      let totalPoints = 0

      for (const bubble of page.answers) {
        const question = questionsForStudent[bubble.questionNumber - 1]
        const correctAnswer = studentAnswerKeyMap.get(bubble.questionNumber)
        const isCorrect = bubble.selected?.toUpperCase() === correctAnswer

        if (isCorrect) {
          rawScore++
        }
        totalPoints += question?.points || 1

        // Check for flags
        if (bubble.multipleDetected) {
          flags.push({
            type: 'multiple_bubbles',
            questionNumber: bubble.questionNumber,
            message: `Multiple bubbles filled for question ${bubble.questionNumber}`
          })
          needsReview = true
        }

        if (bubble.selected === null) {
          flags.push({
            type: 'no_answer',
            questionNumber: bubble.questionNumber,
            message: `No answer detected for question ${bubble.questionNumber}`
          })
        }

        // Check confidence
        const maxConfidence = Math.max(...bubble.bubbles.map((b) => b.confidence))
        if (maxConfidence < DEFAULT_DETECTION_OPTIONS.confidenceThreshold && bubble.selected !== null) {
          flags.push({
            type: 'low_confidence',
            questionNumber: bubble.questionNumber,
            message: `Low confidence (${(maxConfidence * 100).toFixed(0)}%) for question ${bubble.questionNumber}`
          })
          needsReview = true
        }

        answers.push({
          questionNumber: bubble.questionNumber,
          questionId: question?.id || '',
          questionType: question?.type || 'multiple_choice',
          selected: bubble.selected,
          confidence: maxConfidence,
          correct: isCorrect,
          multipleSelected: bubble.multipleDetected,
          unclear: maxConfidence < DEFAULT_DETECTION_OPTIONS.confidenceThreshold
        })
      }

      const percentage = page.answers.length > 0 ? (rawScore / page.answers.length) * 100 : 0

      const record: GradeRecord = {
        id: `${assignment.id}-${page.qrData.studentId}`,
        studentId: page.qrData.studentId,
        assignmentId: assignment.id,
        versionId: 'A' as VersionId, // All students get version 'A' for now
        gradedAt: new Date().toISOString(),
        scannedAt: new Date().toISOString(),
        rawScore,
        totalQuestions: page.answers.length,
        percentage,
        points: rawScore,
        maxPoints: totalPoints,
        answers,
        flags,
        needsReview,
        scantronPageNumber: page.pageNumber,
        flaggedBubbleImages: page.flaggedBubbleImages // Cropped images for flagged questions
      }

      records.push(record)
    }

    // Calculate statistics
    const stats = this.calculateStats(records, assessment)

    const grades: AssignmentGrades = {
      assignmentId: assignment.id,
      sectionId: assignment.sectionId,
      assessmentId: assessment.id,
      gradedAt: new Date().toISOString(),
      records,
      stats
    }

    return { grades, unidentifiedPages, answerKey: baseAnswerKeyArray }
  }

  /**
   * Classify a parsed page into a page type
   */
  private classifyPage(page: ParsedScantron): PageType {
    const hasQR = !!page.qrData
    const hasAnswers = page.answers.some((a) => a.selected !== null)
    const hasQRError = page.flags.includes('qr_error')

    // If QR was successfully read, it's a valid scantron
    if (hasQR) {
      return 'valid_scantron'
    }

    // If we tried to read QR and failed, this is an unidentified scantron
    // IMPORTANT: Always report these so teacher knows a student is missing!
    if (hasQRError) {
      return 'unidentified_scantron'
    }

    // If no QR error but also no answers, might be blank
    if (!hasAnswers) {
      return 'blank_page'
    }

    // Has answers but no QR or QR error - unusual, flag as unknown
    return 'unknown_document'
  }

  /**
   * Check if a page appears to be blank
   */
  private isBlankPage(page: ParsedScantron): boolean {
    return this.classifyPage(page) === 'blank_page'
  }

  /**
   * Count registration marks detected on a page (for debugging/confidence)
   */
  private countRegistrationMarks(page: ParsedScantron): number {
    // If registration marks weren't found, return 0
    // Otherwise we assume 4 (we don't have detailed tracking yet)
    return page.flags.includes('registration_marks_not_found') ? 0 : 4
  }

  /**
   * Calculate grade statistics
   */
  private calculateStats(records: GradeRecord[], assessment: Assessment): GradeStats {
    if (records.length === 0) {
      return {
        totalStudents: 0,
        averageScore: 0,
        medianScore: 0,
        highScore: 0,
        lowScore: 0,
        standardDeviation: 0,
        byVariant: {},
        byQuestion: {},
        byStandard: {}
      }
    }

    const percentages = records.map((r) => r.percentage)
    const sorted = [...percentages].sort((a, b) => a - b)

    const average = percentages.reduce((a, b) => a + b, 0) / percentages.length
    const median =
      sorted.length % 2 === 0
        ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
        : sorted[Math.floor(sorted.length / 2)]

    const variance =
      percentages.reduce((sum, p) => sum + Math.pow(p - average, 2), 0) / percentages.length
    const standardDeviation = Math.sqrt(variance)

    // By variant
    const byVariant: Record<string, { count: number; average: number }> = {}
    const variantGroups = new Map<string, number[]>()
    for (const record of records) {
      const key = record.versionId
      if (!variantGroups.has(key)) {
        variantGroups.set(key, [])
      }
      variantGroups.get(key)!.push(record.percentage)
    }
    for (const [variant, scores] of variantGroups) {
      byVariant[variant] = {
        count: scores.length,
        average: scores.reduce((a, b) => a + b, 0) / scores.length
      }
    }

    // By question
    const byQuestion: Record<string, { correctCount: number; incorrectCount: number; skippedCount: number; percentCorrect: number }> = {}
    for (const record of records) {
      for (const answer of record.answers) {
        const key = answer.questionNumber.toString()
        if (!byQuestion[key]) {
          byQuestion[key] = { correctCount: 0, incorrectCount: 0, skippedCount: 0, percentCorrect: 0 }
        }
        if (answer.selected === null) {
          byQuestion[key].skippedCount++
        } else if (answer.correct) {
          byQuestion[key].correctCount++
        } else {
          byQuestion[key].incorrectCount++
        }
      }
    }
    // Calculate percentages
    for (const key of Object.keys(byQuestion)) {
      const q = byQuestion[key]
      const total = q.correctCount + q.incorrectCount + q.skippedCount
      q.percentCorrect = total > 0 ? (q.correctCount / total) * 100 : 0
    }

    // By standard
    const byStandard: Record<string, { questionCount: number; averageCorrect: number }> = {}
    const standardResults = new Map<string, { total: number; correct: number }>()
    for (const record of records) {
      for (const answer of record.answers) {
        const question = assessment.questions.find((q) => q.id === answer.questionId)
        if (question?.standardRef) {
          if (!standardResults.has(question.standardRef)) {
            standardResults.set(question.standardRef, { total: 0, correct: 0 })
          }
          const stats = standardResults.get(question.standardRef)!
          stats.total++
          if (answer.correct) {
            stats.correct++
          }
        }
      }
    }
    for (const [standard, stats] of standardResults) {
      byStandard[standard] = {
        questionCount: stats.total / records.length, // Average questions per student for this standard
        averageCorrect: stats.total > 0 ? (stats.correct / stats.total) * 100 : 0
      }
    }

    return {
      totalStudents: records.length,
      averageScore: average,
      medianScore: median,
      highScore: Math.max(...percentages),
      lowScore: Math.min(...percentages),
      standardDeviation,
      byVariant,
      byQuestion,
      byStandard
    }
  }

  /**
   * Apply teacher overrides to grades
   */
  applyOverrides(grades: AssignmentGrades, overrides: GradeOverride[]): AssignmentGrades {
    const updatedRecords = grades.records.map((record) => {
      const recordOverrides = overrides.filter((o) => o.recordId === record.id)
      if (recordOverrides.length === 0) {
        return record
      }

      const updatedAnswers = [...record.answers]
      for (const override of recordOverrides) {
        const answerIndex = updatedAnswers.findIndex(
          (a) => a.questionNumber === override.questionNumber
        )
        if (answerIndex >= 0) {
          updatedAnswers[answerIndex] = {
            ...updatedAnswers[answerIndex],
            selected: override.newAnswer,
            unclear: false // Override clears the unclear flag
          }
        }
      }

      // Recalculate score
      const correct = updatedAnswers.filter((a) => a.correct).length
      const percentage = updatedAnswers.length > 0 ? (correct / updatedAnswers.length) * 100 : 0

      return {
        ...record,
        answers: updatedAnswers,
        rawScore: correct,
        percentage,
        reviewNotes: `${recordOverrides.length} answer(s) manually corrected`
      }
    })

    return {
      ...grades,
      records: updatedRecords,
      stats: this.calculateStats(updatedRecords, { questions: [] } as unknown as Assessment)
    }
  }

  /**
   * Save grades to Google Drive
   */
  async saveGrades(input: SaveGradesInput): Promise<ServiceResult<AssignmentGrades>> {
    try {
      // Apply any overrides
      let grades = input.grades
      if (input.overrides && input.overrides.length > 0) {
        grades = this.applyOverrides(grades, input.overrides)
      }

      // Update the gradedAt timestamp
      grades = {
        ...grades,
        gradedAt: new Date().toISOString()
      }

      // Save to Drive
      const result = await driveService.saveGrades(
        input.assignmentId,
        input.sectionId,
        grades
      )

      if (!result.success) {
        return {
          success: false,
          error: result.error || 'Failed to save grades to Drive'
        }
      }

      // Update assignment status to 'graded'
      await driveService.updateAssignment({
        id: input.assignmentId,
        sectionId: input.sectionId,
        status: 'graded'
      })

      return {
        success: true,
        data: result.data
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save grades'
      return {
        success: false,
        error: message
      }
    }
  }

  /**
   * Get existing grades for an assignment
   */
  async getGrades(
    assignmentId: string,
    sectionId: string
  ): Promise<ServiceResult<AssignmentGrades | null>> {
    try {
      const result = await driveService.getGrades(assignmentId, sectionId)

      if (!result.success) {
        return {
          success: false,
          error: result.error || 'Failed to get grades from Drive'
        }
      }

      return {
        success: true,
        data: result.data
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to get grades'
      return {
        success: false,
        error: message
      }
    }
  }

  // ============================================================
  // Gradebook Methods
  // ============================================================

  /**
   * Get gradebook for a section
   * Aggregates grades from all assignments into a table view
   */
  async getGradebook(sectionId: string): Promise<ServiceResult<Gradebook>> {
    try {
      // Get section info
      const sectionResult = await driveService.getSection(sectionId)
      if (!sectionResult.success) {
        return { success: false, error: sectionResult.error }
      }
      const section = sectionResult.data

      // Get course info
      const courseResult = await driveService.getCourse(section.courseId)
      if (!courseResult.success) {
        return { success: false, error: courseResult.error }
      }
      const course = courseResult.data

      // Get roster
      const rosterResult = await driveService.getRoster(sectionId)
      if (!rosterResult.success) {
        return { success: false, error: rosterResult.error }
      }
      const roster = rosterResult.data
      const activeStudents = roster.students.filter((s) => s.active)

      // Get all assignments for this section
      const assignmentsResult = await driveService.listAssignments(sectionId)
      if (!assignmentsResult.success) {
        return { success: false, error: assignmentsResult.error }
      }
      const assignments = assignmentsResult.data

      // Build assessment columns (only for assignments with grades)
      const assessments: GradebookAssessment[] = []
      const allGrades = new Map<string, AssignmentGrades>() // assignmentId -> grades

      // Fetch grades for each assignment
      for (const assignment of assignments) {
        const gradesResult = await driveService.getGrades(assignment.id, sectionId)
        if (gradesResult.success && gradesResult.data) {
          allGrades.set(assignment.id, gradesResult.data)
          assessments.push({
            id: assignment.assessmentId,
            title: assignment.assessmentTitle,
            type: assignment.assessmentType,
            totalPoints: assignment.questionCount, // Each question = 1 point for now
            assignmentId: assignment.id
          })
        }
      }

      // Build entries for each student
      const entries: GradebookEntry[] = activeStudents.map((student) => {
        const grades: Record<string, GradeInfo | null> = {}
        let totalPercentage = 0
        let gradedCount = 0

        // Check each assessment for this student's grade
        for (const assessment of assessments) {
          const assignmentGrades = allGrades.get(assessment.assignmentId)
          if (assignmentGrades) {
            const record = assignmentGrades.records.find((r) => r.studentId === student.id)
            if (record) {
              grades[assessment.id] = {
                score: record.rawScore,
                totalPoints: record.totalQuestions,
                percentage: record.percentage,
                gradedAt: record.gradedAt
              }
              totalPercentage += record.percentage
              gradedCount++
            } else {
              grades[assessment.id] = null
            }
          } else {
            grades[assessment.id] = null
          }
        }

        return {
          studentId: student.id,
          studentName: `${student.lastName}, ${student.firstName}`,
          studentNumber: student.studentNumber,
          grades,
          averagePercentage: gradedCount > 0 ? Math.round((totalPercentage / gradedCount) * 10) / 10 : null
        }
      })

      // Sort entries by student name
      entries.sort((a, b) => a.studentName.localeCompare(b.studentName))

      const gradebook: Gradebook = {
        sectionId,
        sectionName: section.name,
        courseName: course.name,
        assessments,
        entries,
        generatedAt: new Date().toISOString()
      }

      return { success: true, data: gradebook }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to get gradebook'
      return { success: false, error: message }
    }
  }

  /**
   * Export gradebook to CSV format
   */
  async exportGradebookCSV(
    sectionId: string,
    includeStudentNumber = true
  ): Promise<ServiceResult<string>> {
    try {
      // Get gradebook data
      const gradebookResult = await this.getGradebook(sectionId)
      if (!gradebookResult.success) {
        return { success: false, error: gradebookResult.error }
      }
      const gradebook = gradebookResult.data

      // Build CSV header
      const headers: string[] = ['Student']
      if (includeStudentNumber) {
        headers.push('Student ID')
      }
      for (const assessment of gradebook.assessments) {
        headers.push(assessment.title)
      }
      headers.push('Average')

      // Build CSV rows
      const rows: string[][] = []
      for (const entry of gradebook.entries) {
        const row: string[] = [entry.studentName]
        if (includeStudentNumber) {
          row.push(entry.studentNumber ?? '')
        }
        for (const assessment of gradebook.assessments) {
          const grade = entry.grades[assessment.id]
          if (grade) {
            row.push(`${grade.percentage.toFixed(1)}%`)
          } else {
            row.push('-')
          }
        }
        row.push(entry.averagePercentage !== null ? `${entry.averagePercentage.toFixed(1)}%` : '-')
        rows.push(row)
      }

      // Convert to CSV string
      const escapeCSV = (value: string): string => {
        if (value.includes(',') || value.includes('"') || value.includes('\n')) {
          return `"${value.replace(/"/g, '""')}"`
        }
        return value
      }

      const csvLines = [
        headers.map(escapeCSV).join(','),
        ...rows.map((row) => row.map(escapeCSV).join(','))
      ]

      return { success: true, data: csvLines.join('\n') }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to export gradebook'
      return { success: false, error: message }
    }
  }
}

// Singleton instance
export const gradeService = new GradeService()
