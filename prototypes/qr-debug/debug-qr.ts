/**
 * QR Code Detection Debug Script
 *
 * This script tests various QR detection approaches on scanned scantron PDFs
 * to help diagnose detection issues.
 *
 * Usage:
 *   npx tsx prototypes/qr-debug/debug-qr.ts docs/scanned.pdf
 *
 * The script will:
 * 1. Extract each page from the PDF
 * 2. Try multiple detection approaches (different preprocessing, regions, rotations)
 * 3. Save debug images showing what was processed
 * 4. Output detailed results for each page
 */

import * as mupdf from 'mupdf'
import sharp from 'sharp'
import jsQR from 'jsqr'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readBarcodesFromImageData, prepareZXingModule, type ReaderOptions } from 'zxing-wasm/reader'

// Get the PDF path from command line args
const pdfPath = process.argv[2]
if (!pdfPath) {
  console.error('Usage: npx tsx debug-qr.ts <path-to-pdf>')
  process.exit(1)
}

// Create output directory for debug images
const outputDir = join(dirname(fileURLToPath(import.meta.url)), 'output')
if (!existsSync(outputDir)) {
  mkdirSync(outputDir, { recursive: true })
}

// Initialize zxing-wasm
async function initZXing(): Promise<void> {
  const wasmPath = join(process.cwd(), 'node_modules', 'zxing-wasm', 'dist', 'reader', 'zxing_reader.wasm')
  const wasmBuffer = readFileSync(wasmPath)
  prepareZXingModule({
    overrides: {
      wasmBinary: wasmBuffer.buffer as ArrayBuffer
    }
  })
  console.log('zxing-wasm initialized')
}

interface QRResult {
  method: string
  success: boolean
  data?: string
  error?: string
}

// Try jsQR on grayscale data
function tryJsQR(data: Buffer, width: number, height: number): QRResult {
  try {
    const rgbaData = new Uint8ClampedArray(width * height * 4)
    for (let j = 0; j < data.length; j++) {
      const idx = j * 4
      rgbaData[idx] = data[j]
      rgbaData[idx + 1] = data[j]
      rgbaData[idx + 2] = data[j]
      rgbaData[idx + 3] = 255
    }

    const result = jsQR(rgbaData, width, height)
    if (result) {
      return { method: 'jsQR', success: true, data: result.data }
    }
    return { method: 'jsQR', success: false }
  } catch (error) {
    return { method: 'jsQR', success: false, error: String(error) }
  }
}

// Try zxing-wasm on grayscale data
async function tryZXing(data: Buffer, width: number, height: number): Promise<QRResult> {
  try {
    const rgbaData = new Uint8ClampedArray(width * height * 4)
    for (let j = 0; j < data.length; j++) {
      const idx = j * 4
      rgbaData[idx] = data[j]
      rgbaData[idx + 1] = data[j]
      rgbaData[idx + 2] = data[j]
      rgbaData[idx + 3] = 255
    }

    const imageData = {
      data: rgbaData,
      width,
      height,
      colorSpace: 'srgb' as const
    }

    const readerOptions: ReaderOptions = {
      formats: ['QRCode'],
      tryHarder: true,
      tryRotate: true,
      tryInvert: true,
      tryDownscale: true,
      maxNumberOfSymbols: 1
    }

    const results = await readBarcodesFromImageData(imageData, readerOptions)
    if (results.length > 0) {
      return { method: 'zxing-wasm', success: true, data: results[0].text }
    }
    return { method: 'zxing-wasm', success: false }
  } catch (error) {
    return { method: 'zxing-wasm', success: false, error: String(error) }
  }
}

// Extract QR region from image (top-left area where QR code should be)
async function extractQRRegion(imageBuffer: Buffer): Promise<Buffer> {
  const metadata = await sharp(imageBuffer).metadata()
  const width = metadata.width || 0
  const height = metadata.height || 0

  // QR code is typically in the top-left, around coordinates (50, 120) at 72 DPI
  // At 150 DPI, that's roughly (104, 250)
  const dpiScale = width / 612 // 612 is letter width at 72 DPI
  const qrX = Math.floor(50 * dpiScale)
  const qrY = Math.floor(120 * dpiScale)
  const qrSize = Math.floor(100 * dpiScale) // 80pt QR + some margin

  return sharp(imageBuffer)
    .extract({
      left: qrX,
      top: qrY,
      width: Math.min(qrSize, width - qrX),
      height: Math.min(qrSize, height - qrY)
    })
    .toBuffer()
}

// Test all approaches on a single image
async function testAllApproaches(imageBuffer: Buffer, pageNum: number): Promise<void> {
  console.log(`\n${'='.repeat(60)}`)
  console.log(`PAGE ${pageNum}`)
  console.log('='.repeat(60))

  const results: QRResult[] = []

  // Save the original image for reference
  writeFileSync(join(outputDir, `page-${pageNum}-original.png`), imageBuffer)
  console.log(`Saved: page-${pageNum}-original.png`)

  // Get image dimensions
  const metadata = await sharp(imageBuffer).metadata()
  console.log(`Image size: ${metadata.width}x${metadata.height}`)

  // Approach 1: Full image, grayscale
  console.log('\n--- Approach 1: Full image, grayscale ---')
  const gray1 = await sharp(imageBuffer).grayscale().raw().toBuffer({ resolveWithObject: true })
  results.push(tryJsQR(gray1.data, gray1.info.width, gray1.info.height))
  results.push(await tryZXing(gray1.data, gray1.info.width, gray1.info.height))

  // Approach 2: Full image, normalized
  console.log('\n--- Approach 2: Full image, normalized ---')
  const normalized = await sharp(imageBuffer).grayscale().normalize().raw().toBuffer({ resolveWithObject: true })
  await sharp(normalized.data, { raw: { width: normalized.info.width, height: normalized.info.height, channels: 1 } })
    .toFile(join(outputDir, `page-${pageNum}-normalized.png`))
  results.push(tryJsQR(normalized.data, normalized.info.width, normalized.info.height))
  results.push(await tryZXing(normalized.data, normalized.info.width, normalized.info.height))

  // Approach 3: Full image, thresholded
  console.log('\n--- Approach 3: Full image, thresholded ---')
  const thresholded = await sharp(imageBuffer).grayscale().threshold(128).raw().toBuffer({ resolveWithObject: true })
  await sharp(thresholded.data, { raw: { width: thresholded.info.width, height: thresholded.info.height, channels: 1 } })
    .toFile(join(outputDir, `page-${pageNum}-threshold.png`))
  results.push(tryJsQR(thresholded.data, thresholded.info.width, thresholded.info.height))
  results.push(await tryZXing(thresholded.data, thresholded.info.width, thresholded.info.height))

  // Approach 4: Full image, sharpened
  console.log('\n--- Approach 4: Full image, sharpened ---')
  const sharpened = await sharp(imageBuffer).grayscale().sharpen({ sigma: 2 }).raw().toBuffer({ resolveWithObject: true })
  await sharp(sharpened.data, { raw: { width: sharpened.info.width, height: sharpened.info.height, channels: 1 } })
    .toFile(join(outputDir, `page-${pageNum}-sharpened.png`))
  results.push(tryJsQR(sharpened.data, sharpened.info.width, sharpened.info.height))
  results.push(await tryZXing(sharpened.data, sharpened.info.width, sharpened.info.height))

  // Approach 5: QR region only
  console.log('\n--- Approach 5: QR region only ---')
  try {
    const qrRegion = await extractQRRegion(imageBuffer)
    writeFileSync(join(outputDir, `page-${pageNum}-qr-region.png`), qrRegion)
    const qrGray = await sharp(qrRegion).grayscale().raw().toBuffer({ resolveWithObject: true })
    results.push({ ...tryJsQR(qrGray.data, qrGray.info.width, qrGray.info.height), method: 'jsQR (QR region)' })
    results.push({ ...await tryZXing(qrGray.data, qrGray.info.width, qrGray.info.height), method: 'zxing (QR region)' })
  } catch (e) {
    console.log('  Error extracting QR region:', e)
  }

  // Approach 6: Rotated 180 degrees
  console.log('\n--- Approach 6: Rotated 180 degrees ---')
  const rotated = await sharp(imageBuffer).rotate(180).grayscale().raw().toBuffer({ resolveWithObject: true })
  await sharp(rotated.data, { raw: { width: rotated.info.width, height: rotated.info.height, channels: 1 } })
    .toFile(join(outputDir, `page-${pageNum}-rotated180.png`))
  results.push({ ...tryJsQR(rotated.data, rotated.info.width, rotated.info.height), method: 'jsQR (rotated 180)' })
  results.push({ ...await tryZXing(rotated.data, rotated.info.width, rotated.info.height), method: 'zxing (rotated 180)' })

  // Approach 7: Higher resolution (scale up 2x)
  console.log('\n--- Approach 7: Scaled up 2x ---')
  const scaled = await sharp(imageBuffer).resize({ width: (metadata.width || 1000) * 2 }).grayscale().raw().toBuffer({ resolveWithObject: true })
  results.push({ ...tryJsQR(scaled.data, scaled.info.width, scaled.info.height), method: 'jsQR (2x scale)' })
  results.push({ ...await tryZXing(scaled.data, scaled.info.width, scaled.info.height), method: 'zxing (2x scale)' })

  // Approach 8: Lower resolution (scale down to 50%)
  console.log('\n--- Approach 8: Scaled down 50% ---')
  const scaledDown = await sharp(imageBuffer).resize({ width: Math.floor((metadata.width || 1000) / 2) }).grayscale().raw().toBuffer({ resolveWithObject: true })
  results.push({ ...tryJsQR(scaledDown.data, scaledDown.info.width, scaledDown.info.height), method: 'jsQR (0.5x scale)' })
  results.push({ ...await tryZXing(scaledDown.data, scaledDown.info.width, scaledDown.info.height), method: 'zxing (0.5x scale)' })

  // Print results summary
  console.log('\n--- RESULTS SUMMARY ---')
  const successCount = results.filter(r => r.success).length
  console.log(`Success rate: ${successCount}/${results.length}`)

  for (const result of results) {
    const status = result.success ? '✅' : '❌'
    const dataPreview = result.data ? result.data.substring(0, 50) + (result.data.length > 50 ? '...' : '') : ''
    console.log(`  ${status} ${result.method}: ${result.success ? dataPreview : (result.error || 'No QR found')}`)
  }
}

// Main function
async function main(): Promise<void> {
  console.log('QR Detection Debug Script')
  console.log('='.repeat(60))
  console.log(`PDF: ${pdfPath}`)
  console.log(`Output: ${outputDir}`)

  // Initialize zxing-wasm
  await initZXing()

  // Read the PDF
  const pdfBuffer = readFileSync(pdfPath)
  console.log(`PDF size: ${pdfBuffer.length} bytes`)

  // Open with mupdf
  const doc = mupdf.Document.openDocument(pdfBuffer, 'application/pdf')
  const pageCount = doc.countPages()
  console.log(`Page count: ${pageCount}`)

  // Process each page
  for (let pageNum = 0; pageNum < pageCount; pageNum++) {
    const page = doc.loadPage(pageNum)
    const bounds = page.getBounds()

    // Render at 150 DPI
    const scale = 150 / 72
    const matrix = mupdf.Matrix.scale(scale, scale)
    const pixmap = page.toPixmap(matrix, mupdf.ColorSpace.DeviceRGB, false, true)

    const pngData = pixmap.asPNG()
    const imageBuffer = Buffer.from(pngData)

    // Test all approaches
    await testAllApproaches(imageBuffer, pageNum + 1)

    // Cleanup
    pixmap.destroy()
    page.destroy()
  }

  doc.destroy()

  console.log('\n' + '='.repeat(60))
  console.log('Debug complete!')
  console.log(`Check ${outputDir} for debug images`)
}

main().catch(console.error)
