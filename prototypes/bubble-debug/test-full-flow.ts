/**
 * Full integration test for the grading flow
 * Tests: orientation detection, QR reading, OCR fallback, bubble detection
 */

import * as mupdf from 'mupdf'
import { readFileSync } from 'fs'
import sharp from 'sharp'
import { readBarcodesFromImageData, prepareZXingModule, type ReaderOptions } from 'zxing-wasm/reader'
import Tesseract from 'tesseract.js'

// Types
interface ScantronQRData {
  v: 1
  aid: string
  sid: string
}

interface PageResult {
  pageNumber: number
  orientation: 'correct' | 'upside_down'
  qrData: ScantronQRData | null
  qrError?: string
  ocrStudentName?: string
  bubbleResults: string[]
  flags: string[]
}

// Layout constants
const LAYOUT = {
  LETTER_WIDTH: 612,
  LETTER_HEIGHT: 792,
  MARGIN: 50,
  REG_MARK_SIZE: 20,
  REG_MARK_OFFSET: 25,
  BUBBLE_GRID_Y_START: 256,
  ROW_HEIGHT: 24,
  BUBBLE_SPACING: 22,
  BUBBLE_RADIUS: 7,
  QUESTION_NUM_WIDTH: 30,
  NAME_REGION: {
    X: 85,
    Y: 88,
    WIDTH: 220,
    HEIGHT: 18
  }
}

const CHOICE_LABELS = ['A', 'B', 'C', 'D']

let zxingInitialized = false

async function initZXing() {
  if (!zxingInitialized) {
    await prepareZXingModule()
    zxingInitialized = true
  }
}

function sampleCornerDarkness(data: Buffer, width: number, height: number, startX: number, startY: number, size: number): number {
  let darkPixels = 0
  let totalPixels = 0

  for (let y = startY; y < startY + size && y < height; y++) {
    for (let x = startX; x < startX + size && x < width; x++) {
      const idx = y * width + x
      totalPixels++
      if (data[idx] < 128) {
        darkPixels++
      }
    }
  }

  return totalPixels > 0 ? (darkPixels / totalPixels) * 100 : 0
}

async function detectOrientation(pngBuffer: Buffer, width: number, height: number): Promise<boolean> {
  const { data } = await sharp(pngBuffer).grayscale().raw().toBuffer({ resolveWithObject: true })

  const dpiScale = width / LAYOUT.LETTER_WIDTH
  const markSize = Math.floor(LAYOUT.REG_MARK_SIZE * dpiScale)
  const offset = Math.floor(LAYOUT.REG_MARK_OFFSET * dpiScale)

  const topRightDarkness = sampleCornerDarkness(data, width, height, width - offset - markSize, offset, markSize)
  const bottomLeftDarkness = sampleCornerDarkness(data, width, height, offset, height - offset - markSize, markSize)

  const bothHaveFilledShapes = topRightDarkness > 40 && bottomLeftDarkness > 40

  if (bothHaveFilledShapes) {
    return bottomLeftDarkness > topRightDarkness + 5
  }

  return false
}

async function tryDecodeQR(data: Buffer, width: number, height: number): Promise<ScantronQRData | null> {
  await initZXing()

  const imageData: ImageData = {
    data: new Uint8ClampedArray(data),
    width,
    height,
    colorSpace: 'srgb' as PredefinedColorSpace
  }

  const readerOptions: ReaderOptions = {
    formats: ['QRCode'],
    tryHarder: true,
    tryRotate: true,
    tryInvert: true,
    maxNumberOfSymbols: 1
  }

  try {
    const results = await readBarcodesFromImageData(imageData, readerOptions)
    if (results.length > 0) {
      const parsed = JSON.parse(results[0].text) as ScantronQRData
      if (parsed.v === 1) {
        return parsed
      }
    }
  } catch {
    // QR not found or parse error
  }

  return null
}

async function extractStudentNameOCR(pngBuffer: Buffer, width: number): Promise<string | null> {
  try {
    const dpiScale = width / LAYOUT.LETTER_WIDTH
    const region = LAYOUT.NAME_REGION
    const cropX = Math.floor(region.X * dpiScale)
    const cropY = Math.floor(region.Y * dpiScale)
    const cropWidth = Math.floor(region.WIDTH * dpiScale)
    const cropHeight = Math.floor(region.HEIGHT * dpiScale)

    const nameRegion = await sharp(pngBuffer)
      .extract({ left: cropX, top: cropY, width: cropWidth, height: cropHeight })
      .resize({ width: cropWidth * 2 })
      .normalize()
      .sharpen()
      .png()
      .toBuffer()

    const result = await Tesseract.recognize(nameRegion, 'eng', {
      logger: () => {}
    })

    const text = result.data.text.trim()
    if (result.data.confidence > 50 && text.length > 2) {
      return text
    }

    return null
  } catch {
    return null
  }
}

async function detectBubbles(pngBuffer: Buffer, questionCount: number): Promise<string[]> {
  const metadata = await sharp(pngBuffer).metadata()
  const width = metadata.width!
  const height = metadata.height!

  const { data } = await sharp(pngBuffer).grayscale().raw().toBuffer({ resolveWithObject: true })

  const dpiScale = width / LAYOUT.LETTER_WIDTH
  const gridStartY = Math.floor(LAYOUT.BUBBLE_GRID_Y_START * dpiScale)
  const rowHeight = Math.floor(LAYOUT.ROW_HEIGHT * dpiScale)
  const bubbleSpacing = Math.floor(LAYOUT.BUBBLE_SPACING * dpiScale)
  const bubbleRadius = Math.floor(LAYOUT.BUBBLE_RADIUS * dpiScale)
  const margin = Math.floor(LAYOUT.MARGIN * dpiScale)
  const questionNumWidth = Math.floor(LAYOUT.QUESTION_NUM_WIDTH * dpiScale)

  const results: string[] = []

  for (let q = 0; q < questionCount; q++) {
    const rowY = gridStartY + q * rowHeight + Math.floor(rowHeight / 2)
    let darkestChoice = 'NONE'
    let darkestIntensity = 255

    for (let c = 0; c < 4; c++) {
      const bubbleX = margin + questionNumWidth + 5 + c * bubbleSpacing + bubbleRadius

      // Sample region
      const sampleSize = 10
      let sum = 0
      let count = 0

      for (let dy = -sampleSize; dy <= sampleSize; dy++) {
        for (let dx = -sampleSize; dx <= sampleSize; dx++) {
          const px = bubbleX + dx
          const py = rowY + dy
          if (px >= 0 && px < width && py >= 0 && py < height) {
            const idx = py * width + px
            sum += data[idx]
            count++
          }
        }
      }

      const intensity = count > 0 ? sum / count : 255
      if (intensity < darkestIntensity && intensity < 180) {
        darkestIntensity = intensity
        darkestChoice = CHOICE_LABELS[c]
      }
    }

    results.push(darkestChoice)
  }

  return results
}

async function main() {
  const pdfPath = process.argv[2] || 'docs/scanned.pdf'

  console.log('='.repeat(70))
  console.log('FULL GRADING FLOW TEST')
  console.log('='.repeat(70))
  console.log(`\nPDF: ${pdfPath}\n`)

  const pdfBuffer = readFileSync(pdfPath)
  const doc = mupdf.Document.openDocument(pdfBuffer, 'application/pdf')
  const pageCount = doc.countPages()

  const results: PageResult[] = []

  for (let i = 0; i < pageCount; i++) {
    console.log(`\n${'─'.repeat(50)}`)
    console.log(`PAGE ${i + 1}`)
    console.log('─'.repeat(50))

    const page = doc.loadPage(i)
    const scale = 150 / 72
    const pixmap = page.toPixmap([scale, 0, 0, scale, 0, 0], mupdf.ColorSpace.DeviceGray)
    let pngBuffer = Buffer.from(pixmap.asPNG())

    let metadata = await sharp(pngBuffer).metadata()
    let width = metadata.width!
    let height = metadata.height!

    const flags: string[] = []

    // Step 1: Orientation detection
    const isUpsideDown = await detectOrientation(pngBuffer, width, height)
    console.log(`Orientation: ${isUpsideDown ? '🔄 UPSIDE DOWN → rotating' : '✓ correct'}`)

    if (isUpsideDown) {
      pngBuffer = await sharp(pngBuffer).rotate(180).toBuffer()
      flags.push('rotated_180')
    }

    // Step 2: QR code reading
    const { data: qrImageData, info } = await sharp(pngBuffer)
      .resize({ width: width * 2 })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true })

    const qrData = await tryDecodeQR(qrImageData, info.width, info.height)
    let qrError: string | undefined
    let ocrStudentName: string | undefined

    if (qrData) {
      console.log(`QR Code: ✓ Student ID: ${qrData.sid.slice(0, 8)}...`)
    } else {
      qrError = 'QR code not found or unreadable'
      flags.push('qr_error')
      console.log(`QR Code: ✗ NOT FOUND`)

      // Step 3: OCR fallback
      console.log(`OCR: Attempting to extract student name...`)
      ocrStudentName = await extractStudentNameOCR(pngBuffer, width) || undefined
      if (ocrStudentName) {
        console.log(`OCR: ✓ Detected name: "${ocrStudentName}"`)
      } else {
        console.log(`OCR: ✗ Could not extract name`)
      }
    }

    // Step 4: Bubble detection
    const bubbleResults = await detectBubbles(pngBuffer, 7)
    console.log(`Bubbles: ${bubbleResults.join(', ')}`)

    results.push({
      pageNumber: i + 1,
      orientation: isUpsideDown ? 'upside_down' : 'correct',
      qrData,
      qrError,
      ocrStudentName,
      bubbleResults,
      flags
    })
  }

  // Summary
  console.log('\n' + '='.repeat(70))
  console.log('SUMMARY')
  console.log('='.repeat(70))

  const validPages = results.filter(r => r.qrData)
  const unidentifiedPages = results.filter(r => !r.qrData)
  const rotatedPages = results.filter(r => r.orientation === 'upside_down')

  console.log(`\nTotal pages: ${results.length}`)
  console.log(`Valid scantrons (QR read): ${validPages.length}`)
  console.log(`Unidentified pages: ${unidentifiedPages.length}`)
  console.log(`Rotated pages: ${rotatedPages.length}`)

  if (validPages.length > 0) {
    console.log('\n✓ Valid Scantrons:')
    for (const p of validPages) {
      console.log(`  Page ${p.pageNumber}: Student ${p.qrData!.sid.slice(0, 12)}... | Answers: ${p.bubbleResults.join(',')}`)
    }
  }

  if (unidentifiedPages.length > 0) {
    console.log('\n⚠ Unidentified Pages (need manual assignment):')
    for (const p of unidentifiedPages) {
      const ocrInfo = p.ocrStudentName ? ` | OCR: "${p.ocrStudentName}"` : ''
      console.log(`  Page ${p.pageNumber}: ${p.qrError}${ocrInfo}`)
    }
  }

  // Final status
  console.log('\n' + '─'.repeat(70))
  if (unidentifiedPages.length === 0) {
    console.log('✅ All pages successfully identified!')
  } else {
    console.log(`⚠️  ${unidentifiedPages.length} page(s) need manual student assignment`)
  }
  console.log('─'.repeat(70))
}

main().catch(console.error)
