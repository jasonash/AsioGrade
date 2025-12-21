/**
 * Registration Mark Detection Service
 *
 * Detects corner registration marks on scanned scantron pages to compute
 * page alignment transformation. This enables reliable bubble detection
 * regardless of scan rotation, skew, scale, or margin shifts.
 *
 * The service uses a simplified approach:
 * 1. Search for dark blobs in each corner region of the image
 * 2. Accept any significant dark blob as a registration mark
 * 3. Use the 4 detected positions to compute homography
 *
 * This is more robust than shape classification because it handles:
 * - Different scan resolutions
 * - Partial mark visibility
 * - Noise and artifacts
 */

import { cv } from 'opencv-wasm'
import sharp from 'sharp'

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


class RegistrationService {
  /**
   * Detect registration marks and compute page alignment transformation
   *
   * This uses a simplified approach:
   * 1. Search each corner region (25% of image) for dark blobs
   * 2. Find the largest/darkest blob in each corner
   * 3. Use these 4 points to compute homography
   *
   * This is more robust than shape classification because registration marks
   * are the only significant dark content in the corner regions.
   */
  async detectRegistrationMarks(imageBuffer: Buffer): Promise<RegistrationResult> {
    // Get image metadata
    const metadata = await sharp(imageBuffer).metadata()
    const imageWidth = metadata.width || 1275
    const imageHeight = metadata.height || 1650

    // Target normalized dimensions (at 150 DPI - US Letter)
    const normalizedWidth = 1275
    const normalizedHeight = 1650

    // Load image as grayscale
    const { data, info } = await sharp(imageBuffer).grayscale().raw().toBuffer({ resolveWithObject: true })

    // Search each corner for a dark blob
    // Corner regions are the outer 20% of each edge
    const cornerSize = Math.min(imageWidth, imageHeight) * 0.2

    const topLeft = this.findDarkBlobInRegion(
      data,
      info.width,
      info.height,
      0,
      0,
      cornerSize,
      cornerSize
    )

    const topRight = this.findDarkBlobInRegion(
      data,
      info.width,
      info.height,
      imageWidth - cornerSize,
      0,
      cornerSize,
      cornerSize
    )

    const bottomLeft = this.findDarkBlobInRegion(
      data,
      info.width,
      info.height,
      0,
      imageHeight - cornerSize,
      cornerSize,
      cornerSize
    )

    const bottomRight = this.findDarkBlobInRegion(
      data,
      info.width,
      info.height,
      imageWidth - cornerSize,
      imageHeight - cornerSize,
      cornerSize,
      cornerSize
    )

    // Build corners object
    const corners = {
      topLeft: topLeft.found ? topLeft.position : null,
      topRight: topRight.found ? topRight.position : null,
      bottomLeft: bottomLeft.found ? bottomLeft.position : null,
      bottomRight: bottomRight.found ? bottomRight.position : null
    }

    // Count detected marks
    const detectedCount = [topLeft, topRight, bottomLeft, bottomRight].filter((r) => r.found).length

    // Determine orientation by comparing TR and BL darkness
    // When correct: TR (filled square) > BL (filled circle) in darkness
    // When upside down: BL > TR
    let isUpsideDown = false
    if (topRight.found && bottomLeft.found) {
      isUpsideDown = bottomLeft.darkness > topRight.darkness + 5
    }

    // Compute homography if we have at least 2 corners
    let transform: number[] | null = null
    let confidence = 0

    if (detectedCount >= 2) {
      // Estimate missing corners if needed
      const estimatedCorners = this.estimateMissingCorners(corners, imageWidth, imageHeight)

      // Compute homography from detected/estimated corners to normalized positions
      transform = this.computeHomographySimple(
        estimatedCorners,
        normalizedWidth,
        normalizedHeight
      )
      confidence = detectedCount / 4
    }

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
   * Find the most prominent dark blob in a region
   * Returns the centroid of the darkest cluster of pixels
   */
  private findDarkBlobInRegion(
    data: Buffer,
    width: number,
    height: number,
    regionX: number,
    regionY: number,
    regionWidth: number,
    regionHeight: number
  ): { found: boolean; position: CornerPosition | null; darkness: number } {
    // Calculate bounds
    const x1 = Math.max(0, Math.floor(regionX))
    const y1 = Math.max(0, Math.floor(regionY))
    const x2 = Math.min(width, Math.floor(regionX + regionWidth))
    const y2 = Math.min(height, Math.floor(regionY + regionHeight))

    // Find dark pixels (below threshold)
    const darkThreshold = 100
    const darkPixels: { x: number; y: number; value: number }[] = []

    for (let y = y1; y < y2; y++) {
      for (let x = x1; x < x2; x++) {
        const idx = y * width + x
        const value = data[idx]
        if (value < darkThreshold) {
          darkPixels.push({ x, y, value })
        }
      }
    }

    if (darkPixels.length < 50) {
      // Not enough dark pixels to be a registration mark
      return { found: false, position: null, darkness: 0 }
    }

    // Calculate centroid of dark pixels (weighted by darkness)
    let sumX = 0
    let sumY = 0
    let sumWeight = 0

    for (const pixel of darkPixels) {
      const weight = darkThreshold - pixel.value // Darker = higher weight
      sumX += pixel.x * weight
      sumY += pixel.y * weight
      sumWeight += weight
    }

    const centroidX = sumX / sumWeight
    const centroidY = sumY / sumWeight

    // Calculate average darkness
    const avgDarkness = (darkPixels.length / ((x2 - x1) * (y2 - y1))) * 100

    return {
      found: true,
      position: { x: centroidX, y: centroidY },
      darkness: avgDarkness
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
   * Compute homography matrix from detected corners to normalized positions
   * Uses the standard registration mark positions at 150 DPI
   */
  private computeHomographySimple(
    corners: {
      topLeft: CornerPosition | null
      topRight: CornerPosition | null
      bottomLeft: CornerPosition | null
      bottomRight: CornerPosition | null
    },
    normalizedWidth: number,
    normalizedHeight: number
  ): number[] | null {
    // Destination points (registration mark positions in normalized image at 150 DPI)
    // From pdf.service.ts: REG_MARK_OFFSET=25, REG_MARK_SIZE=20
    // At 150 DPI: offset = 25 * 150/72 ≈ 52, size = 20 * 150/72 ≈ 42
    // Mark centers: offset + size/2 = 52 + 21 = 73
    const dstMargin = 73
    const dstPoints = {
      topLeft: { x: dstMargin, y: dstMargin },
      topRight: { x: normalizedWidth - dstMargin, y: dstMargin },
      bottomLeft: { x: dstMargin, y: normalizedHeight - dstMargin },
      bottomRight: { x: normalizedWidth - dstMargin, y: normalizedHeight - dstMargin }
    }

    // Collect source and destination point pairs
    const srcPointArray: number[] = []
    const dstPointArray: number[] = []

    if (corners.topLeft) {
      srcPointArray.push(corners.topLeft.x, corners.topLeft.y)
      dstPointArray.push(dstPoints.topLeft.x, dstPoints.topLeft.y)
    }
    if (corners.topRight) {
      srcPointArray.push(corners.topRight.x, corners.topRight.y)
      dstPointArray.push(dstPoints.topRight.x, dstPoints.topRight.y)
    }
    if (corners.bottomLeft) {
      srcPointArray.push(corners.bottomLeft.x, corners.bottomLeft.y)
      dstPointArray.push(dstPoints.bottomLeft.x, dstPoints.bottomLeft.y)
    }
    if (corners.bottomRight) {
      srcPointArray.push(corners.bottomRight.x, corners.bottomRight.y)
      dstPointArray.push(dstPoints.bottomRight.x, dstPoints.bottomRight.y)
    }

    // Need at least 4 points for homography
    if (srcPointArray.length < 8) {
      console.log('[RegistrationService] Not enough points for homography:', srcPointArray.length / 2)
      return null
    }

    try {
      // Create point matrices
      const srcMat = cv.matFromArray(srcPointArray.length / 2, 1, cv.CV_32FC2, srcPointArray)
      const dstMat = cv.matFromArray(dstPointArray.length / 2, 1, cv.CV_32FC2, dstPointArray)

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

}

// Singleton instance
export const registrationService = new RegistrationService()
