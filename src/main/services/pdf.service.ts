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
  ScantronOptions,
  Question,
  MultipleChoiceQuestion
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

// Quiz layout constants (single page with questions + bubbles)
const QUIZ_MARGIN = 36
const QUIZ_HEADER_HEIGHT = 70
const QUIZ_QUESTION_WIDTH_RATIO = 0.62 // 62% for questions
const QUIZ_BUBBLE_WIDTH_RATIO = 0.35 // 35% for bubbles (3% gap)
const QUIZ_BUBBLE_RADIUS = 8
const QUIZ_BUBBLE_SPACING = 30

class PDFService {
  /**
   * Generate scantron PDF for an assignment
   */
  async generateScantronPDF(
    students: ScantronStudentInfo[],
    assignmentId: string,
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

        // Build QR data for this student (v2 includes DOK and version)
        const qrData: ScantronQRData = {
          v: 2,
          aid: assignmentId,
          sid: student.studentId,
          dok: student.dokLevel,
          ver: student.versionId
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
   * Generate quiz PDF with integrated scantron
   * Single page per student with questions on left and bubbles on right
   */
  async generateQuizPDF(
    students: ScantronStudentInfo[],
    assignmentId: string,
    quizTitle: string,
    courseName: string,
    questions: Question[],
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

      // Generate a page for each student
      for (let i = 0; i < sortedStudents.length; i++) {
        const student = sortedStudents[i]

        // Add new page for students after the first
        if (i > 0) {
          doc.addPage()
        }

        // Build QR data for this student (v2 includes DOK, version, and format)
        const qrData: ScantronQRData = {
          v: 2,
          aid: assignmentId,
          sid: student.studentId,
          fmt: 'quiz',
          dok: student.dokLevel,
          ver: student.versionId
        }

        // Generate the quiz page
        await this.generateQuizPage(
          doc,
          student,
          qrData,
          quizTitle,
          courseName,
          questions,
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
   */
  private async generateQuizPage(
    doc: PDFKit.PDFDocument,
    student: ScantronStudentInfo,
    qrData: ScantronQRData,
    quizTitle: string,
    courseName: string,
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
      qrData,
      quizTitle,
      courseName,
      date,
      pageWidth
    )

    // Calculate layout dimensions
    const contentWidth = pageWidth - 2 * QUIZ_MARGIN
    const questionsWidth = contentWidth * QUIZ_QUESTION_WIDTH_RATIO
    const bubblesWidth = contentWidth * QUIZ_BUBBLE_WIDTH_RATIO
    const bubblesStartX = pageWidth - QUIZ_MARGIN - bubblesWidth

    // Draw vertical separator line
    const separatorX = QUIZ_MARGIN + questionsWidth + (contentWidth * 0.015)
    doc
      .moveTo(separatorX, headerEndY + 10)
      .lineTo(separatorX, pageHeight - QUIZ_MARGIN - 30)
      .stroke('#cccccc')

    // Draw questions and bubbles
    this.drawQuizQuestionsAndBubbles(
      doc,
      questions,
      headerEndY + 15,
      QUIZ_MARGIN,
      questionsWidth,
      bubblesStartX,
      bubblesWidth,
      options.bubbleStyle
    )
  }

  /**
   * Draw quiz header with QR code, title, and student info
   */
  private async drawQuizHeader(
    doc: PDFKit.PDFDocument,
    student: ScantronStudentInfo,
    qrData: ScantronQRData,
    quizTitle: string,
    courseName: string,
    date: string,
    pageWidth: number
  ): Promise<number> {
    let y = QUIZ_MARGIN

    // QR code on the left
    const qrSize = 50
    const qrDataString = JSON.stringify(qrData)
    const qrDataUrl = await QRCode.toDataURL(qrDataString, {
      width: qrSize,
      margin: 1,
      errorCorrectionLevel: 'H'
    })
    doc.image(qrDataUrl, QUIZ_MARGIN, y, { width: qrSize, height: qrSize })

    // Title and course name next to QR
    const titleX = QUIZ_MARGIN + qrSize + 15
    doc.font('Helvetica-Bold').fontSize(14)
    doc.text(quizTitle, titleX, y + 5)
    doc.font('Helvetica').fontSize(10)
    doc.text(courseName, titleX, y + 22)

    // Name and date fields on the right
    const fieldWidth = 150
    const fieldX = pageWidth - QUIZ_MARGIN - fieldWidth

    doc.font('Helvetica-Bold').fontSize(10)
    doc.text('Name:', fieldX, y + 5, { continued: true })
    doc.font('Helvetica').text(' _________________')

    doc.font('Helvetica-Bold').text('Date:', fieldX, y + 22, { continued: true })
    doc.font('Helvetica').text(` ${date}`)

    // Pre-printed student name below fields (small, gray)
    doc.font('Helvetica').fontSize(8).fillColor('#666666')
    doc.text(`${student.lastName}, ${student.firstName}`, fieldX, y + 42)
    doc.fillColor('#000000')

    // Divider line
    y += QUIZ_HEADER_HEIGHT
    doc
      .moveTo(QUIZ_MARGIN, y)
      .lineTo(pageWidth - QUIZ_MARGIN, y)
      .stroke()

    return y + 5
  }

  /**
   * Draw questions on the left and bubbles on the right
   */
  private drawQuizQuestionsAndBubbles(
    doc: PDFKit.PDFDocument,
    questions: Question[],
    startY: number,
    questionsX: number,
    questionsWidth: number,
    bubblesX: number,
    _bubblesWidth: number,
    bubbleStyle: 'circle' | 'oval'
  ): void {
    let currentY = startY

    for (let i = 0; i < questions.length; i++) {
      const question = questions[i] as MultipleChoiceQuestion
      const questionNum = i + 1

      // Calculate bubble Y position (centered in row)
      const bubbleCenterY = currentY + 20

      // Draw question number and text on the left
      doc.font('Helvetica-Bold').fontSize(10)
      const numText = `${questionNum}.`
      doc.text(numText, questionsX, currentY)

      // Question text (wrapping)
      const textX = questionsX + 20
      const textWidth = questionsWidth - 25
      doc.font('Helvetica').fontSize(9)
      const textHeight = doc.heightOfString(question.text, { width: textWidth })
      doc.text(question.text, textX, currentY, { width: textWidth })

      // Draw choices below question
      let choiceY = currentY + textHeight + 5
      if (question.choices) {
        doc.fontSize(8)
        for (let c = 0; c < question.choices.length; c++) {
          const choice = question.choices[c]
          const choiceLabel = String.fromCharCode(65 + c) // A, B, C, D...
          doc.text(`${choiceLabel}) ${choice.text}`, textX + 10, choiceY, {
            width: textWidth - 15
          })
          choiceY += doc.heightOfString(`${choiceLabel}) ${choice.text}`, { width: textWidth - 15 }) + 2
        }
      }

      // Draw bubbles on the right (vertically centered)
      this.drawQuizBubbleRow(
        doc,
        questionNum,
        bubblesX,
        bubbleCenterY,
        question.choices?.length ?? 4,
        bubbleStyle
      )

      // Move to next question
      const contentHeight = Math.max(choiceY - currentY, 40)
      currentY += contentHeight + 10
    }
  }

  /**
   * Draw a single row of bubbles for quiz format
   */
  private drawQuizBubbleRow(
    doc: PDFKit.PDFDocument,
    questionNum: number,
    startX: number,
    centerY: number,
    choiceCount: number,
    bubbleStyle: 'circle' | 'oval'
  ): void {
    // Draw question number
    doc.font('Helvetica-Bold').fontSize(10)
    doc.text(`${questionNum}.`, startX, centerY - 5, { width: 25, align: 'right' })

    // Draw bubbles
    const bubbleStartX = startX + 35
    for (let c = 0; c < choiceCount; c++) {
      const bubbleX = bubbleStartX + c * QUIZ_BUBBLE_SPACING

      // Draw bubble outline
      if (bubbleStyle === 'oval') {
        doc.ellipse(bubbleX, centerY, QUIZ_BUBBLE_RADIUS, QUIZ_BUBBLE_RADIUS * 1.2)
      } else {
        doc.circle(bubbleX, centerY, QUIZ_BUBBLE_RADIUS)
      }
      doc.stroke()

      // Draw choice label below bubble
      doc.font('Helvetica').fontSize(7)
      doc.text(CHOICE_LABELS[c], bubbleX - 4, centerY + QUIZ_BUBBLE_RADIUS + 2, {
        width: 8,
        align: 'center'
      })
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
