/**
 * PDF Service for scantron generation
 *
 * Generates printable scantron answer sheets with QR codes for student identification.
 */

import PDFDocument from 'pdfkit'
import QRCode from 'qrcode'
import type {
  ScantronGenerationResult,
  ScantronStudentInfo,
  ScantronOptions,
  Question,
  MultipleChoiceQuestion
} from '../../shared/types'
import { scantronLookupService, type CreateScantronLookupInput } from './scantron-lookup.service'

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

// Quiz layout constants (single page with questions + bubbles at bottom)
const QUIZ_MARGIN = 36
const QUIZ_HEADER_HEIGHT = 55
const QUIZ_BUBBLE_GRID_HEIGHT = 85 // Height reserved for bubble grid at bottom (2 rows for 8 questions)
const QUIZ_BUBBLE_RADIUS = 7
const QUIZ_BUBBLE_SPACING = 26

class PDFService {
  /**
   * Generate scantron PDF for an assignment
   */
  async generateScantronPDF(
    students: ScantronStudentInfo[],
    assignmentId: string,
    questionCount: number,
    options: ScantronOptions,
    assessmentTitle?: string,
    courseName?: string,
    sectionName?: string
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

      // Create lookup records for all students in batch (v3 short keys)
      const lookupInputs: CreateScantronLookupInput[] = sortedStudents.map((student) => ({
        assignmentId,
        studentId: student.studentId,
        format: undefined, // Standard scantron, not quiz
        dokLevel: student.dokLevel,
        versionId: student.versionId,
        assessmentTitle,
        studentName: `${student.lastName}, ${student.firstName}`,
        courseName
      }))
      const shortKeys = scantronLookupService.createLookupBatch(lookupInputs)

      // Generate a page for each student
      for (let i = 0; i < sortedStudents.length; i++) {
        const student = sortedStudents[i]
        const shortKey = shortKeys[i]

        // Add new page for students after the first
        if (i > 0) {
          doc.addPage()
        }

        // Build QR string for this student (v3 format: "TH:XXXXXXXX")
        const qrString = scantronLookupService.formatKeyForQR(shortKey)

        // Generate the page with short key QR
        await this.generateStudentPage(
          doc,
          student,
          qrString,
          questionCount,
          options,
          width,
          height,
          dateStr,
          assessmentTitle,
          courseName,
          sectionName
        )
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
   * Generate quiz PDF with integrated scantron
   * Single page per student with questions at top and bubbles at bottom
   * Supports DOK variants - students get questions matching their DOK level
   */
  async generateQuizPDF(
    students: ScantronStudentInfo[],
    assignmentId: string,
    quizTitle: string,
    courseName: string,
    sectionName: string,
    baseQuestions: Question[],
    variants: { dokLevel: number; questions: Question[] }[],
    options: ScantronOptions
  ): Promise<ScantronGenerationResult> {
    try {
      const { width, height } = this.getPageDimensions(options.paperSize)
      const dateStr = new Date().toISOString().split('T')[0]

      // Create PDF document
      const doc = new PDFDocument({
        size: options.paperSize === 'letter' ? 'LETTER' : 'A4',
        margin: QUIZ_MARGIN,
        bufferPages: true
      })

      // Collect PDF data in a buffer
      const chunks: Buffer[] = []
      doc.on('data', (chunk: Buffer) => chunks.push(chunk))

      // Sort students alphabetically by last name, first name
      const sortedStudents = [...students].sort((a, b) =>
        `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`)
      )

      // Create lookup records for all students in batch (v3 short keys)
      const lookupInputs: CreateScantronLookupInput[] = sortedStudents.map((student) => ({
        assignmentId,
        studentId: student.studentId,
        format: 'quiz' as const,
        dokLevel: student.dokLevel,
        versionId: student.versionId,
        assessmentTitle: quizTitle,
        studentName: `${student.lastName}, ${student.firstName}`,
        courseName
      }))
      const shortKeys = scantronLookupService.createLookupBatch(lookupInputs)

      // Generate a page for each student
      for (let i = 0; i < sortedStudents.length; i++) {
        const student = sortedStudents[i]
        const shortKey = shortKeys[i]

        // Add new page for students after the first
        if (i > 0) {
          doc.addPage()
        }

        // Select questions based on student's DOK level
        // If there's a variant matching their DOK, use variant questions; otherwise use base
        const matchingVariant = variants.find((v) => v.dokLevel === student.dokLevel)
        const studentQuestions = matchingVariant ? matchingVariant.questions : baseQuestions

        // Build QR string for this student (v3 format: "TH:XXXXXXXX")
        const qrString = scantronLookupService.formatKeyForQR(shortKey)

        // Generate the quiz page with appropriate questions
        await this.generateQuizPage(
          doc,
          student,
          qrString,
          quizTitle,
          courseName,
          sectionName,
          studentQuestions,
          options,
          width,
          height,
          dateStr
        )
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
      const message = error instanceof Error ? error.message : 'Failed to generate quiz PDF'
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
   * Generate a single quiz page for one student
   * Layout: Full-width questions at top, bubble grid at bottom
   */
  private async generateQuizPage(
    doc: PDFKit.PDFDocument,
    student: ScantronStudentInfo,
    qrString: string,
    quizTitle: string,
    courseName: string,
    sectionName: string,
    questions: Question[],
    options: ScantronOptions,
    pageWidth: number,
    pageHeight: number,
    date: string
  ): Promise<void> {
    // Draw registration marks in corners
    this.drawRegistrationMarks(doc, pageWidth, pageHeight)

    // Draw header with QR code
    const headerEndY = await this.drawQuizHeader(
      doc,
      student,
      qrString,
      quizTitle,
      courseName,
      sectionName,
      date,
      pageWidth
    )

    // Calculate layout dimensions
    const contentWidth = pageWidth - 2 * QUIZ_MARGIN
    const bubbleGridY = pageHeight - QUIZ_MARGIN - QUIZ_BUBBLE_GRID_HEIGHT
    const questionsEndY = bubbleGridY - 15 // Leave gap before bubble grid

    // Draw questions (full width)
    this.drawQuizQuestions(
      doc,
      questions,
      headerEndY + 10,
      QUIZ_MARGIN,
      contentWidth,
      questionsEndY
    )

    // Draw separator line above bubble grid
    doc
      .moveTo(QUIZ_MARGIN, bubbleGridY - 5)
      .lineTo(pageWidth - QUIZ_MARGIN, bubbleGridY - 5)
      .stroke('#cccccc')

    // Draw bubble grid at bottom
    this.drawQuizBubbleGrid(
      doc,
      questions.length,
      QUIZ_MARGIN,
      bubbleGridY,
      contentWidth,
      options.bubbleStyle
    )
  }

  /**
   * Draw quiz header with QR code, title, and student info
   */
  private async drawQuizHeader(
    doc: PDFKit.PDFDocument,
    student: ScantronStudentInfo,
    qrString: string,
    quizTitle: string,
    courseName: string,
    sectionName: string,
    date: string,
    pageWidth: number
  ): Promise<number> {
    let y = QUIZ_MARGIN

    // QR code on the left - v3 format is just a short string like "TH:XXXXXXXX"
    const qrSize = 50
    const qrDataUrl = await QRCode.toDataURL(qrString, {
      width: qrSize,
      margin: 1,
      errorCorrectionLevel: 'H' // Maximum error correction since data is small
    })
    doc.image(qrDataUrl, QUIZ_MARGIN, y, { width: qrSize, height: qrSize })

    // Title, course name, and section name next to QR
    const titleX = QUIZ_MARGIN + qrSize + 10
    doc.font('Helvetica-Bold').fontSize(12)
    doc.text(quizTitle, titleX, y + 3)
    doc.font('Helvetica').fontSize(9)
    doc.text(courseName, titleX, y + 17)
    doc.font('Helvetica').fontSize(8)
    doc.text(sectionName, titleX, y + 29)

    // Student name and date on the right (single line format)
    const fieldX = pageWidth - QUIZ_MARGIN - 180

    doc.font('Helvetica-Bold').fontSize(9)
    doc.text(`${student.lastName}, ${student.firstName}`, fieldX, y + 5)
    doc.font('Helvetica').fontSize(8)
    doc.text(`Date: ${date}`, fieldX, y + 17)

    // Divider line
    y += QUIZ_HEADER_HEIGHT
    doc
      .moveTo(QUIZ_MARGIN, y)
      .lineTo(pageWidth - QUIZ_MARGIN, y)
      .stroke()

    return y + 3
  }

  /**
   * Draw questions with full page width (no side bubbles)
   */
  private drawQuizQuestions(
    doc: PDFKit.PDFDocument,
    questions: Question[],
    startY: number,
    startX: number,
    contentWidth: number,
    maxY: number
  ): void {
    let currentY = startY
    const questionNumWidth = 18
    const textX = startX + questionNumWidth
    const textWidth = contentWidth - questionNumWidth

    for (let i = 0; i < questions.length; i++) {
      const question = questions[i] as MultipleChoiceQuestion
      const questionNum = i + 1

      // Check if we have space (with some buffer)
      if (currentY > maxY - 30) {
        doc.font('Helvetica-Oblique').fontSize(8)
        doc.text('[Content continues...]', startX, currentY)
        break
      }

      // Draw question number
      doc.font('Helvetica-Bold').fontSize(10)
      doc.text(`${questionNum}.`, startX, currentY)

      // Question text (wrapping)
      doc.font('Helvetica').fontSize(9)
      const textHeight = doc.heightOfString(question.text, { width: textWidth })
      doc.text(question.text, textX, currentY, { width: textWidth })

      // Draw choices in 2 columns
      let choiceY = currentY + textHeight + 3
      if (question.choices && question.choices.length > 0) {
        doc.fontSize(8)
        const halfWidth = (textWidth - 15) / 2

        // Row 1: A and B
        const textA = question.choices[0] ? `A) ${question.choices[0].text}` : ''
        const textB = question.choices[1] ? `B) ${question.choices[1].text}` : ''
        const heightA = textA ? doc.heightOfString(textA, { width: halfWidth }) : 0
        const heightB = textB ? doc.heightOfString(textB, { width: halfWidth }) : 0
        const row1Height = Math.max(heightA, heightB, 10)

        if (textA) {
          doc.text(textA, textX + 5, choiceY, { width: halfWidth })
        }
        if (textB) {
          doc.text(textB, textX + 5 + halfWidth + 15, choiceY, { width: halfWidth })
        }

        choiceY += row1Height + 2

        // Row 2: C and D
        if (question.choices.length > 2) {
          const textC = question.choices[2] ? `C) ${question.choices[2].text}` : ''
          const textD = question.choices[3] ? `D) ${question.choices[3].text}` : ''
          const heightC = textC ? doc.heightOfString(textC, { width: halfWidth }) : 0
          const heightD = textD ? doc.heightOfString(textD, { width: halfWidth }) : 0
          const row2Height = Math.max(heightC, heightD, 10)

          if (textC) {
            doc.text(textC, textX + 5, choiceY, { width: halfWidth })
          }
          if (textD) {
            doc.text(textD, textX + 5 + halfWidth + 15, choiceY, { width: halfWidth })
          }

          choiceY += row2Height + 2
        }
      }

      // Move to next question with spacing
      currentY = choiceY + 8
    }
  }

  /**
   * Draw compact bubble grid at the bottom of the page
   * Layout: Rows of 4 questions each for readable display
   */
  private drawQuizBubbleGrid(
    doc: PDFKit.PDFDocument,
    questionCount: number,
    startX: number,
    startY: number,
    contentWidth: number,
    bubbleStyle: 'circle' | 'oval'
  ): void {
    // Label for the answer section
    doc.font('Helvetica-Bold').fontSize(10)
    doc.text('ANSWERS', startX, startY)

    const gridStartY = startY + 16
    const questionsPerRow = 4
    const rowHeight = 28
    const questionWidth = contentWidth / questionsPerRow

    for (let q = 0; q < questionCount; q++) {
      const row = Math.floor(q / questionsPerRow)
      const col = q % questionsPerRow
      const questionNum = q + 1

      const cellX = startX + col * questionWidth
      const cellY = gridStartY + row * rowHeight
      const bubbleCenterY = cellY + 8

      // Draw question number
      doc.font('Helvetica-Bold').fontSize(10)
      doc.text(`${questionNum}.`, cellX, cellY, { width: 22 })

      // Draw 4 bubbles (A, B, C, D)
      const bubbleStartX = cellX + 24
      for (let c = 0; c < 4; c++) {
        const bubbleX = bubbleStartX + c * QUIZ_BUBBLE_SPACING

        // Draw bubble outline
        if (bubbleStyle === 'oval') {
          doc.ellipse(bubbleX, bubbleCenterY, QUIZ_BUBBLE_RADIUS, QUIZ_BUBBLE_RADIUS * 1.2)
        } else {
          doc.circle(bubbleX, bubbleCenterY, QUIZ_BUBBLE_RADIUS)
        }
        doc.stroke()

        // Draw choice label below bubble
        doc.font('Helvetica').fontSize(7)
        doc.text(CHOICE_LABELS[c], bubbleX - 4, bubbleCenterY + QUIZ_BUBBLE_RADIUS + 2, {
          width: 8,
          align: 'center'
        })
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
    qrString: string,
    questionCount: number,
    options: ScantronOptions,
    pageWidth: number,
    pageHeight: number,
    date: string,
    assessmentTitle?: string,
    courseName?: string,
    sectionName?: string
  ): Promise<void> {
    // Draw registration marks first (in corners)
    this.drawRegistrationMarks(doc, pageWidth, pageHeight)

    let currentY = MARGIN

    // Draw header
    currentY = this.drawHeader(
      doc,
      student,
      date,
      currentY,
      pageWidth,
      assessmentTitle,
      courseName,
      sectionName
    )

    // Draw QR code and instructions side by side
    currentY = await this.drawQRAndInstructions(
      doc,
      qrString,
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
    pageWidth: number,
    assessmentTitle?: string,
    courseName?: string,
    sectionName?: string
  ): number {
    let y = startY

    // Title - use assessment title if provided, otherwise generic
    doc.font('Helvetica-Bold').fontSize(16)
    doc.text(assessmentTitle || 'SCANTRON ANSWER SHEET', MARGIN, y, {
      width: pageWidth - 2 * MARGIN,
      align: 'center'
    })
    y += 20

    // Course and section name (if provided)
    if (courseName || sectionName) {
      doc.font('Helvetica').fontSize(10)
      const subtitle = [courseName, sectionName].filter(Boolean).join(' - ')
      doc.text(subtitle, MARGIN, y, {
        width: pageWidth - 2 * MARGIN,
        align: 'center'
      })
      y += 15
    }

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
    qrString: string,
    startY: number,
    pageWidth: number,
    includeInstructions: boolean
  ): Promise<number> {
    const qrSize = 80
    const qrX = MARGIN
    const qrY = startY + 10

    // Generate QR code as data URL
    // v3 format uses short string like "TH:XXXXXXXX" - much smaller = better scanning
    // Use highest error correction (H = 30% recovery) for maximum scan reliability
    const qrDataUrl = await QRCode.toDataURL(qrString, {
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
