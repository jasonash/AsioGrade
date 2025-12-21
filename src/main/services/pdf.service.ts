/**
 * PDF Service for scantron generation
 *
 * Generates printable scantron answer sheets with QR codes for student identification.
 */

import PDFDocument from 'pdfkit'
import QRCode from 'qrcode'
import type {
  ScantronGenerationResult,
  ScantronQRData,
  ScantronStudentInfo,
  ScantronOptions
} from '../../shared/types'

// US Letter dimensions in points (72 dpi)
const LETTER_WIDTH = 612
const LETTER_HEIGHT = 792

// A4 dimensions in points
const A4_WIDTH = 595
const A4_HEIGHT = 842

// Layout constants
const MARGIN = 50
const BUBBLE_RADIUS = 7
const BUBBLE_SPACING = 22
const ROW_HEIGHT = 24
const CHOICE_LABELS = ['A', 'B', 'C', 'D']
const QUESTIONS_PER_COLUMN = 25

// Registration mark constants
const REG_MARK_SIZE = 20  // Size of registration marks
const REG_MARK_OFFSET = 25 // Distance from page edge

class PDFService {
  /**
   * Generate scantron PDF for an assignment
   */
  async generateScantronPDF(
    students: ScantronStudentInfo[],
    assignmentId: string,
    _sectionId: string, // Kept for API compatibility but not stored in QR (looked up from assignment)
    _unitId: string, // Kept for API compatibility but not stored in QR (looked up from assignment)
    questionCount: number,
    options: ScantronOptions
  ): Promise<ScantronGenerationResult> {
    try {
      const { width, height } = this.getPageDimensions(options.paperSize)
      const dateStr = new Date().toISOString().split('T')[0]

      // Create PDF document
      const doc = new PDFDocument({
        size: options.paperSize === 'letter' ? 'LETTER' : 'A4',
        margin: MARGIN,
        bufferPages: true
      })

      // Collect PDF data in a buffer
      const chunks: Buffer[] = []
      doc.on('data', (chunk: Buffer) => chunks.push(chunk))

      // Sort students alphabetically by last name, first name
      const sortedStudents = [...students].sort((a, b) =>
        `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`)
      )

      // Generate a page for each student
      for (let i = 0; i < sortedStudents.length; i++) {
        const student = sortedStudents[i]

        // Add new page for students after the first
        if (i > 0) {
          doc.addPage()
        }

        // Build QR data for this student
        // SIMPLIFIED: Only essential IDs - everything else looked up from assignment
        const qrData: ScantronQRData = {
          v: 1,
          aid: assignmentId,
          sid: student.studentId
        }

        // Generate the page
        await this.generateStudentPage(doc, student, qrData, questionCount, options, width, height, dateStr)
      }

      // Finalize PDF
      doc.end()

      // Wait for the PDF to be fully written
      const pdfBuffer = await new Promise<Buffer>((resolve) => {
        doc.on('end', () => {
          resolve(Buffer.concat(chunks))
        })
      })

      return {
        success: true,
        pdfBuffer,
        studentCount: students.length,
        pageCount: students.length,
        generatedAt: new Date().toISOString()
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to generate scantron PDF'
      return {
        success: false,
        studentCount: 0,
        pageCount: 0,
        generatedAt: new Date().toISOString(),
        error: message
      }
    }
  }

  /**
   * Get page dimensions based on paper size
   */
  private getPageDimensions(paperSize: 'letter' | 'a4'): { width: number; height: number } {
    if (paperSize === 'a4') {
      return { width: A4_WIDTH, height: A4_HEIGHT }
    }
    return { width: LETTER_WIDTH, height: LETTER_HEIGHT }
  }

  /**
   * Generate a single scantron page for one student
   */
  private async generateStudentPage(
    doc: PDFKit.PDFDocument,
    student: ScantronStudentInfo,
    qrData: ScantronQRData,
    questionCount: number,
    options: ScantronOptions,
    pageWidth: number,
    pageHeight: number,
    date: string
  ): Promise<void> {
    // Draw registration marks first (in corners)
    this.drawRegistrationMarks(doc, pageWidth, pageHeight)

    let currentY = MARGIN

    // Draw header
    currentY = this.drawHeader(doc, student, date, currentY, pageWidth)

    // Draw QR code and instructions side by side
    currentY = await this.drawQRAndInstructions(
      doc,
      qrData,
      currentY,
      pageWidth,
      options.includeInstructions
    )

    // Add some spacing before bubble grid
    currentY += 20

    // Draw bubble grid
    this.drawBubbleGrid(
      doc,
      currentY,
      questionCount,
      CHOICE_LABELS.length,
      pageWidth,
      pageHeight,
      options.bubbleStyle
    )
  }

  /**
   * Draw the header section (title, student info, date)
   */
  private drawHeader(
    doc: PDFKit.PDFDocument,
    student: ScantronStudentInfo,
    date: string,
    startY: number,
    pageWidth: number
  ): number {
    let y = startY

    // Title
    doc.font('Helvetica-Bold').fontSize(16)
    doc.text('SCANTRON ANSWER SHEET', MARGIN, y, {
      width: pageWidth - 2 * MARGIN,
      align: 'center'
    })
    y += 25

    // Divider line
    doc
      .moveTo(MARGIN, y)
      .lineTo(pageWidth - MARGIN, y)
      .stroke()
    y += 15

    // Student info row
    doc.font('Helvetica').fontSize(11)

    const leftColX = MARGIN
    const rightColX = pageWidth / 2 + 20

    // Left column: Name
    doc.font('Helvetica-Bold').text('Name: ', leftColX, y, { continued: true })
    doc.font('Helvetica').text(`${student.lastName}, ${student.firstName}`)

    // Right column: ID (if available)
    if (student.studentNumber) {
      doc.font('Helvetica-Bold').text('ID: ', rightColX, y, { continued: true })
      doc.font('Helvetica').text(student.studentNumber)
    }
    y += 18

    // Second row: Date and Version
    doc.font('Helvetica-Bold').text('Date: ', leftColX, y, { continued: true })
    doc.font('Helvetica').text(date)

    doc.font('Helvetica-Bold').text('Version: ', rightColX, y, { continued: true })
    doc.font('Helvetica').text('A')
    y += 18

    // Divider line
    doc
      .moveTo(MARGIN, y)
      .lineTo(pageWidth - MARGIN, y)
      .stroke()
    y += 10

    return y
  }

  /**
   * Draw QR code and instructions side by side
   */
  private async drawQRAndInstructions(
    doc: PDFKit.PDFDocument,
    qrData: ScantronQRData,
    startY: number,
    pageWidth: number,
    includeInstructions: boolean
  ): Promise<number> {
    const qrSize = 80
    const qrX = MARGIN
    const qrY = startY + 10

    // Generate QR code as data URL
    // Use highest error correction (H = 30% recovery) for maximum scan reliability
    const qrDataString = JSON.stringify(qrData)
    const qrDataUrl = await QRCode.toDataURL(qrDataString, {
      width: qrSize,
      margin: 2, // Larger quiet zone for better scanning
      errorCorrectionLevel: 'H'
    })

    // Draw QR code
    doc.image(qrDataUrl, qrX, qrY, { width: qrSize, height: qrSize })

    // Draw instructions to the right of QR code
    if (includeInstructions) {
      const instructionsX = qrX + qrSize + 20
      const instructionsWidth = pageWidth - instructionsX - MARGIN
      let instructionsY = qrY

      doc.font('Helvetica-Bold').fontSize(10)
      doc.text('Instructions:', instructionsX, instructionsY)
      instructionsY += 14

      doc.font('Helvetica').fontSize(9)
      const instructions = [
        '• Use a #2 pencil only',
        '• Fill bubbles completely',
        '• Erase cleanly if you change an answer',
        '• Do not fold or crease this sheet',
        '• Mark only one answer per question'
      ]

      for (const instruction of instructions) {
        doc.text(instruction, instructionsX, instructionsY, { width: instructionsWidth })
        instructionsY += 12
      }
    }

    return qrY + qrSize + 10
  }

  /**
   * Draw registration marks in all four corners
   * These help with scan alignment and orientation detection
   */
  private drawRegistrationMarks(
    doc: PDFKit.PDFDocument,
    pageWidth: number,
    pageHeight: number
  ): void {
    const size = REG_MARK_SIZE
    const offset = REG_MARK_OFFSET
    const lineWidth = 3

    doc.lineWidth(lineWidth)

    // Top-left: L-shape (normal orientation indicator)
    doc
      .moveTo(offset, offset + size)
      .lineTo(offset, offset)
      .lineTo(offset + size, offset)
      .stroke('#000000')

    // Top-right: Square (different shape to detect rotation)
    doc
      .rect(pageWidth - offset - size, offset, size, size)
      .fill('#000000')

    // Bottom-left: Filled circle
    doc
      .circle(offset + size / 2, pageHeight - offset - size / 2, size / 2)
      .fill('#000000')

    // Bottom-right: L-shape (rotated, to detect 180° rotation)
    doc
      .moveTo(pageWidth - offset - size, pageHeight - offset)
      .lineTo(pageWidth - offset, pageHeight - offset)
      .lineTo(pageWidth - offset, pageHeight - offset - size)
      .stroke('#000000')

    // Reset line width
    doc.lineWidth(1)
  }

  /**
   * Draw the bubble grid for answers
   */
  private drawBubbleGrid(
    doc: PDFKit.PDFDocument,
    startY: number,
    questionCount: number,
    choicesPerQuestion: number,
    pageWidth: number,
    _pageHeight: number,
    bubbleStyle: 'circle' | 'oval'
  ): void {
    const usableWidth = pageWidth - 2 * MARGIN
    const columnCount = Math.ceil(questionCount / QUESTIONS_PER_COLUMN)
    const columnWidth = usableWidth / columnCount

    // Calculate bubble grid layout
    const questionNumWidth = 30

    for (let q = 0; q < questionCount; q++) {
      const column = Math.floor(q / QUESTIONS_PER_COLUMN)
      const row = q % QUESTIONS_PER_COLUMN

      const columnX = MARGIN + column * columnWidth
      const rowY = startY + row * ROW_HEIGHT
      const bubbleCenterY = rowY + ROW_HEIGHT / 2

      // Draw question number - vertically centered with bubbles
      // Font size 10 is roughly 7pt tall, so offset by half to center
      doc.font('Helvetica-Bold').fontSize(10)
      doc.text(`${q + 1}.`, columnX, bubbleCenterY - 4, {
        width: questionNumWidth - 5,
        align: 'right'
      })

      // Draw bubbles for each choice
      const bubbleStartX = columnX + questionNumWidth + 5

      for (let c = 0; c < choicesPerQuestion; c++) {
        const bubbleX = bubbleStartX + c * BUBBLE_SPACING + BUBBLE_RADIUS

        // Draw bubble outline
        if (bubbleStyle === 'oval') {
          // Oval shape (slightly taller than wide)
          doc.ellipse(bubbleX, bubbleCenterY, BUBBLE_RADIUS, BUBBLE_RADIUS * 1.2)
        } else {
          // Circle shape
          doc.circle(bubbleX, bubbleCenterY, BUBBLE_RADIUS)
        }
        doc.stroke()

        // Draw choice label below the bubble
        doc.font('Helvetica').fontSize(7)
        doc.text(CHOICE_LABELS[c], bubbleX - 4, bubbleCenterY + BUBBLE_RADIUS + 1, {
          width: 8,
          align: 'center'
        })
      }

      // Draw separator line between columns (if not last column)
      if (column < columnCount - 1 && row === 0) {
        const separatorX = columnX + columnWidth - 10
        doc
          .moveTo(separatorX, startY - 5)
          .lineTo(separatorX, startY + QUESTIONS_PER_COLUMN * ROW_HEIGHT)
          .stroke('#cccccc')
      }
    }
  }
}

// Singleton instance
export const pdfService = new PDFService()
