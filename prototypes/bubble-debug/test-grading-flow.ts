/**
 * Test script to verify the grading flow handles unidentified pages correctly
 */

import * as mupdf from 'mupdf'
import { readFileSync, writeFileSync } from 'fs'
import sharp from 'sharp'
import { readBarcodesFromImageData, prepareZXingModule, type ReaderOptions } from 'zxing-wasm/reader'

// Simplified types
interface ScantronQRData {
  v: 1
  aid: string
  sid: string
}

interface PageResult {
  pageNumber: number
  qrData: ScantronQRData | null
  qrError?: string
  flags: string[]
  answersDetected: number
}

type PageType = 'valid_scantron' | 'unidentified_scantron' | 'blank_page' | 'unknown_document'

// Constants matching grade.service.ts
const LAYOUT = {
  LETTER_WIDTH: 612,
  REG_MARK_SIZE: 20,
  REG_MARK_OFFSET: 25
}

let zxingInitialized = false

async function initZXing() {
  if (!zxingInitialized) {
    await prepareZXingModule()
    zxingInitialized = true
  }
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

function classifyPage(result: PageResult): PageType {
  const hasQR = !!result.qrData
  const hasAnswers = result.answersDetected > 0
  const hasQRError = result.flags.includes('qr_error')

  if (hasQR) {
    return 'valid_scantron'
  }

  if (hasQRError) {
    return 'unidentified_scantron'
  }

  if (!hasAnswers) {
    return 'blank_page'
  }

  return 'unknown_document'
}

async function main() {
  const pdfPath = process.argv[2] || 'docs/scanned.pdf'

  console.log(`Testing grading flow on ${pdfPath}\n`)
  console.log('='.repeat(60))

  const pdfBuffer = readFileSync(pdfPath)
  const doc = mupdf.Document.openDocument(pdfBuffer, 'application/pdf')
  const pageCount = doc.countPages()

  const results: PageResult[] = []

  for (let i = 0; i < pageCount; i++) {
    console.log(`\n=== Page ${i + 1} ===`)

    const page = doc.loadPage(i)
    const scale = 150 / 72
    const pixmap = page.toPixmap([scale, 0, 0, scale, 0, 0], mupdf.ColorSpace.DeviceGray)
    let pngBuffer = Buffer.from(pixmap.asPNG())

    let metadata = await sharp(pngBuffer).metadata()
    let width = metadata.width!
    let height = metadata.height!

    const flags: string[] = []

    // Check orientation
    const isUpsideDown = await detectOrientation(pngBuffer, width, height)
    console.log(`Orientation: ${isUpsideDown ? 'UPSIDE DOWN - rotating' : 'correct'}`)

    if (isUpsideDown) {
      pngBuffer = await sharp(pngBuffer).rotate(180).toBuffer()
      flags.push('rotated_180')
    }

    // Try to read QR
    let qrData: ScantronQRData | null = null
    let qrError: string | undefined

    const { data: qrImageData, info } = await sharp(pngBuffer)
      .resize({ width: width * 2 })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true })

    qrData = await tryDecodeQR(qrImageData, info.width, info.height)

    if (!qrData) {
      qrError = 'QR code not found or unreadable'
      flags.push('qr_error')
      console.log('QR: NOT FOUND')
    } else {
      console.log(`QR: Found - Student ID: ${qrData.sid}`)
    }

    // For simplicity, assume 7 answers detected (would need full bubble detection)
    const answersDetected = 7

    results.push({
      pageNumber: i + 1,
      qrData,
      qrError,
      flags,
      answersDetected
    })

    const pageType = classifyPage(results[i])
    console.log(`Classification: ${pageType}`)
  }

  // Summary
  console.log('\n' + '='.repeat(60))
  console.log('\nSUMMARY:')
  console.log('-'.repeat(40))

  const validPages = results.filter(r => classifyPage(r) === 'valid_scantron')
  const unidentifiedPages = results.filter(r => classifyPage(r) === 'unidentified_scantron')
  const blankPages = results.filter(r => classifyPage(r) === 'blank_page')
  const unknownPages = results.filter(r => classifyPage(r) === 'unknown_document')

  console.log(`Valid scantrons: ${validPages.length}`)
  for (const p of validPages) {
    console.log(`  - Page ${p.pageNumber}: Student ${p.qrData?.sid}`)
  }

  console.log(`\nUnidentified scantrons: ${unidentifiedPages.length}`)
  for (const p of unidentifiedPages) {
    console.log(`  - Page ${p.pageNumber}: ${p.qrError}`)
  }

  console.log(`\nBlank pages: ${blankPages.length}`)
  console.log(`Unknown documents: ${unknownPages.length}`)

  // Alert if unidentified pages exist
  if (unidentifiedPages.length > 0) {
    console.log('\n⚠️  ATTENTION: There are unidentified scantrons!')
    console.log('   These pages need manual student assignment.')
  }
}

main().catch(console.error)
