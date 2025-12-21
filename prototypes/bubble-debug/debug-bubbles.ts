/**
 * Debug script to analyze bubble detection on scanned PDFs
 * Run with: npx tsx prototypes/bubble-debug/debug-bubbles.ts docs/scanned.pdf
 */

import * as mupdf from 'mupdf'
import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import sharp from 'sharp'
import { join, dirname } from 'path'

const OUTPUT_DIR = join(dirname(import.meta.url.replace('file://', '')), 'output')

// Layout constants matching pdf.service.ts (at 72 DPI)
const LAYOUT_72DPI = {
  LETTER_WIDTH: 612,
  LETTER_HEIGHT: 792,
  MARGIN: 50,
  BUBBLE_GRID_Y_START: 256, // FIXED: Header + QR section + spacing
  ROW_HEIGHT: 24,
  BUBBLE_SPACING: 22,
  BUBBLE_RADIUS: 7,
  QUESTION_NUM_WIDTH: 30,
  QUESTIONS_PER_COLUMN: 25,
  CHOICE_LABELS: ['A', 'B', 'C', 'D']
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

async function main() {
  const pdfPath = process.argv[2]
  if (!pdfPath) {
    console.error('Usage: npx tsx debug-bubbles.ts <pdf-path>')
    process.exit(1)
  }

  console.log('Reading PDF:', pdfPath)
  const pdfBuffer = readFileSync(pdfPath)

  // Create output directory
  mkdirSync(OUTPUT_DIR, { recursive: true })

  // Open PDF with mupdf
  const doc = mupdf.Document.openDocument(pdfBuffer, 'application/pdf')
  const pageCount = doc.countPages()
  console.log(`PDF has ${pageCount} pages`)

  for (let i = 0; i < pageCount; i++) {
    console.log(`\n=== Processing page ${i + 1} ===`)

    const page = doc.loadPage(i)
    const bounds = page.getBounds()
    console.log(`Page bounds: ${bounds[0]}, ${bounds[1]}, ${bounds[2]}, ${bounds[3]}`)

    // Render at 150 DPI for analysis
    const scale = 150 / 72
    const pixmap = page.toPixmap([scale, 0, 0, scale, 0, 0], mupdf.ColorSpace.DeviceGray)
    let pngBuffer = Buffer.from(pixmap.asPNG())

    // Get image dimensions
    let metadata = await sharp(pngBuffer).metadata()
    let width = metadata.width!
    let height = metadata.height!
    console.log(`Image dimensions: ${width}x${height}`)

    // Check orientation by sampling corners
    const { data: cornerData } = await sharp(pngBuffer).grayscale().raw().toBuffer({ resolveWithObject: true })
    const cornerSize = 60
    const cornerOffset = 80

    const topLeftDark = sampleCornerDarkness(cornerData, width, height, cornerOffset, cornerOffset, cornerSize)
    const topRightDark = sampleCornerDarkness(cornerData, width, height, width - cornerOffset - cornerSize, cornerOffset, cornerSize)
    const bottomLeftDark = sampleCornerDarkness(cornerData, width, height, cornerOffset, height - cornerOffset - cornerSize, cornerSize)
    const bottomRightDark = sampleCornerDarkness(cornerData, width, height, width - cornerOffset - cornerSize, height - cornerOffset - cornerSize, cornerSize)

    console.log(`Corner darkness: TL=${topLeftDark.toFixed(0)}%, TR=${topRightDark.toFixed(0)}%, BL=${bottomLeftDark.toFixed(0)}%, BR=${bottomRightDark.toFixed(0)}%`)

    const isUpsideDown = topRightDark > 30 && topRightDark > bottomLeftDark
    console.log(`Orientation: ${isUpsideDown ? 'UPSIDE DOWN - rotating' : 'correct'}`)

    if (isUpsideDown) {
      pngBuffer = await sharp(pngBuffer).rotate(180).toBuffer()
      metadata = await sharp(pngBuffer).metadata()
      width = metadata.width!
      height = metadata.height!
    }

    // Save the raw page image
    writeFileSync(join(OUTPUT_DIR, `page-${i + 1}-raw.png`), pngBuffer)

    // Convert to raw grayscale for analysis
    const { data } = await sharp(pngBuffer)
      .grayscale()
      .raw()
      .toBuffer({ resolveWithObject: true })

    // Calculate DPI scale
    const dpiScale = width / LAYOUT_72DPI.LETTER_WIDTH
    console.log(`DPI scale factor: ${dpiScale.toFixed(3)}`)

    // Analyze bubble positions for 7 questions (single column)
    const questionCount = 7
    const columnCount = 1

    const gridStartY = Math.floor(LAYOUT_72DPI.BUBBLE_GRID_Y_START * dpiScale)
    const rowHeight = Math.floor(LAYOUT_72DPI.ROW_HEIGHT * dpiScale)
    const bubbleSpacing = Math.floor(LAYOUT_72DPI.BUBBLE_SPACING * dpiScale)
    const bubbleRadius = Math.floor(LAYOUT_72DPI.BUBBLE_RADIUS * dpiScale)
    const margin = Math.floor(LAYOUT_72DPI.MARGIN * dpiScale)
    const questionNumWidth = Math.floor(LAYOUT_72DPI.QUESTION_NUM_WIDTH * dpiScale)

    console.log(`\nLayout at ${Math.round(dpiScale * 72)} DPI:`)
    console.log(`  Grid start Y: ${gridStartY}`)
    console.log(`  Row height: ${rowHeight}`)
    console.log(`  Bubble spacing: ${bubbleSpacing}`)
    console.log(`  Bubble radius: ${bubbleRadius}`)
    console.log(`  Margin: ${margin}`)

    console.log(`\nSampling bubble positions:`)

    // Sample each bubble position
    for (let q = 0; q < questionCount; q++) {
      const row = q
      const rowY = gridStartY + row * rowHeight + Math.floor(rowHeight / 2)

      let intensities: { choice: string; x: number; y: number; intensity: number }[] = []

      for (let c = 0; c < 4; c++) {
        const bubbleX = margin + questionNumWidth + 5 + c * bubbleSpacing + bubbleRadius
        const bubbleY = rowY

        // Sample a 20x20 region centered on the bubble
        const sampleSize = 10
        let sum = 0
        let count = 0

        for (let dy = -sampleSize; dy <= sampleSize; dy++) {
          for (let dx = -sampleSize; dx <= sampleSize; dx++) {
            const px = bubbleX + dx
            const py = bubbleY + dy
            if (px >= 0 && px < width && py >= 0 && py < height) {
              const idx = py * width + px
              sum += data[idx]
              count++
            }
          }
        }

        const intensity = count > 0 ? sum / count : 255
        intensities.push({
          choice: LAYOUT_72DPI.CHOICE_LABELS[c],
          x: bubbleX,
          y: bubbleY,
          intensity: Math.round(intensity)
        })
      }

      // Find the darkest bubble
      const darkest = intensities.reduce((a, b) => a.intensity < b.intensity ? a : b)
      const filled = darkest.intensity < 150 ? darkest.choice : 'NONE'

      console.log(`Q${q + 1}: ${intensities.map(i => `${i.choice}=${i.intensity}`).join(' ')} → ${filled}`)
    }

    // Create a debug image showing sample positions
    await createDebugImage(pngBuffer, width, height, questionCount, dpiScale)
    console.log(`Debug image saved to: ${join(OUTPUT_DIR, `page-${i + 1}-debug.png`)}`)
  }

  console.log('\n=== Done ===')
  console.log(`Output files in: ${OUTPUT_DIR}`)
}

async function createDebugImage(
  pngBuffer: Buffer,
  width: number,
  height: number,
  questionCount: number,
  dpiScale: number
) {
  // Create SVG overlay showing sample positions
  const gridStartY = Math.floor(LAYOUT_72DPI.BUBBLE_GRID_Y_START * dpiScale)
  const rowHeight = Math.floor(LAYOUT_72DPI.ROW_HEIGHT * dpiScale)
  const bubbleSpacing = Math.floor(LAYOUT_72DPI.BUBBLE_SPACING * dpiScale)
  const bubbleRadius = Math.floor(LAYOUT_72DPI.BUBBLE_RADIUS * dpiScale)
  const margin = Math.floor(LAYOUT_72DPI.MARGIN * dpiScale)
  const questionNumWidth = Math.floor(LAYOUT_72DPI.QUESTION_NUM_WIDTH * dpiScale)

  let circles = ''
  for (let q = 0; q < questionCount; q++) {
    const rowY = gridStartY + q * rowHeight + Math.floor(rowHeight / 2)
    for (let c = 0; c < 4; c++) {
      const bubbleX = margin + questionNumWidth + 5 + c * bubbleSpacing + bubbleRadius
      circles += `<circle cx="${bubbleX}" cy="${rowY}" r="${bubbleRadius}" fill="none" stroke="red" stroke-width="2"/>`
    }
  }

  const svg = `<svg width="${width}" height="${height}">${circles}</svg>`

  // Composite the SVG over the image
  const result = await sharp(pngBuffer)
    .composite([{
      input: Buffer.from(svg),
      top: 0,
      left: 0
    }])
    .png()
    .toBuffer()

  writeFileSync(join(OUTPUT_DIR, 'page-1-debug.png'), result)
}

main().catch(console.error)
