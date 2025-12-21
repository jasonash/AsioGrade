/**
 * Debug script to test QR code reading on a specific page
 */

import * as mupdf from 'mupdf'
import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import sharp from 'sharp'
import { join, dirname } from 'path'
import { readBarcodesFromImageData, prepareZXingModule, type ReaderOptions } from 'zxing-wasm/reader'

const OUTPUT_DIR = join(dirname(import.meta.url.replace('file://', '')), 'output')

let zxingInitialized = false

async function initZXing() {
  if (!zxingInitialized) {
    await prepareZXingModule()
    zxingInitialized = true
  }
}

async function tryDecodeQR(data: Buffer, width: number, height: number): Promise<string | null> {
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
      return results[0].text
    }
  } catch (error) {
    console.error('ZXing error:', error)
  }

  return null
}

async function main() {
  const pdfPath = process.argv[2] || 'docs/scanned.pdf'
  const pageNum = parseInt(process.argv[3] || '5') - 1

  console.log(`Testing QR reading on page ${pageNum + 1} of ${pdfPath}\n`)

  const pdfBuffer = readFileSync(pdfPath)
  mkdirSync(OUTPUT_DIR, { recursive: true })

  const doc = mupdf.Document.openDocument(pdfBuffer, 'application/pdf')
  const page = doc.loadPage(pageNum)

  // Render at 150 DPI
  const scale = 150 / 72
  const pixmap = page.toPixmap([scale, 0, 0, scale, 0, 0], mupdf.ColorSpace.DeviceGray)
  const pngBuffer = Buffer.from(pixmap.asPNG())

  // Save the raw page
  writeFileSync(join(OUTPUT_DIR, `page-${pageNum + 1}-qr-test.png`), pngBuffer)

  const metadata = await sharp(pngBuffer).metadata()
  const width = metadata.width!
  const height = metadata.height!
  console.log(`Image: ${width}x${height}`)

  // Try QR reading at different scales
  console.log('\n=== Testing QR reading at various scales ===\n')

  // 1. Original size
  console.log('1. Original size (1x):')
  const { data: data1x, info: info1x } = await sharp(pngBuffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const result1x = await tryDecodeQR(data1x, info1x.width, info1x.height)
  console.log(`   Result: ${result1x || 'NOT FOUND'}\n`)

  // 2. 2x scaled
  console.log('2. 2x scaled:')
  const { data: data2x, info: info2x } = await sharp(pngBuffer)
    .resize({ width: width * 2 })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const result2x = await tryDecodeQR(data2x, info2x.width, info2x.height)
  console.log(`   Result: ${result2x || 'NOT FOUND'}\n`)

  // 3. With contrast normalization
  console.log('3. With contrast normalization:')
  const { data: dataNorm, info: infoNorm } = await sharp(pngBuffer)
    .resize({ width: width * 2 })
    .normalize()
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const resultNorm = await tryDecodeQR(dataNorm, infoNorm.width, infoNorm.height)
  console.log(`   Result: ${resultNorm || 'NOT FOUND'}\n`)

  // 4. Try rotating 180 degrees (in case upside down)
  console.log('4. Rotated 180°:')
  const { data: dataRot, info: infoRot } = await sharp(pngBuffer)
    .rotate(180)
    .resize({ width: width * 2 })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const resultRot = await tryDecodeQR(dataRot, infoRot.width, infoRot.height)
  console.log(`   Result: ${resultRot || 'NOT FOUND'}\n`)

  // Summary
  const anyFound = result1x || result2x || resultNorm || resultRot
  console.log('=== Summary ===')
  if (anyFound) {
    console.log(`QR code found: ${anyFound}`)
  } else {
    console.log('QR code NOT FOUND in any configuration')
    console.log('This page should be flagged as unidentified_scantron')
  }
}

main().catch(console.error)
