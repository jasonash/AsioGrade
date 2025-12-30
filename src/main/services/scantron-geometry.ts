/**
 * Scantron Geometry Service
 *
 * Calculates exact bubble positions using registration marks.
 * All positions are derived as percentages from the PDF layout,
 * making detection work regardless of scan resolution, scale, or skew.
 */

// =============================================================================
// PDF LAYOUT CONSTANTS (from pdf.service.ts)
// =============================================================================

const PDF = {
  // Page dimensions at 72 DPI
  LETTER_WIDTH: 612,
  LETTER_HEIGHT: 792,

  // Registration marks
  REG_MARK_SIZE: 20,
  REG_MARK_OFFSET: 25,

  // Content layout
  MARGIN: 50,
  BUBBLE_RADIUS: 7,
  BUBBLE_SPACING: 22,
  ROW_HEIGHT: 24,
  QUESTION_NUM_WIDTH: 30,
  QUESTIONS_PER_COLUMN: 25,

  // Header section heights (from generateStudentPage)
  HEADER_HEIGHT: 96,  // title(20) + subtitle(15) + divider(15) + student(18) + date(18) + divider(10)
  QR_SECTION_HEIGHT: 100, // QR(80) + spacing(10) + offset(10)
  PRE_GRID_SPACING: 20
}

// =============================================================================
// DERIVED PERCENTAGES
// =============================================================================

// Registration mark centers define the coordinate system
// Top-left: (35, 35), Top-right: (577, 35), Bottom-left: (35, 757), Bottom-right: (577, 757)
const REG_MARK_CENTER_OFFSET = PDF.REG_MARK_OFFSET + PDF.REG_MARK_SIZE / 2 // = 35

const CONTENT_BOUNDS = {
  left: REG_MARK_CENTER_OFFSET,   // 35
  right: PDF.LETTER_WIDTH - REG_MARK_CENTER_OFFSET,  // 577
  top: REG_MARK_CENTER_OFFSET,    // 35
  bottom: PDF.LETTER_HEIGHT - REG_MARK_CENTER_OFFSET // 757
}

const CONTENT_WIDTH = CONTENT_BOUNDS.right - CONTENT_BOUNDS.left   // 542
const CONTENT_HEIGHT = CONTENT_BOUNDS.bottom - CONTENT_BOUNDS.top  // 722

// Bubble grid start position (absolute from page top)
const BUBBLE_GRID_Y_START = PDF.MARGIN + PDF.HEADER_HEIGHT + PDF.QR_SECTION_HEIGHT + PDF.PRE_GRID_SPACING // = 256

// Convert to percentages relative to registration mark bounds
export const GEOMETRY = {
  // Bubble grid Y start as percentage from top registration marks
  gridStartY: (BUBBLE_GRID_Y_START - CONTENT_BOUNDS.top) / CONTENT_HEIGHT, // ≈ 0.306

  // Row height as percentage
  rowHeight: PDF.ROW_HEIGHT / CONTENT_HEIGHT, // ≈ 0.033

  // First bubble X position (center of bubble A)
  // bubbleX = MARGIN + QUESTION_NUM_WIDTH + 5 + BUBBLE_RADIUS
  firstBubbleX: (PDF.MARGIN + PDF.QUESTION_NUM_WIDTH + 5 + PDF.BUBBLE_RADIUS - CONTENT_BOUNDS.left) / CONTENT_WIDTH, // ≈ 0.105

  // Bubble spacing as percentage
  bubbleSpacing: PDF.BUBBLE_SPACING / CONTENT_WIDTH, // ≈ 0.041

  // Bubble radius as percentage (for sampling region)
  bubbleRadius: PDF.BUBBLE_RADIUS / CONTENT_WIDTH, // ≈ 0.013

  // Column offset for multi-column layouts
  columnWidth: (PDF.LETTER_WIDTH - 2 * PDF.MARGIN) / 2 / CONTENT_WIDTH, // ≈ 0.47

  // Questions per column
  questionsPerColumn: PDF.QUESTIONS_PER_COLUMN
}

// =============================================================================
// TYPES
// =============================================================================

export interface Point {
  x: number
  y: number
}

export interface RegistrationMarks {
  topLeft: Point
  topRight: Point
  bottomLeft: Point
  bottomRight: Point
}

export interface BubblePosition {
  question: number
  choice: 'A' | 'B' | 'C' | 'D'
  x: number
  y: number
  radius: number
}

// =============================================================================
// GEOMETRY CALCULATIONS
// =============================================================================

/**
 * Calculate the pixel position for a point given as percentages
 * within the registration mark coordinate system.
 *
 * Uses bilinear interpolation to handle skewed/rotated scans.
 */
export function percentToPixel(
  marks: RegistrationMarks,
  percentX: number,
  percentY: number
): Point {
  // Bilinear interpolation across the quadrilateral defined by registration marks
  // Top edge interpolation
  const topX = marks.topLeft.x + (marks.topRight.x - marks.topLeft.x) * percentX
  const topY = marks.topLeft.y + (marks.topRight.y - marks.topLeft.y) * percentX

  // Bottom edge interpolation
  const bottomX = marks.bottomLeft.x + (marks.bottomRight.x - marks.bottomLeft.x) * percentX
  const bottomY = marks.bottomLeft.y + (marks.bottomRight.y - marks.bottomLeft.y) * percentX

  // Vertical interpolation
  return {
    x: topX + (bottomX - topX) * percentY,
    y: topY + (bottomY - topY) * percentY
  }
}

/**
 * Calculate the pixel size of the content area (distance between registration marks)
 */
export function getContentSize(marks: RegistrationMarks): { width: number; height: number } {
  // Average of top and bottom edges for width
  const topWidth = Math.sqrt(
    Math.pow(marks.topRight.x - marks.topLeft.x, 2) +
    Math.pow(marks.topRight.y - marks.topLeft.y, 2)
  )
  const bottomWidth = Math.sqrt(
    Math.pow(marks.bottomRight.x - marks.bottomLeft.x, 2) +
    Math.pow(marks.bottomRight.y - marks.bottomLeft.y, 2)
  )

  // Average of left and right edges for height
  const leftHeight = Math.sqrt(
    Math.pow(marks.bottomLeft.x - marks.topLeft.x, 2) +
    Math.pow(marks.bottomLeft.y - marks.topLeft.y, 2)
  )
  const rightHeight = Math.sqrt(
    Math.pow(marks.bottomRight.x - marks.topRight.x, 2) +
    Math.pow(marks.bottomRight.y - marks.topRight.y, 2)
  )

  return {
    width: (topWidth + bottomWidth) / 2,
    height: (leftHeight + rightHeight) / 2
  }
}

/**
 * Get all bubble positions for a given number of questions
 */
export function getBubblePositions(
  marks: RegistrationMarks,
  questionCount: number
): BubblePosition[] {
  const positions: BubblePosition[] = []
  const contentSize = getContentSize(marks)

  // Bubble radius in pixels (based on content size)
  const radiusPixels = GEOMETRY.bubbleRadius * contentSize.width

  const choices: ('A' | 'B' | 'C' | 'D')[] = ['A', 'B', 'C', 'D']

  for (let q = 0; q < questionCount; q++) {
    const column = Math.floor(q / GEOMETRY.questionsPerColumn)
    const rowInColumn = q % GEOMETRY.questionsPerColumn

    // Y position: grid start + row offset + half row height (center)
    const percentY = GEOMETRY.gridStartY + rowInColumn * GEOMETRY.rowHeight + GEOMETRY.rowHeight / 2

    for (let c = 0; c < 4; c++) {
      // X position: first bubble + column offset + bubble spacing
      const percentX = GEOMETRY.firstBubbleX + column * GEOMETRY.columnWidth + c * GEOMETRY.bubbleSpacing

      const pixel = percentToPixel(marks, percentX, percentY)

      positions.push({
        question: q + 1,
        choice: choices[c],
        x: pixel.x,
        y: pixel.y,
        radius: radiusPixels
      })
    }
  }

  return positions
}

/**
 * Get the position for a specific bubble
 */
export function getBubblePosition(
  marks: RegistrationMarks,
  question: number, // 1-indexed
  choice: 'A' | 'B' | 'C' | 'D'
): BubblePosition {
  const q = question - 1
  const c = choice.charCodeAt(0) - 65 // A=0, B=1, C=2, D=3

  const column = Math.floor(q / GEOMETRY.questionsPerColumn)
  const rowInColumn = q % GEOMETRY.questionsPerColumn

  const percentY = GEOMETRY.gridStartY + rowInColumn * GEOMETRY.rowHeight + GEOMETRY.rowHeight / 2
  const percentX = GEOMETRY.firstBubbleX + column * GEOMETRY.columnWidth + c * GEOMETRY.bubbleSpacing

  const pixel = percentToPixel(marks, percentX, percentY)
  const contentSize = getContentSize(marks)

  return {
    question,
    choice,
    x: pixel.x,
    y: pixel.y,
    radius: GEOMETRY.bubbleRadius * contentSize.width
  }
}

// Log the derived percentages for verification
console.log('[ScantronGeometry] Derived percentages:')
console.log(`  Grid start Y: ${(GEOMETRY.gridStartY * 100).toFixed(1)}%`)
console.log(`  Row height: ${(GEOMETRY.rowHeight * 100).toFixed(2)}%`)
console.log(`  First bubble X: ${(GEOMETRY.firstBubbleX * 100).toFixed(1)}%`)
console.log(`  Bubble spacing: ${(GEOMETRY.bubbleSpacing * 100).toFixed(2)}%`)
