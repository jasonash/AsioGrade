/**
 * Registration Mark Detection Service
 *
 * Detects corner registration marks on scanned scantron pages to compute
 * page alignment transformation. This enables reliable bubble detection
 * regardless of scan rotation, skew, or margin shifts.
 *
 * Registration mark types:
 * - Top-left: L-shape (normal orientation indicator)
 * - Top-right: Filled square
 * - Bottom-left: Filled circle
 * - Bottom-right: L-shape (inverted)
 */

import { cv } from 'opencv-wasm'
import sharp from 'sharp'

// Expected positions of registration marks at 72 DPI (PDF coordinates)
// These are from pdf.service.ts: REG_MARK_SIZE = 20, REG_MARK_OFFSET = 25
const PDF_LAYOUT = {
  LETTER_WIDTH: 612,
  LETTER_HEIGHT: 792,
  REG_MARK_SIZE: 20,
  REG_MARK_OFFSET: 25
}

// Derived mark center positions at 72 DPI
const EXPECTED_MARKS_72DPI = {
  topLeft: { x: 35, y: 35 }, // offset + size/2
  topRight: { x: 577, y: 35 }, // width - offset - size/2
  bottomLeft: { x: 35, y: 757 }, // offset + size/2, height - offset - size/2
  bottomRight: { x: 577, y: 757 } // width - offset - size/2
}

export interface CornerPosition {
  x: number
  y: number
}

export interface RegistrationResult {
  found: boolean
  confidence: number // 0-1, how confident we found all marks
  transform: number[] | null // 3x3 homography matrix (9 elements, row-major)
  isUpsideDown: boolean
  corners: {
    topLeft: CornerPosition | null
    topRight: CornerPosition | null
    bottomLeft: CornerPosition | null
    bottomRight: CornerPosition | null
  }
  detectedCount: number
  normalizedWidth: number
  normalizedHeight: number
}

export interface MarkDetectionResult {
  found: boolean
  position: CornerPosition | null
  confidence: number
  markType: 'L-shape' | 'square' | 'circle' | 'L-inverted'
}

class RegistrationService {
  /**
   * Detect registration marks and compute page alignment transformation
   */
  async detectRegistrationMarks(imageBuffer: Buffer): Promise<RegistrationResult> {
    // Get image metadata for DPI scaling
    const metadata = await sharp(imageBuffer).metadata()
    const imageWidth = metadata.width || 1275
    const imageHeight = metadata.height || 1650

    // Calculate DPI scale (assuming original is 72 DPI)
    const dpiScale = imageWidth / PDF_LAYOUT.LETTER_WIDTH

    // Scale expected positions to image DPI
    const expectedPositions = {
      topLeft: this.scalePosition(EXPECTED_MARKS_72DPI.topLeft, dpiScale),
      topRight: this.scalePosition(EXPECTED_MARKS_72DPI.topRight, dpiScale),
      bottomLeft: this.scalePosition(EXPECTED_MARKS_72DPI.bottomLeft, dpiScale),
      bottomRight: this.scalePosition(EXPECTED_MARKS_72DPI.bottomRight, dpiScale)
    }

    // Target normalized dimensions (at 150 DPI)
    const targetScale = 150 / 72
    const normalizedWidth = Math.floor(PDF_LAYOUT.LETTER_WIDTH * targetScale)
    const normalizedHeight = Math.floor(PDF_LAYOUT.LETTER_HEIGHT * targetScale)

    // Load image as grayscale
    const { data, info } = await sharp(imageBuffer).grayscale().raw().toBuffer({ resolveWithObject: true })

    // Convert to OpenCV Mat
    const mat = new cv.Mat(info.height, info.width, cv.CV_8UC1)
    mat.data.set(new Uint8Array(data))

    // Apply threshold to get binary image
    const binary = new cv.Mat()
    cv.threshold(mat, binary, 127, 255, cv.THRESH_BINARY_INV)

    // Detect each corner mark
    const searchRadius = Math.floor(50 * dpiScale) // Search within 50pt radius at PDF scale

    const topLeftResult = this.detectCornerMark(
      binary,
      expectedPositions.topLeft,
      searchRadius,
      'L-shape',
      dpiScale
    )

    const topRightResult = this.detectCornerMark(
      binary,
      expectedPositions.topRight,
      searchRadius,
      'square',
      dpiScale
    )

    const bottomLeftResult = this.detectCornerMark(
      binary,
      expectedPositions.bottomLeft,
      searchRadius,
      'circle',
      dpiScale
    )

    const bottomRightResult = this.detectCornerMark(
      binary,
      expectedPositions.bottomRight,
      searchRadius,
      'L-inverted',
      dpiScale
    )

    // Count detected marks
    const detectedMarks = [topLeftResult, topRightResult, bottomLeftResult, bottomRightResult].filter(
      (r) => r.found
    )
    const detectedCount = detectedMarks.length

    // Determine if page is upside down by checking mark types at positions
    // If top-right has circle and bottom-left has square, page is upside down
    const isUpsideDown = this.checkOrientation(
      topLeftResult,
      topRightResult,
      bottomLeftResult,
      bottomRightResult
    )

    // Build corners object
    const corners = {
      topLeft: topLeftResult.position,
      topRight: topRightResult.position,
      bottomLeft: bottomLeftResult.position,
      bottomRight: bottomRightResult.position
    }

    // Compute homography if we have enough marks
    let transform: number[] | null = null
    let confidence = 0

    if (detectedCount >= 3) {
      transform = this.computeHomography(
        corners,
        expectedPositions,
        normalizedWidth,
        normalizedHeight,
        dpiScale
      )
      confidence = detectedCount / 4
    } else if (detectedCount === 2) {
      // Try to estimate missing corners from page dimensions
      const estimatedCorners = this.estimateMissingCorners(corners, imageWidth, imageHeight)
      transform = this.computeHomography(
        estimatedCorners,
        expectedPositions,
        normalizedWidth,
        normalizedHeight,
        dpiScale
      )
      confidence = 0.5 // Lower confidence with estimated corners
    }

    // Clean up
    mat.delete()
    binary.delete()

    return {
      found: detectedCount >= 2,
      confidence,
      transform,
      isUpsideDown,
      corners,
      detectedCount,
      normalizedWidth,
      normalizedHeight
    }
  }

  /**
   * Apply transformation to normalize a page image
   */
  async normalizePageImage(
    imageBuffer: Buffer,
    registration: RegistrationResult
  ): Promise<Buffer | null> {
    if (!registration.transform) {
      return null
    }

    // Load image
    const { data, info } = await sharp(imageBuffer).grayscale().raw().toBuffer({ resolveWithObject: true })

    const srcMat = new cv.Mat(info.height, info.width, cv.CV_8UC1)
    srcMat.data.set(new Uint8Array(data))

    // Create transformation matrix from flat array
    const transformMat = cv.matFromArray(3, 3, cv.CV_64FC1, registration.transform)

    // Apply perspective transform
    const dstMat = new cv.Mat()
    const dsize = new cv.Size(registration.normalizedWidth, registration.normalizedHeight)
    cv.warpPerspective(srcMat, dstMat, transformMat, dsize)

    // Convert back to buffer
    const normalizedData = new Uint8Array(dstMat.data)
    const normalizedBuffer = await sharp(normalizedData, {
      raw: {
        width: registration.normalizedWidth,
        height: registration.normalizedHeight,
        channels: 1
      }
    })
      .png()
      .toBuffer()

    // Clean up
    srcMat.delete()
    transformMat.delete()
    dstMat.delete()

    return normalizedBuffer
  }

  /**
   * Scale a position from 72 DPI to target DPI
   */
  private scalePosition(pos: CornerPosition, scale: number): CornerPosition {
    return {
      x: Math.floor(pos.x * scale),
      y: Math.floor(pos.y * scale)
    }
  }

  /**
   * Detect a corner mark using contour analysis
   */
  private detectCornerMark(
    binary: ReturnType<typeof cv.Mat>,
    expectedPos: CornerPosition,
    searchRadius: number,
    markType: 'L-shape' | 'square' | 'circle' | 'L-inverted',
    dpiScale: number
  ): MarkDetectionResult {
    // Define search region
    const x1 = Math.max(0, expectedPos.x - searchRadius)
    const y1 = Math.max(0, expectedPos.y - searchRadius)
    const x2 = Math.min(binary.cols, expectedPos.x + searchRadius)
    const y2 = Math.min(binary.rows, expectedPos.y + searchRadius)

    // Extract ROI
    const roi = binary.roi(new cv.Rect(x1, y1, x2 - x1, y2 - y1))

    // Find contours in ROI
    const contours = new cv.MatVector()
    const hierarchy = new cv.Mat()
    cv.findContours(roi, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE)

    // Expected mark size at this DPI
    const expectedSize = PDF_LAYOUT.REG_MARK_SIZE * dpiScale
    const minArea = (expectedSize * 0.5) ** 2
    const maxArea = (expectedSize * 2) ** 2

    let bestMatch: MarkDetectionResult = {
      found: false,
      position: null,
      confidence: 0,
      markType
    }

    // Analyze each contour
    for (let i = 0; i < contours.size(); i++) {
      const contour = contours.get(i)
      const area = cv.contourArea(contour)

      // Skip too small or too large contours
      if (area < minArea || area > maxArea) {
        continue
      }

      // Get bounding rect
      const rect = cv.boundingRect(contour)

      // Calculate contour center in image coordinates
      const centerX = x1 + rect.x + rect.width / 2
      const centerY = y1 + rect.y + rect.height / 2

      // Check if this matches the expected mark type
      const confidence = this.classifyMark(contour, rect, markType, expectedSize)

      if (confidence > bestMatch.confidence) {
        bestMatch = {
          found: true,
          position: { x: centerX, y: centerY },
          confidence,
          markType
        }
      }
    }

    // Clean up
    roi.delete()
    contours.delete()
    hierarchy.delete()

    return bestMatch
  }

  /**
   * Classify a contour to determine if it matches expected mark type
   */
  private classifyMark(
    contour: ReturnType<typeof cv.Mat>,
    rect: { x: number; y: number; width: number; height: number },
    expectedType: 'L-shape' | 'square' | 'circle' | 'L-inverted',
    expectedSize: number
  ): number {
    const area = cv.contourArea(contour)
    const perimeter = cv.arcLength(contour, true)
    const aspectRatio = rect.width / rect.height

    // Circularity: 4π × area / perimeter²
    // Perfect circle = 1, square ≈ 0.785, L-shape < 0.5
    const circularity = perimeter > 0 ? (4 * Math.PI * area) / (perimeter * perimeter) : 0

    // Solidity: area / convex hull area
    const hull = new cv.Mat()
    cv.convexHull(contour, hull)
    const hullArea = cv.contourArea(hull)
    const solidity = hullArea > 0 ? area / hullArea : 0
    hull.delete()

    // Size match (how close to expected size)
    const sizeMatch = 1 - Math.abs(Math.sqrt(area) - expectedSize) / expectedSize

    let confidence = 0

    switch (expectedType) {
      case 'circle':
        // Circle: high circularity, aspect ratio ≈ 1, high solidity
        if (circularity > 0.7 && aspectRatio > 0.8 && aspectRatio < 1.2 && solidity > 0.9) {
          confidence = circularity * sizeMatch
        }
        break

      case 'square':
        // Square: medium circularity, aspect ratio ≈ 1, high solidity
        if (circularity > 0.6 && circularity < 0.9 && aspectRatio > 0.8 && aspectRatio < 1.2 && solidity > 0.9) {
          confidence = (1 - Math.abs(circularity - 0.785)) * sizeMatch
        }
        break

      case 'L-shape':
      case 'L-inverted':
        // L-shape: low circularity, lower solidity (concave shape)
        if (circularity < 0.6 && solidity < 0.8) {
          confidence = (1 - circularity) * (1 - solidity) * sizeMatch
        }
        break
    }

    return Math.max(0, Math.min(1, confidence))
  }

  /**
   * Check if page is upside down based on detected mark types
   */
  private checkOrientation(
    _topLeft: MarkDetectionResult,
    _topRight: MarkDetectionResult,
    _bottomLeft: MarkDetectionResult,
    _bottomRight: MarkDetectionResult
  ): boolean {
    // If top-right position has a circle instead of square, page is likely upside down
    // This is a simplified check - in practice we'd want more sophisticated detection

    // For now, assume correct orientation
    // TODO: Implement more robust orientation detection
    return false
  }

  /**
   * Estimate missing corner positions from known corners and page dimensions
   */
  private estimateMissingCorners(
    corners: {
      topLeft: CornerPosition | null
      topRight: CornerPosition | null
      bottomLeft: CornerPosition | null
      bottomRight: CornerPosition | null
    },
    _pageWidth: number,
    pageHeight: number
  ): typeof corners {
    const result = { ...corners }

    // Count known corners
    const known: { pos: CornerPosition; type: keyof typeof corners }[] = []
    if (corners.topLeft) known.push({ pos: corners.topLeft, type: 'topLeft' })
    if (corners.topRight) known.push({ pos: corners.topRight, type: 'topRight' })
    if (corners.bottomLeft) known.push({ pos: corners.bottomLeft, type: 'bottomLeft' })
    if (corners.bottomRight) known.push({ pos: corners.bottomRight, type: 'bottomRight' })

    if (known.length < 2) return result

    // If we have opposite corners, we can estimate the other two
    if (corners.topLeft && corners.bottomRight) {
      if (!corners.topRight) {
        result.topRight = { x: corners.bottomRight.x, y: corners.topLeft.y }
      }
      if (!corners.bottomLeft) {
        result.bottomLeft = { x: corners.topLeft.x, y: corners.bottomRight.y }
      }
    } else if (corners.topRight && corners.bottomLeft) {
      if (!corners.topLeft) {
        result.topLeft = { x: corners.bottomLeft.x, y: corners.topRight.y }
      }
      if (!corners.bottomRight) {
        result.bottomRight = { x: corners.topRight.x, y: corners.bottomLeft.y }
      }
    }

    // If we have adjacent corners on same edge, estimate others from page dimensions
    if (corners.topLeft && corners.topRight && !corners.bottomLeft && !corners.bottomRight) {
      const topHeight = (corners.topLeft.y + corners.topRight.y) / 2
      const bottomY = pageHeight - topHeight
      result.bottomLeft = { x: corners.topLeft.x, y: bottomY }
      result.bottomRight = { x: corners.topRight.x, y: bottomY }
    }

    // Similar logic for other edge pairs...

    return result
  }

  /**
   * Compute homography matrix to transform detected corners to normalized positions
   */
  private computeHomography(
    detectedCorners: {
      topLeft: CornerPosition | null
      topRight: CornerPosition | null
      bottomLeft: CornerPosition | null
      bottomRight: CornerPosition | null
    },
    expectedPositions: {
      topLeft: CornerPosition
      topRight: CornerPosition
      bottomLeft: CornerPosition
      bottomRight: CornerPosition
    },
    _normalizedWidth: number,
    _normalizedHeight: number,
    dpiScale: number
  ): number[] | null {
    // Collect source and destination points
    const srcPoints: number[] = []
    const dstPoints: number[] = []

    // Target positions at normalized scale (150 DPI)
    const targetScale = (150 / 72) / dpiScale

    if (detectedCorners.topLeft) {
      srcPoints.push(detectedCorners.topLeft.x, detectedCorners.topLeft.y)
      dstPoints.push(expectedPositions.topLeft.x * targetScale, expectedPositions.topLeft.y * targetScale)
    }
    if (detectedCorners.topRight) {
      srcPoints.push(detectedCorners.topRight.x, detectedCorners.topRight.y)
      dstPoints.push(expectedPositions.topRight.x * targetScale, expectedPositions.topRight.y * targetScale)
    }
    if (detectedCorners.bottomLeft) {
      srcPoints.push(detectedCorners.bottomLeft.x, detectedCorners.bottomLeft.y)
      dstPoints.push(expectedPositions.bottomLeft.x * targetScale, expectedPositions.bottomLeft.y * targetScale)
    }
    if (detectedCorners.bottomRight) {
      srcPoints.push(detectedCorners.bottomRight.x, detectedCorners.bottomRight.y)
      dstPoints.push(expectedPositions.bottomRight.x * targetScale, expectedPositions.bottomRight.y * targetScale)
    }

    // Need at least 4 points for homography
    if (srcPoints.length < 8) {
      // Only have 3 corners, add a 4th estimated point
      // For now, return null - we'll handle this case separately
      return null
    }

    try {
      // Create point matrices
      const srcMat = cv.matFromArray(srcPoints.length / 2, 1, cv.CV_32FC2, srcPoints)
      const dstMat = cv.matFromArray(dstPoints.length / 2, 1, cv.CV_32FC2, dstPoints)

      // Compute homography
      const H = cv.findHomography(srcMat, dstMat, cv.RANSAC)

      // Extract transform as array
      const transform: number[] = []
      for (let i = 0; i < 9; i++) {
        transform.push(H.data64F[i])
      }

      // Clean up
      srcMat.delete()
      dstMat.delete()
      H.delete()

      return transform
    } catch (error) {
      console.error('[RegistrationService] Failed to compute homography:', error)
      return null
    }
  }
}

// Singleton instance
export const registrationService = new RegistrationService()
