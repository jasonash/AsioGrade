/**
 * Test OCR extraction on a scantron page
 */

import * as mupdf from 'mupdf'
import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import sharp from 'sharp'
import Tesseract from 'tesseract.js'
import { join, dirname } from 'path'

const OUTPUT_DIR = join(dirname(import.meta.url.replace('file://', '')), 'output')

// Layout constants at 72 DPI
const LAYOUT = {
  LETTER_WIDTH: 612,
  NAME_REGION: {
    X: 85,        // After "Name: " label
    Y: 88,        // Header row with student info
    WIDTH: 220,   // Wide enough for long names
    HEIGHT: 18    // Tall enough for the text
  }
}

async function main() {
  const pdfPath = process.argv[2] || 'docs/scanned.pdf'
  const pageNum = parseInt(process.argv[3] || '5') - 1

  console.log(`Testing OCR on page ${pageNum + 1} of ${pdfPath}\n`)

  const pdfBuffer = readFileSync(pdfPath)
  mkdirSync(OUTPUT_DIR, { recursive: true })

  const doc = mupdf.Document.openDocument(pdfBuffer, 'application/pdf')
  const page = doc.loadPage(pageNum)

  // Render at 150 DPI
  const scale = 150 / 72
  const pixmap = page.toPixmap([scale, 0, 0, scale, 0, 0], mupdf.ColorSpace.DeviceGray)
  const pngBuffer = Buffer.from(pixmap.asPNG())

  const metadata = await sharp(pngBuffer).metadata()
  const width = metadata.width!
  const height = metadata.height!
  console.log(`Image: ${width}x${height}`)

  // Calculate DPI scale
  const dpiScale = width / LAYOUT.LETTER_WIDTH
  console.log(`DPI scale: ${dpiScale.toFixed(3)}`)

  // Calculate name region coordinates
  const region = LAYOUT.NAME_REGION
  const cropX = Math.floor(region.X * dpiScale)
  const cropY = Math.floor(region.Y * dpiScale)
  const cropWidth = Math.floor(region.WIDTH * dpiScale)
  const cropHeight = Math.floor(region.HEIGHT * dpiScale)

  console.log(`\nName region: (${cropX}, ${cropY}) ${cropWidth}x${cropHeight}`)

  // Crop and enhance the name region
  const nameRegion = await sharp(pngBuffer)
    .extract({ left: cropX, top: cropY, width: cropWidth, height: cropHeight })
    .resize({ width: cropWidth * 2 }) // Upscale 2x for better OCR
    .normalize()
    .sharpen()
    .png()
    .toBuffer()

  // Save the cropped region for inspection
  writeFileSync(join(OUTPUT_DIR, `page-${pageNum + 1}-name-region.png`), nameRegion)
  console.log(`Saved name region to: ${join(OUTPUT_DIR, `page-${pageNum + 1}-name-region.png`)}`)

  // Run OCR
  console.log('\nRunning OCR...')
  const result = await Tesseract.recognize(nameRegion, 'eng', {
    logger: (m) => {
      if (m.status === 'recognizing text') {
        process.stdout.write(`\rProgress: ${(m.progress * 100).toFixed(0)}%`)
      }
    }
  })

  console.log('\n')
  console.log('='.repeat(50))
  console.log('OCR Result:')
  console.log('='.repeat(50))
  console.log(`Text: "${result.data.text.trim()}"`)
  console.log(`Confidence: ${result.data.confidence.toFixed(1)}%`)
  console.log('='.repeat(50))

  // Also show word-level details
  if (result.data.words && result.data.words.length > 0) {
    console.log('\nWord-level details:')
    for (const word of result.data.words) {
      console.log(`  "${word.text}" (confidence: ${word.confidence.toFixed(0)}%)`)
    }
  }
}

main().catch(console.error)
