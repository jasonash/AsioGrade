/**
 * Debug script to analyze corner marks for orientation detection
 */

import * as mupdf from 'mupdf'
import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import sharp from 'sharp'
import { join, dirname } from 'path'

const OUTPUT_DIR = join(dirname(import.meta.url.replace('file://', '')), 'output')

async function main() {
  const pdfPath = process.argv[2] || 'docs/scanned.pdf'
  const pageNum = parseInt(process.argv[3] || '6') - 1

  console.log(`Analyzing page ${pageNum + 1} of ${pdfPath}`)

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

  // Registration mark constants
  const LETTER_WIDTH = 612
  const REG_MARK_SIZE = 20
  const REG_MARK_OFFSET = 25

  const dpiScale = width / LETTER_WIDTH
  console.log(`DPI scale: ${dpiScale.toFixed(3)}`)

  const markSize = Math.floor(REG_MARK_SIZE * dpiScale)
  const offset = Math.floor(REG_MARK_OFFSET * dpiScale)
  console.log(`Mark size: ${markSize}, Offset: ${offset}`)

  // Get raw grayscale data
  const { data } = await sharp(pngBuffer).grayscale().raw().toBuffer({ resolveWithObject: true })

  // Sample all four corners
  const corners = [
    { name: 'TL', x: offset, y: offset },
    { name: 'TR', x: width - offset - markSize, y: offset },
    { name: 'BL', x: offset, y: height - offset - markSize },
    { name: 'BR', x: width - offset - markSize, y: height - offset - markSize }
  ]

  console.log('\nCorner positions and darkness:')
  for (const corner of corners) {
    const darkness = sampleRegion(data, width, height, corner.x, corner.y, markSize)
    console.log(`  ${corner.name}: pos=(${corner.x}, ${corner.y}), size=${markSize}, darkness=${darkness.toFixed(1)}%`)
  }

  // Create debug image with corner regions marked
  let svg = `<svg width="${width}" height="${height}">`
  for (const corner of corners) {
    svg += `<rect x="${corner.x}" y="${corner.y}" width="${markSize}" height="${markSize}" fill="none" stroke="red" stroke-width="3"/>`
    svg += `<text x="${corner.x + 5}" y="${corner.y + 20}" fill="red" font-size="16">${corner.name}</text>`
  }
  svg += '</svg>'

  const debugImage = await sharp(pngBuffer)
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .png()
    .toBuffer()

  const outputPath = join(OUTPUT_DIR, `page-${pageNum + 1}-corners.png`)
  writeFileSync(outputPath, debugImage)
  console.log(`\nDebug image saved: ${outputPath}`)
}

function sampleRegion(data: Buffer, width: number, height: number, startX: number, startY: number, size: number): number {
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

main().catch(console.error)
