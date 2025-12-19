/**
 * Bubble Detection Prototype
 *
 * This prototype validates that we can reliably detect filled bubbles
 * on scanned scantron-style answer sheets.
 *
 * Success Criteria (from PROJECT_STATUS.md):
 * - 95%+ bubble detection accuracy on clean scans
 * - 90%+ accuracy on lower-quality scans
 * - < 2 seconds processing time per page
 */

import { cv } from 'opencv-wasm'
import sharp from 'sharp'
import * as fs from 'fs'
import * as path from 'path'

interface BubbleLocation {
  row: number
  col: number
  x: number
  y: number
  radius: number
  isFilled: boolean
  fillPercentage: number
}

interface DetectionResult {
  totalBubbles: number
  filledBubbles: number
  emptyBubbles: number
  bubbles: BubbleLocation[]
  processingTimeMs: number
  imageWidth: number
  imageHeight: number
}

interface GroundTruth {
  row: number
  col: number
  isFilled: boolean
}

function initOpenCV(): void {
  // opencv-wasm is ready to use immediately
  console.log('OpenCV.js loaded successfully')
}

async function loadImage(
  imagePath: string
): Promise<{ mat: unknown; width: number; height: number }> {
  const imageBuffer = await sharp(imagePath)
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const { data, info } = imageBuffer
  const mat = new cv.Mat(info.height, info.width, cv.CV_8UC1)
  mat.data.set(data)
  return { mat, width: info.width, height: info.height }
}

function detectBubbles(
  grayMat: unknown,
  options: {
    minRadius?: number
    maxRadius?: number
    fillThreshold?: number
    dp?: number
    minDist?: number
    param1?: number
    param2?: number
  } = {}
): BubbleLocation[] {
  const {
    minRadius = 10,
    maxRadius = 30,
    fillThreshold = 0.4,
    dp = 1,
    minDist = 20,
    param1 = 50,
    param2 = 30
  } = options

  const mat = grayMat as { cols: number; rows: number; data: Uint8Array; ucharPtr: (y: number, x: number) => number[] }

  // Apply Gaussian blur to reduce noise
  const blurred = new cv.Mat()
  cv.GaussianBlur(grayMat, blurred, new cv.Size(5, 5), 0)

  // Detect circles using Hough Circle Transform
  const circles = new cv.Mat()
  cv.HoughCircles(
    blurred,
    circles,
    cv.HOUGH_GRADIENT,
    dp,
    minDist,
    param1,
    param2,
    minRadius,
    maxRadius
  )

  const bubbles: BubbleLocation[] = []

  // Process each detected circle
  for (let i = 0; i < circles.cols; i++) {
    const x = Math.round(circles.data32F[i * 3])
    const y = Math.round(circles.data32F[i * 3 + 1])
    const radius = Math.round(circles.data32F[i * 3 + 2])

    // Calculate fill percentage
    const fillPercentage = calculateFillPercentage(mat, x, y, radius)
    const isFilled = fillPercentage >= fillThreshold

    bubbles.push({
      row: -1,
      col: -1,
      x,
      y,
      radius,
      isFilled,
      fillPercentage
    })
  }

  // Sort bubbles by position (top to bottom, left to right)
  bubbles.sort((a, b) => {
    const rowDiff = Math.floor(a.y / 50) - Math.floor(b.y / 50)
    if (rowDiff !== 0) return rowDiff
    return a.x - b.x
  })

  // Assign row/col indices based on sorted position
  let currentRow = 0
  let lastY = bubbles[0]?.y ?? 0
  let colInRow = 0

  for (const bubble of bubbles) {
    if (Math.abs(bubble.y - lastY) > 30) {
      currentRow++
      colInRow = 0
      lastY = bubble.y
    }
    bubble.row = currentRow
    bubble.col = colInRow++
  }

  blurred.delete()
  circles.delete()

  return bubbles
}

function calculateFillPercentage(
  mat: { cols: number; rows: number; ucharPtr: (y: number, x: number) => number[] },
  centerX: number,
  centerY: number,
  radius: number
): number {
  let darkPixels = 0
  let totalPixels = 0

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

async function processImage(imagePath: string): Promise<DetectionResult> {
  const startTime = performance.now()

  initOpenCV()

  const { mat: grayMat, width, height } = await loadImage(imagePath)
  const bubbles = detectBubbles(grayMat)

  const processingTimeMs = performance.now() - startTime

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(grayMat as any).delete()

  return {
    totalBubbles: bubbles.length,
    filledBubbles: bubbles.filter((b) => b.isFilled).length,
    emptyBubbles: bubbles.filter((b) => !b.isFilled).length,
    bubbles,
    processingTimeMs,
    imageWidth: width,
    imageHeight: height
  }
}

function calculateAccuracy(
  detected: BubbleLocation[],
  groundTruth: GroundTruth[]
): { accuracy: number; falsePositives: number; falseNegatives: number } {
  let correct = 0
  let falsePositives = 0
  let falseNegatives = 0

  for (const truth of groundTruth) {
    const match = detected.find(
      (d) => d.row === truth.row && d.col === truth.col
    )
    if (match) {
      if (match.isFilled === truth.isFilled) {
        correct++
      } else if (match.isFilled && !truth.isFilled) {
        falsePositives++
      } else {
        falseNegatives++
      }
    } else {
      if (truth.isFilled) {
        falseNegatives++
      }
    }
  }

  return {
    accuracy: groundTruth.length > 0 ? correct / groundTruth.length : 0,
    falsePositives,
    falseNegatives
  }
}

async function createSampleImage(outputDir: string): Promise<void> {
  fs.mkdirSync(outputDir, { recursive: true })

  const width = 400
  const height = 300
  const bubbleRadius = 15
  const spacing = 50

  const filledPositions = [
    [0, 1],
    [1, 0],
    [2, 2],
    [3, 3],
    [4, 1]
  ]

  // Create clean image
  await createBubbleSheet(
    outputDir,
    'sample-clean',
    width,
    height,
    bubbleRadius,
    spacing,
    filledPositions,
    { noise: false }
  )

  // Create noisy image (simulating lower quality scan)
  await createBubbleSheet(
    outputDir,
    'sample-noisy',
    width,
    height,
    bubbleRadius,
    spacing,
    filledPositions,
    { noise: true }
  )
}

async function createBubbleSheet(
  outputDir: string,
  name: string,
  width: number,
  height: number,
  bubbleRadius: number,
  spacing: number,
  filledPositions: number[][],
  options: { noise: boolean }
): Promise<void> {
  const svgBubbles: string[] = []
  const groundTruth: GroundTruth[] = []

  // Add noise pattern if requested
  let noiseElements = ''
  if (options.noise) {
    // Add some gray speckles to simulate scan artifacts
    for (let i = 0; i < 50; i++) {
      const nx = Math.floor(Math.random() * width)
      const ny = Math.floor(Math.random() * height)
      const size = 1 + Math.random() * 3
      const gray = 180 + Math.floor(Math.random() * 50)
      noiseElements += `<circle cx="${nx}" cy="${ny}" r="${size}" fill="rgb(${gray},${gray},${gray})"/>`
    }
  }

  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 4; col++) {
      const x = 50 + col * spacing
      const y = 50 + row * spacing
      const isFilled = filledPositions.some(([r, c]) => r === row && c === col)

      groundTruth.push({ row, col, isFilled })

      if (isFilled) {
        // Filled bubbles - slightly varied fill for realism
        const fillColor = options.noise ? '#444' : '#333'
        svgBubbles.push(
          `<circle cx="${x}" cy="${y}" r="${bubbleRadius}" fill="${fillColor}" stroke="#000" stroke-width="1"/>`
        )
      } else {
        // Empty bubbles
        const fillColor = options.noise ? '#f5f5f5' : 'white'
        svgBubbles.push(
          `<circle cx="${x}" cy="${y}" r="${bubbleRadius}" fill="${fillColor}" stroke="#000" stroke-width="1"/>`
        )
      }
    }
  }

  const bgColor = options.noise ? '#f8f8f8' : 'white'
  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="${bgColor}"/>
      ${noiseElements}
      ${svgBubbles.join('\n      ')}
    </svg>
  `

  const outputPath = path.join(outputDir, `${name}.png`)
  await sharp(Buffer.from(svg)).png().toFile(outputPath)

  const groundTruthPath = path.join(outputDir, `${name}.json`)
  fs.writeFileSync(groundTruthPath, JSON.stringify(groundTruth, null, 2))

  console.log(`Created sample image: ${outputPath}`)
  console.log(`Created ground truth: ${groundTruthPath}`)
}

async function runPrototype(): Promise<void> {
  console.log('='.repeat(60))
  console.log('BUBBLE DETECTION PROTOTYPE')
  console.log('='.repeat(60))
  console.log()

  const testImagesDir = path.join(__dirname, 'test-images')

  if (!fs.existsSync(testImagesDir)) {
    console.log('No test images found. Creating sample test image...')
    await createSampleImage(testImagesDir)
    console.log()
  }

  const imageFiles = fs
    .readdirSync(testImagesDir)
    .filter((f) =>
      ['.png', '.jpg', '.jpeg'].includes(path.extname(f).toLowerCase())
    )

  if (imageFiles.length === 0) {
    console.log('No image files found in test-images directory')
    return
  }

  console.log(`Found ${imageFiles.length} test image(s)`)
  console.log()

  for (const imageFile of imageFiles) {
    const imagePath = path.join(testImagesDir, imageFile)
    console.log(`Processing: ${imageFile}`)
    console.log('-'.repeat(40))

    try {
      const result = await processImage(imagePath)

      console.log(`  Image size: ${result.imageWidth}x${result.imageHeight}`)
      console.log(`  Total bubbles detected: ${result.totalBubbles}`)
      console.log(`  Filled bubbles: ${result.filledBubbles}`)
      console.log(`  Empty bubbles: ${result.emptyBubbles}`)
      console.log(`  Processing time: ${result.processingTimeMs.toFixed(2)}ms`)

      const timePassed = result.processingTimeMs < 2000
      console.log()
      console.log(`  Time criterion (< 2s): ${timePassed ? 'PASS' : 'FAIL'}`)

      const groundTruthPath = imagePath.replace(/\.(png|jpg|jpeg)$/i, '.json')
      if (fs.existsSync(groundTruthPath)) {
        const groundTruth: GroundTruth[] = JSON.parse(
          fs.readFileSync(groundTruthPath, 'utf-8')
        )
        const { accuracy, falsePositives, falseNegatives } = calculateAccuracy(
          result.bubbles,
          groundTruth
        )
        console.log(`  Accuracy: ${(accuracy * 100).toFixed(1)}%`)
        console.log(`  False positives: ${falsePositives}`)
        console.log(`  False negatives: ${falseNegatives}`)

        const accuracyPassed = accuracy >= 0.95
        console.log(
          `  Accuracy criterion (>= 95%): ${accuracyPassed ? 'PASS' : 'FAIL'}`
        )
      }

      console.log()
    } catch (error) {
      console.error(`  Error processing ${imageFile}:`, error)
      console.log()
    }
  }

  console.log('='.repeat(60))
  console.log('PROTOTYPE COMPLETE')
  console.log('='.repeat(60))
}

runPrototype().catch(console.error)
