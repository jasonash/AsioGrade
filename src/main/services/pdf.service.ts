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
  Lesson
} from '../../shared/types'
import { COMPONENT_TYPE_LABELS } from '../../shared/types/lesson.types'
import type {
  GeneratedMaterial,
  WordSearchData,
  CrosswordData,
  VocabularyItem,
  PracticeQuestion,
  GraphicOrganizerData,
  ExitTicketData
} from '../../shared/types/material.types'

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

  /**
   * Generate a lesson plan PDF
   */
  async generateLessonPDF(
    lesson: Lesson,
    courseName: string,
    unitName: string
  ): Promise<{ success: boolean; pdfBuffer?: Buffer; error?: string }> {
    try {
      const doc = new PDFDocument({
        size: 'LETTER',
        margin: 50
      })

      const chunks: Buffer[] = []
      doc.on('data', (chunk: Buffer) => chunks.push(chunk))

      // Title and header
      this.drawLessonHeader(doc, lesson, courseName, unitName)

      // Learning Goals section
      if (lesson.learningGoals.length > 0) {
        this.drawLessonSection(doc, 'Learning Goals')
        for (const goal of lesson.learningGoals) {
          doc.font('Helvetica').fontSize(10)
          doc.text(`• ${goal.text}`, 60, doc.y, { width: LETTER_WIDTH - 120 })
          doc.moveDown(0.3)
        }
        doc.moveDown(0.5)
      }

      // Success Criteria section
      if (lesson.successCriteria && lesson.successCriteria.length > 0) {
        this.drawLessonSection(doc, 'Success Criteria')
        for (const criteria of lesson.successCriteria) {
          doc.font('Helvetica').fontSize(10)
          doc.text(`• ${criteria}`, 60, doc.y, { width: LETTER_WIDTH - 120 })
          doc.moveDown(0.3)
        }
        doc.moveDown(0.5)
      }

      // Lesson Flow section
      if (lesson.components.length > 0) {
        this.drawLessonSection(doc, 'Lesson Flow')

        let totalTime = 0
        for (const component of lesson.components) {
          // Check if we need a new page
          if (doc.y > LETTER_HEIGHT - 150) {
            doc.addPage()
          }

          const label = COMPONENT_TYPE_LABELS[component.type]

          // Component header row
          doc.font('Helvetica-Bold').fontSize(11)
          doc.text(
            `${component.title} (${label}) - ${component.estimatedMinutes} min`,
            60,
            doc.y,
            { width: LETTER_WIDTH - 120 }
          )
          doc.moveDown(0.3)

          // Description
          if (component.description) {
            doc.font('Helvetica').fontSize(10)
            doc.text(component.description, 70, doc.y, { width: LETTER_WIDTH - 130 })
            doc.moveDown(0.3)
          }

          // Teacher Notes
          if (component.teacherNotes) {
            doc.font('Helvetica-Oblique').fontSize(9)
            doc.fillColor('#666666')
            doc.text(`Teacher Notes: ${component.teacherNotes}`, 70, doc.y, {
              width: LETTER_WIDTH - 130
            })
            doc.fillColor('#000000')
            doc.moveDown(0.3)
          }

          // Student Instructions
          if (component.studentInstructions) {
            doc.font('Helvetica').fontSize(9)
            doc.fillColor('#333333')
            doc.text(`Student Instructions: ${component.studentInstructions}`, 70, doc.y, {
              width: LETTER_WIDTH - 130
            })
            doc.fillColor('#000000')
            doc.moveDown(0.3)
          }

          totalTime += component.estimatedMinutes
          doc.moveDown(0.5)
        }

        // Total time
        doc.font('Helvetica-Bold').fontSize(10)
        doc.text(`Total Time: ${totalTime} minutes`, 60, doc.y)
        doc.moveDown(1)
      }

      // UDL Notes section
      if (lesson.udlNotes) {
        const hasUDLContent =
          (lesson.udlNotes.engagement?.length ?? 0) > 0 ||
          (lesson.udlNotes.representation?.length ?? 0) > 0 ||
          (lesson.udlNotes.expression?.length ?? 0) > 0

        if (hasUDLContent) {
          // Check if we need a new page
          if (doc.y > LETTER_HEIGHT - 200) {
            doc.addPage()
          }

          this.drawLessonSection(doc, 'Universal Design for Learning (UDL)')

          if (lesson.udlNotes.engagement && lesson.udlNotes.engagement.length > 0) {
            doc.font('Helvetica-Bold').fontSize(10)
            doc.text('Engagement:', 60, doc.y)
            doc.moveDown(0.2)
            doc.font('Helvetica').fontSize(9)
            for (const note of lesson.udlNotes.engagement) {
              doc.text(`• ${note}`, 70, doc.y, { width: LETTER_WIDTH - 130 })
              doc.moveDown(0.2)
            }
            doc.moveDown(0.3)
          }

          if (lesson.udlNotes.representation && lesson.udlNotes.representation.length > 0) {
            doc.font('Helvetica-Bold').fontSize(10)
            doc.text('Representation:', 60, doc.y)
            doc.moveDown(0.2)
            doc.font('Helvetica').fontSize(9)
            for (const note of lesson.udlNotes.representation) {
              doc.text(`• ${note}`, 70, doc.y, { width: LETTER_WIDTH - 130 })
              doc.moveDown(0.2)
            }
            doc.moveDown(0.3)
          }

          if (lesson.udlNotes.expression && lesson.udlNotes.expression.length > 0) {
            doc.font('Helvetica-Bold').fontSize(10)
            doc.text('Action & Expression:', 60, doc.y)
            doc.moveDown(0.2)
            doc.font('Helvetica').fontSize(9)
            for (const note of lesson.udlNotes.expression) {
              doc.text(`• ${note}`, 70, doc.y, { width: LETTER_WIDTH - 130 })
              doc.moveDown(0.2)
            }
          }
        }
      }

      doc.end()

      const pdfBuffer = await new Promise<Buffer>((resolve) => {
        doc.on('end', () => {
          resolve(Buffer.concat(chunks))
        })
      })

      return { success: true, pdfBuffer }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to generate lesson PDF'
      return { success: false, error: message }
    }
  }

  /**
   * Draw the lesson header
   */
  private drawLessonHeader(
    doc: PDFKit.PDFDocument,
    lesson: Lesson,
    courseName: string,
    unitName: string
  ): void {
    // Title
    doc.font('Helvetica-Bold').fontSize(18)
    doc.text(lesson.title, 50, 50, { width: LETTER_WIDTH - 100, align: 'center' })
    doc.moveDown(0.5)

    // Subtitle with course and unit
    doc.font('Helvetica').fontSize(11)
    doc.fillColor('#666666')
    doc.text(`${courseName} | ${unitName}`, { align: 'center' })
    doc.fillColor('#000000')
    doc.moveDown(0.3)

    // Description if present
    if (lesson.description) {
      doc.font('Helvetica-Oblique').fontSize(10)
      doc.text(lesson.description, 50, doc.y, {
        width: LETTER_WIDTH - 100,
        align: 'center'
      })
      doc.moveDown(0.5)
    }

    // Stats row
    const totalMinutes = lesson.components.reduce((sum, c) => sum + c.estimatedMinutes, 0)
    doc.font('Helvetica').fontSize(9)
    doc.fillColor('#666666')
    doc.text(
      `Duration: ${totalMinutes} min | ${lesson.learningGoals.length} Learning Goals | ${lesson.components.length} Components`,
      { align: 'center' }
    )
    doc.fillColor('#000000')
    doc.moveDown(1)

    // Divider
    doc
      .moveTo(50, doc.y)
      .lineTo(LETTER_WIDTH - 50, doc.y)
      .stroke('#cccccc')
    doc.moveDown(1)
  }

  /**
   * Draw a section header
   */
  private drawLessonSection(doc: PDFKit.PDFDocument, title: string): void {
    doc.font('Helvetica-Bold').fontSize(13)
    doc.fillColor('#333333')
    doc.text(title, 50, doc.y)
    doc.fillColor('#000000')
    doc.moveDown(0.5)
  }

  // ============================================================
  // Material PDF Generation Methods
  // ============================================================

  /**
   * Generate a material PDF based on its type
   */
  async generateMaterialPDF(
    material: GeneratedMaterial,
    courseName?: string,
    unitName?: string
  ): Promise<{ success: boolean; pdfBuffer?: Buffer; error?: string }> {
    const context = { courseName: courseName ?? '', unitName: unitName ?? '' }

    switch (material.type) {
      case 'worksheet':
      case 'practice-problems':
        return this.generateWorksheetPDF(material, context)
      case 'word-search':
        return this.generateWordSearchPDF(material, context)
      case 'crossword':
        return this.generateCrosswordPDF(material, context)
      case 'vocabulary-list':
        return this.generateVocabularyPDF(material, context)
      case 'graphic-organizer':
        return this.generateGraphicOrganizerPDF(material, context)
      case 'exit-ticket':
        return this.generateExitTicketPDF(material, context)
      case 'diagram':
        return this.generateDiagramPDF(material, context)
      default:
        return { success: false, error: `Unsupported material type: ${material.type}` }
    }
  }

  /**
   * Generate a worksheet/practice problems PDF
   */
  private async generateWorksheetPDF(
    material: GeneratedMaterial,
    context: { courseName: string; unitName: string }
  ): Promise<{ success: boolean; pdfBuffer?: Buffer; error?: string }> {
    try {
      const questions = material.content.questions ?? []
      if (questions.length === 0) {
        return { success: false, error: 'No questions in worksheet' }
      }

      const doc = new PDFDocument({ size: 'LETTER', margin: 50 })
      const chunks: Buffer[] = []
      doc.on('data', (chunk: Buffer) => chunks.push(chunk))

      // Header
      this.drawMaterialHeader(doc, material, context)

      // Instructions
      if (material.content.instructions) {
        doc.font('Helvetica-Oblique').fontSize(10)
        doc.fillColor('#666666')
        doc.text(material.content.instructions, 50, doc.y, { width: LETTER_WIDTH - 100 })
        doc.fillColor('#000000')
        doc.moveDown(1)
      }

      // Questions
      for (const question of questions) {
        if (doc.y > LETTER_HEIGHT - 120) {
          doc.addPage()
        }

        this.drawWorksheetQuestion(doc, question)
      }

      // Answer Key on new page
      doc.addPage()
      this.drawAnswerKey(doc, questions, material.name)

      doc.end()

      const pdfBuffer = await new Promise<Buffer>((resolve) => {
        doc.on('end', () => resolve(Buffer.concat(chunks)))
      })

      return { success: true, pdfBuffer }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to generate worksheet PDF'
      return { success: false, error: message }
    }
  }

  /**
   * Draw a single worksheet question
   */
  private drawWorksheetQuestion(doc: PDFKit.PDFDocument, question: PracticeQuestion): void {
    // Question number and text
    doc.font('Helvetica-Bold').fontSize(11)
    doc.text(`${question.number}.`, 50, doc.y, { continued: true, width: 25 })
    doc.font('Helvetica').fontSize(11)
    doc.text(` ${question.text}`, { width: LETTER_WIDTH - 100 })
    doc.moveDown(0.5)

    if (question.type === 'multiple-choice' && question.choices) {
      // Multiple choice options
      const letters = ['A', 'B', 'C', 'D', 'E']
      for (let i = 0; i < question.choices.length; i++) {
        doc.font('Helvetica').fontSize(10)
        // Draw bubble
        doc.circle(75, doc.y + 5, 6).stroke()
        doc.text(`${letters[i]}. ${question.choices[i].text}`, 90, doc.y, {
          width: LETTER_WIDTH - 140
        })
        doc.moveDown(0.3)
      }
    } else if (question.type === 'true-false') {
      // True/False options
      doc.font('Helvetica').fontSize(10)
      doc.circle(75, doc.y + 5, 6).stroke()
      doc.text('True', 90, doc.y)
      doc.moveDown(0.3)
      doc.circle(75, doc.y + 5, 6).stroke()
      doc.text('False', 90, doc.y)
    } else if (question.type === 'fill-blank') {
      // Fill in the blank - draw line
      doc.moveTo(70, doc.y + 12).lineTo(LETTER_WIDTH - 100, doc.y + 12).stroke()
      doc.moveDown(1)
    } else {
      // Short answer - draw multiple lines
      for (let i = 0; i < 3; i++) {
        doc.moveTo(70, doc.y + 15).lineTo(LETTER_WIDTH - 70, doc.y + 15).stroke()
        doc.moveDown(1)
      }
    }

    doc.moveDown(0.5)
  }

  /**
   * Draw answer key for worksheet
   */
  private drawAnswerKey(
    doc: PDFKit.PDFDocument,
    questions: PracticeQuestion[],
    title: string
  ): void {
    doc.font('Helvetica-Bold').fontSize(16)
    doc.text(`Answer Key: ${title}`, 50, 50, {
      width: LETTER_WIDTH - 100,
      align: 'center'
    })
    doc.moveDown(1)

    doc.moveTo(50, doc.y).lineTo(LETTER_WIDTH - 50, doc.y).stroke()
    doc.moveDown(0.5)

    for (const question of questions) {
      doc.font('Helvetica-Bold').fontSize(10)
      doc.text(`${question.number}. `, 60, doc.y, { continued: true })
      doc.font('Helvetica').fontSize(10)
      doc.text(question.correctAnswer, { width: LETTER_WIDTH - 120 })

      if (question.explanation) {
        doc.font('Helvetica-Oblique').fontSize(9)
        doc.fillColor('#666666')
        doc.text(`   ${question.explanation}`, 70, doc.y, { width: LETTER_WIDTH - 130 })
        doc.fillColor('#000000')
      }
      doc.moveDown(0.3)
    }
  }

  /**
   * Generate a word search PDF
   */
  private async generateWordSearchPDF(
    material: GeneratedMaterial,
    context: { courseName: string; unitName: string }
  ): Promise<{ success: boolean; pdfBuffer?: Buffer; error?: string }> {
    try {
      const wordSearch = material.content.wordSearch
      if (!wordSearch) {
        return { success: false, error: 'No word search data' }
      }

      const doc = new PDFDocument({ size: 'LETTER', margin: 50 })
      const chunks: Buffer[] = []
      doc.on('data', (chunk: Buffer) => chunks.push(chunk))

      // Header
      this.drawMaterialHeader(doc, material, context)

      // Instructions
      doc.font('Helvetica-Oblique').fontSize(10)
      doc.fillColor('#666666')
      doc.text(
        material.content.instructions ?? 'Find all the words in the puzzle below.',
        50,
        doc.y,
        { width: LETTER_WIDTH - 100 }
      )
      doc.fillColor('#000000')
      doc.moveDown(1)

      // Draw the grid
      this.drawWordSearchGrid(doc, wordSearch)

      // Word bank
      doc.moveDown(1)
      this.drawWordBank(doc, wordSearch.words)

      // Solution on new page
      doc.addPage()
      this.drawWordSearchSolution(doc, wordSearch, material.name)

      doc.end()

      const pdfBuffer = await new Promise<Buffer>((resolve) => {
        doc.on('end', () => resolve(Buffer.concat(chunks)))
      })

      return { success: true, pdfBuffer }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to generate word search PDF'
      return { success: false, error: message }
    }
  }

  /**
   * Draw word search grid
   */
  private drawWordSearchGrid(doc: PDFKit.PDFDocument, wordSearch: WordSearchData): void {
    const cellSize = Math.min(28, (LETTER_WIDTH - 120) / wordSearch.size)
    const gridWidth = cellSize * wordSearch.size
    const startX = (LETTER_WIDTH - gridWidth) / 2
    const startY = doc.y

    doc.font('Courier-Bold').fontSize(cellSize * 0.6)

    for (let row = 0; row < wordSearch.grid.length; row++) {
      for (let col = 0; col < wordSearch.grid[row].length; col++) {
        const x = startX + col * cellSize
        const y = startY + row * cellSize

        // Draw cell border
        doc.rect(x, y, cellSize, cellSize).stroke()

        // Draw letter centered
        const letter = wordSearch.grid[row][col]
        doc.text(letter, x, y + cellSize * 0.2, {
          width: cellSize,
          align: 'center'
        })
      }
    }

    // Move doc.y past the grid
    doc.y = startY + wordSearch.size * cellSize + 10
  }

  /**
   * Draw word bank for word search
   */
  private drawWordBank(doc: PDFKit.PDFDocument, words: string[]): void {
    doc.font('Helvetica-Bold').fontSize(12)
    doc.text('Word Bank:', 50, doc.y)
    doc.moveDown(0.5)

    doc.font('Helvetica').fontSize(10)

    // Display words in columns
    const columns = 4
    const columnWidth = (LETTER_WIDTH - 100) / columns
    const startX = 50
    const startY = doc.y

    for (let i = 0; i < words.length; i++) {
      const col = i % columns
      const row = Math.floor(i / columns)
      doc.text(words[i], startX + col * columnWidth, startY + row * 16, { width: columnWidth })
    }

    doc.y = startY + Math.ceil(words.length / columns) * 16
  }

  /**
   * Draw word search solution
   */
  private drawWordSearchSolution(
    doc: PDFKit.PDFDocument,
    wordSearch: WordSearchData,
    title: string
  ): void {
    doc.font('Helvetica-Bold').fontSize(14)
    doc.text(`Solution: ${title}`, 50, 50, { width: LETTER_WIDTH - 100, align: 'center' })
    doc.moveDown(1)

    // Draw smaller grid with highlighted solutions
    const cellSize = Math.min(20, (LETTER_WIDTH - 120) / wordSearch.size)
    const gridWidth = cellSize * wordSearch.size
    const startX = (LETTER_WIDTH - gridWidth) / 2
    const startY = doc.y

    // Create a map of cells that contain solution letters
    const solutionCells = new Set<string>()
    if (wordSearch.solution) {
      for (const sol of wordSearch.solution) {
        let row = sol.startRow
        let col = sol.startCol
        const dirMap: Record<string, { dr: number; dc: number }> = {
          right: { dr: 0, dc: 1 },
          down: { dr: 1, dc: 0 },
          'diagonal-right': { dr: 1, dc: 1 }
        }
        const dir = dirMap[sol.direction] ?? { dr: 0, dc: 1 }

        for (let i = 0; i < sol.word.length; i++) {
          solutionCells.add(`${row},${col}`)
          row += dir.dr
          col += dir.dc
        }
      }
    }

    doc.font('Courier-Bold').fontSize(cellSize * 0.6)

    for (let row = 0; row < wordSearch.grid.length; row++) {
      for (let col = 0; col < wordSearch.grid[row].length; col++) {
        const x = startX + col * cellSize
        const y = startY + row * cellSize
        const key = `${row},${col}`

        // Highlight solution cells
        if (solutionCells.has(key)) {
          doc.rect(x, y, cellSize, cellSize).fill('#FFE5A0')
        }

        doc.rect(x, y, cellSize, cellSize).stroke()
        doc.fillColor('#000000')
        doc.text(wordSearch.grid[row][col], x, y + cellSize * 0.2, {
          width: cellSize,
          align: 'center'
        })
      }
    }
  }

  /**
   * Generate a crossword PDF
   */
  private async generateCrosswordPDF(
    material: GeneratedMaterial,
    context: { courseName: string; unitName: string }
  ): Promise<{ success: boolean; pdfBuffer?: Buffer; error?: string }> {
    try {
      const crossword = material.content.crossword
      if (!crossword) {
        return { success: false, error: 'No crossword data' }
      }

      const doc = new PDFDocument({ size: 'LETTER', margin: 50 })
      const chunks: Buffer[] = []
      doc.on('data', (chunk: Buffer) => chunks.push(chunk))

      // Header
      this.drawMaterialHeader(doc, material, context)

      // Instructions
      doc.font('Helvetica-Oblique').fontSize(10)
      doc.fillColor('#666666')
      doc.text(
        material.content.instructions ?? 'Complete the crossword using the clues below.',
        50,
        doc.y,
        { width: LETTER_WIDTH - 100 }
      )
      doc.fillColor('#000000')
      doc.moveDown(1)

      // Draw the grid
      this.drawCrosswordGrid(doc, crossword)

      // Clues
      doc.moveDown(1)
      this.drawCrosswordClues(doc, crossword)

      // Answer key on new page
      doc.addPage()
      this.drawCrosswordSolution(doc, crossword, material.name)

      doc.end()

      const pdfBuffer = await new Promise<Buffer>((resolve) => {
        doc.on('end', () => resolve(Buffer.concat(chunks)))
      })

      return { success: true, pdfBuffer }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to generate crossword PDF'
      return { success: false, error: message }
    }
  }

  /**
   * Draw crossword grid
   */
  private drawCrosswordGrid(doc: PDFKit.PDFDocument, crossword: CrosswordData): void {
    const maxCellSize = 24
    const gridCols = crossword.size.cols
    const gridRows = crossword.size.rows
    const cellSize = Math.min(maxCellSize, (LETTER_WIDTH - 140) / gridCols, 200 / gridRows)
    const gridWidth = cellSize * gridCols
    const startX = (LETTER_WIDTH - gridWidth) / 2
    const startY = doc.y

    // Create map of clue numbers by position
    const clueNumbers = new Map<string, number>()
    for (const clue of [...crossword.acrossClues, ...crossword.downClues]) {
      const key = `${clue.row},${clue.col}`
      if (!clueNumbers.has(key)) {
        clueNumbers.set(key, clue.number)
      }
    }

    doc.font('Helvetica').fontSize(cellSize * 0.35)

    for (let row = 0; row < gridRows; row++) {
      for (let col = 0; col < gridCols; col++) {
        const x = startX + col * cellSize
        const y = startY + row * cellSize
        const cell = crossword.grid[row]?.[col]

        if (cell === null) {
          // Black square
          doc.rect(x, y, cellSize, cellSize).fill('#000000')
        } else {
          // White square
          doc.rect(x, y, cellSize, cellSize).stroke()

          // Add clue number if applicable
          const key = `${row},${col}`
          const num = clueNumbers.get(key)
          if (num) {
            doc.font('Helvetica').fontSize(cellSize * 0.3)
            doc.text(String(num), x + 2, y + 2, { lineBreak: false })
          }
        }
      }
    }

    doc.y = startY + gridRows * cellSize + 10
  }

  /**
   * Draw crossword clues
   */
  private drawCrosswordClues(doc: PDFKit.PDFDocument, crossword: CrosswordData): void {
    const columnWidth = (LETTER_WIDTH - 120) / 2
    const leftX = 60
    const rightX = leftX + columnWidth + 20

    // Across clues
    doc.font('Helvetica-Bold').fontSize(11)
    doc.text('ACROSS', leftX, doc.y)
    doc.moveDown(0.3)

    const acrossStartY = doc.y
    doc.font('Helvetica').fontSize(9)
    for (const clue of crossword.acrossClues) {
      if (doc.y > LETTER_HEIGHT - 80) break
      doc.text(`${clue.number}. ${clue.clue}`, leftX, doc.y, { width: columnWidth - 10 })
      doc.moveDown(0.3)
    }

    // Down clues
    doc.y = acrossStartY
    doc.font('Helvetica-Bold').fontSize(11)
    doc.text('DOWN', rightX, doc.y)
    doc.moveDown(0.3)

    doc.font('Helvetica').fontSize(9)
    for (const clue of crossword.downClues) {
      if (doc.y > LETTER_HEIGHT - 80) break
      doc.text(`${clue.number}. ${clue.clue}`, rightX, doc.y, { width: columnWidth - 10 })
      doc.moveDown(0.3)
    }
  }

  /**
   * Draw crossword solution
   */
  private drawCrosswordSolution(
    doc: PDFKit.PDFDocument,
    crossword: CrosswordData,
    title: string
  ): void {
    doc.font('Helvetica-Bold').fontSize(14)
    doc.text(`Solution: ${title}`, 50, 50, { width: LETTER_WIDTH - 100, align: 'center' })
    doc.moveDown(1)

    const cellSize = Math.min(
      20,
      (LETTER_WIDTH - 140) / crossword.size.cols,
      200 / crossword.size.rows
    )
    const gridWidth = cellSize * crossword.size.cols
    const startX = (LETTER_WIDTH - gridWidth) / 2
    const startY = doc.y

    doc.font('Courier-Bold').fontSize(cellSize * 0.6)

    for (let row = 0; row < crossword.size.rows; row++) {
      for (let col = 0; col < crossword.size.cols; col++) {
        const x = startX + col * cellSize
        const y = startY + row * cellSize
        const cell = crossword.grid[row]?.[col]

        if (cell === null) {
          doc.rect(x, y, cellSize, cellSize).fill('#000000')
        } else {
          doc.rect(x, y, cellSize, cellSize).stroke()
          doc.fillColor('#000000')
          doc.text(cell, x, y + cellSize * 0.2, { width: cellSize, align: 'center' })
        }
      }
    }

    // Answer list
    doc.y = startY + crossword.size.rows * cellSize + 20
    doc.font('Helvetica-Bold').fontSize(10)
    doc.text('Answers:', 50, doc.y)
    doc.moveDown(0.5)

    doc.font('Helvetica').fontSize(9)
    const answers = [
      ...crossword.acrossClues.map((c) => `${c.number}A: ${c.answer}`),
      ...crossword.downClues.map((c) => `${c.number}D: ${c.answer}`)
    ]

    const cols = 3
    const colWidth = (LETTER_WIDTH - 100) / cols
    for (let i = 0; i < answers.length; i++) {
      const col = i % cols
      const row = Math.floor(i / cols)
      doc.text(answers[i], 50 + col * colWidth, doc.y + row * 14, { width: colWidth })
    }
  }

  /**
   * Generate a vocabulary list PDF
   */
  private async generateVocabularyPDF(
    material: GeneratedMaterial,
    context: { courseName: string; unitName: string }
  ): Promise<{ success: boolean; pdfBuffer?: Buffer; error?: string }> {
    try {
      const vocabulary = material.content.vocabulary ?? []
      if (vocabulary.length === 0) {
        return { success: false, error: 'No vocabulary items' }
      }

      const doc = new PDFDocument({ size: 'LETTER', margin: 50 })
      const chunks: Buffer[] = []
      doc.on('data', (chunk: Buffer) => chunks.push(chunk))

      // Header
      this.drawMaterialHeader(doc, material, context)

      // Instructions
      if (material.content.instructions) {
        doc.font('Helvetica-Oblique').fontSize(10)
        doc.fillColor('#666666')
        doc.text(material.content.instructions, 50, doc.y, { width: LETTER_WIDTH - 100 })
        doc.fillColor('#000000')
        doc.moveDown(1)
      }

      // Vocabulary items
      for (const item of vocabulary) {
        if (doc.y > LETTER_HEIGHT - 100) {
          doc.addPage()
        }
        this.drawVocabularyItem(doc, item)
      }

      doc.end()

      const pdfBuffer = await new Promise<Buffer>((resolve) => {
        doc.on('end', () => resolve(Buffer.concat(chunks)))
      })

      return { success: true, pdfBuffer }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to generate vocabulary PDF'
      return { success: false, error: message }
    }
  }

  /**
   * Draw a single vocabulary item
   */
  private drawVocabularyItem(doc: PDFKit.PDFDocument, item: VocabularyItem): void {
    // Term
    doc.font('Helvetica-Bold').fontSize(12)
    doc.text(item.term, 60, doc.y, { continued: item.partOfSpeech ? true : false })

    if (item.partOfSpeech) {
      doc.font('Helvetica-Oblique').fontSize(10)
      doc.fillColor('#666666')
      doc.text(` (${item.partOfSpeech})`)
      doc.fillColor('#000000')
    }

    // Definition
    doc.font('Helvetica').fontSize(10)
    doc.text(item.definition, 70, doc.y, { width: LETTER_WIDTH - 120 })

    // Example
    if (item.example) {
      doc.font('Helvetica-Oblique').fontSize(9)
      doc.fillColor('#555555')
      doc.text(`Example: "${item.example}"`, 70, doc.y, { width: LETTER_WIDTH - 120 })
      doc.fillColor('#000000')
    }

    doc.moveDown(0.8)

    // Separator line
    doc.moveTo(60, doc.y).lineTo(LETTER_WIDTH - 60, doc.y).stroke('#eeeeee')
    doc.moveDown(0.5)
  }

  /**
   * Generate a graphic organizer PDF
   */
  private async generateGraphicOrganizerPDF(
    material: GeneratedMaterial,
    context: { courseName: string; unitName: string }
  ): Promise<{ success: boolean; pdfBuffer?: Buffer; error?: string }> {
    try {
      const organizer = material.content.graphicOrganizer
      if (!organizer) {
        return { success: false, error: 'No graphic organizer data' }
      }

      const doc = new PDFDocument({ size: 'LETTER', margin: 50 })
      const chunks: Buffer[] = []
      doc.on('data', (chunk: Buffer) => chunks.push(chunk))

      // Header
      this.drawMaterialHeader(doc, material, context)

      // Draw based on template type
      switch (organizer.template) {
        case 'venn-diagram':
          this.drawVennDiagram(doc, organizer)
          break
        case 'concept-map':
          this.drawConceptMap(doc, organizer)
          break
        case 'kwl-chart':
          this.drawKWLChart(doc, organizer)
          break
        case 'cause-effect':
          this.drawCauseEffect(doc, organizer)
          break
        case 'timeline':
          this.drawTimeline(doc, organizer)
          break
        case 'main-idea':
          this.drawMainIdea(doc, organizer)
          break
        case 'comparison-matrix':
          this.drawComparisonMatrix(doc, organizer)
          break
        case 'flowchart':
        default:
          this.drawFlowchart(doc, organizer)
          break
      }

      doc.end()

      const pdfBuffer = await new Promise<Buffer>((resolve) => {
        doc.on('end', () => resolve(Buffer.concat(chunks)))
      })

      return { success: true, pdfBuffer }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to generate graphic organizer PDF'
      return { success: false, error: message }
    }
  }

  /**
   * Draw Venn diagram template
   */
  private drawVennDiagram(doc: PDFKit.PDFDocument, organizer: GraphicOrganizerData): void {
    const centerY = 400
    const radius = 150
    const overlap = 50

    doc.font('Helvetica-Bold').fontSize(14)
    doc.text(organizer.title, 50, doc.y, { width: LETTER_WIDTH - 100, align: 'center' })
    doc.moveDown(2)

    // Left circle
    const leftX = LETTER_WIDTH / 2 - radius + overlap
    doc.circle(leftX, centerY, radius).stroke()

    // Right circle
    const rightX = LETTER_WIDTH / 2 + radius - overlap
    doc.circle(rightX, centerY, radius).stroke()

    // Labels
    const items = organizer.items
    if (items[0]) {
      doc.font('Helvetica-Bold').fontSize(11)
      doc.text(items[0].label, leftX - radius + 20, centerY - radius - 20, {
        width: radius,
        align: 'center'
      })
    }
    if (items[1]) {
      doc.font('Helvetica-Bold').fontSize(11)
      doc.text(items[1].label, rightX - 20, centerY - radius - 20, {
        width: radius,
        align: 'center'
      })
    }

    // "Both" label
    doc.font('Helvetica-Oblique').fontSize(10)
    doc.text('Both', LETTER_WIDTH / 2 - 20, centerY - 10, { width: 40, align: 'center' })

    // Writing lines in each section
    this.addWritingLinesInArea(doc, leftX - radius + 30, centerY - 60, radius - 60, 5)
    this.addWritingLinesInArea(doc, rightX - 30, centerY - 60, radius - 60, 5)
    this.addWritingLinesInArea(doc, LETTER_WIDTH / 2 - 40, centerY + 20, 80, 3)
  }

  /**
   * Draw concept map template
   */
  private drawConceptMap(doc: PDFKit.PDFDocument, organizer: GraphicOrganizerData): void {
    doc.font('Helvetica-Bold').fontSize(14)
    doc.text(organizer.title, 50, doc.y, { width: LETTER_WIDTH - 100, align: 'center' })
    doc.moveDown(1)

    // Central concept box
    const centerX = LETTER_WIDTH / 2
    const centerY = 180
    const boxWidth = 180
    const boxHeight = 50

    doc.rect(centerX - boxWidth / 2, centerY - boxHeight / 2, boxWidth, boxHeight).stroke()
    doc.font('Helvetica-Bold').fontSize(11)

    const mainItem = organizer.items[0]
    if (mainItem) {
      doc.text(mainItem.label, centerX - boxWidth / 2 + 10, centerY - 8, {
        width: boxWidth - 20,
        align: 'center'
      })
    }

    // Branch boxes around the center
    const branches = organizer.items.slice(1, 5)
    const branchPositions = [
      { x: centerX - 200, y: centerY + 120 },
      { x: centerX - 70, y: centerY + 120 },
      { x: centerX + 70, y: centerY + 120 },
      { x: centerX + 200, y: centerY + 120 }
    ]

    for (let i = 0; i < branches.length && i < branchPositions.length; i++) {
      const pos = branchPositions[i]
      const branch = branches[i]

      // Connection line
      doc.moveTo(centerX, centerY + boxHeight / 2).lineTo(pos.x, pos.y - 25).stroke()

      // Branch box
      doc.rect(pos.x - 60, pos.y - 25, 120, 100).stroke()
      doc.font('Helvetica-Bold').fontSize(9)
      doc.text(branch.label, pos.x - 55, pos.y - 20, { width: 110, align: 'center' })

      // Writing lines
      this.addWritingLinesInArea(doc, pos.x - 50, pos.y, 100, 4)
    }
  }

  /**
   * Draw KWL chart
   */
  private drawKWLChart(doc: PDFKit.PDFDocument, organizer: GraphicOrganizerData): void {
    doc.font('Helvetica-Bold').fontSize(14)
    doc.text(organizer.title, 50, doc.y, { width: LETTER_WIDTH - 100, align: 'center' })
    doc.moveDown(1)

    const startY = doc.y
    const colWidth = (LETTER_WIDTH - 120) / 3
    const headers = ['K - What I Know', 'W - What I Want to Know', 'L - What I Learned']
    const boxHeight = 450

    for (let i = 0; i < 3; i++) {
      const x = 60 + i * colWidth

      // Header
      doc.rect(x, startY, colWidth - 10, 30).fill('#E5A80D')
      doc.fillColor('#000000')
      doc.font('Helvetica-Bold').fontSize(10)
      doc.text(headers[i], x + 5, startY + 10, { width: colWidth - 20, align: 'center' })

      // Content box
      doc.rect(x, startY + 30, colWidth - 10, boxHeight).stroke()

      // Writing lines
      this.addWritingLinesInArea(doc, x + 10, startY + 45, colWidth - 30, 18)
    }
  }

  /**
   * Draw cause and effect template
   */
  private drawCauseEffect(doc: PDFKit.PDFDocument, organizer: GraphicOrganizerData): void {
    doc.font('Helvetica-Bold').fontSize(14)
    doc.text(organizer.title, 50, doc.y, { width: LETTER_WIDTH - 100, align: 'center' })
    doc.moveDown(1)

    const startY = doc.y + 20
    const boxWidth = 200
    const boxHeight = 100
    const arrowWidth = 50

    // Draw 3 cause-effect pairs
    for (let i = 0; i < 3; i++) {
      const y = startY + i * 140

      // Cause box
      doc.rect(80, y, boxWidth, boxHeight).stroke()
      doc.font('Helvetica-Bold').fontSize(10)
      doc.text('CAUSE', 80 + 10, y + 5, { width: boxWidth - 20, align: 'center' })
      this.addWritingLinesInArea(doc, 90, y + 25, boxWidth - 20, 4)

      // Arrow
      doc
        .moveTo(80 + boxWidth + 10, y + boxHeight / 2)
        .lineTo(80 + boxWidth + arrowWidth, y + boxHeight / 2)
        .stroke()
      doc
        .moveTo(80 + boxWidth + arrowWidth - 10, y + boxHeight / 2 - 8)
        .lineTo(80 + boxWidth + arrowWidth, y + boxHeight / 2)
        .lineTo(80 + boxWidth + arrowWidth - 10, y + boxHeight / 2 + 8)
        .fill()

      // Effect box
      const effectX = 80 + boxWidth + arrowWidth + 10
      doc.rect(effectX, y, boxWidth, boxHeight).stroke()
      doc.font('Helvetica-Bold').fontSize(10)
      doc.fillColor('#000000')
      doc.text('EFFECT', effectX + 10, y + 5, { width: boxWidth - 20, align: 'center' })
      this.addWritingLinesInArea(doc, effectX + 10, y + 25, boxWidth - 20, 4)
    }
  }

  /**
   * Draw timeline template
   */
  private drawTimeline(doc: PDFKit.PDFDocument, organizer: GraphicOrganizerData): void {
    doc.font('Helvetica-Bold').fontSize(14)
    doc.text(organizer.title, 50, doc.y, { width: LETTER_WIDTH - 100, align: 'center' })
    doc.moveDown(2)

    const startY = doc.y
    const lineY = startY + 30
    const startX = 80
    const endX = LETTER_WIDTH - 80

    // Main timeline line
    doc.lineWidth(2)
    doc.moveTo(startX, lineY).lineTo(endX, lineY).stroke()
    doc.lineWidth(1)

    // Event markers (6 events)
    const eventCount = 6
    const spacing = (endX - startX) / (eventCount - 1)

    for (let i = 0; i < eventCount; i++) {
      const x = startX + i * spacing

      // Vertical marker
      doc.moveTo(x, lineY - 10).lineTo(x, lineY + 10).stroke()

      // Event box (alternating above and below)
      const boxY = i % 2 === 0 ? lineY - 130 : lineY + 25
      doc.rect(x - 50, boxY, 100, 100).stroke()

      // Date label
      doc.font('Helvetica-Bold').fontSize(8)
      doc.text('Date:', x - 45, boxY + 5, { width: 90 })
      doc.moveTo(x - 45 + 30, boxY + 14).lineTo(x + 45, boxY + 14).stroke()

      // Event description lines
      this.addWritingLinesInArea(doc, x - 45, boxY + 25, 90, 4)
    }
  }

  /**
   * Draw main idea and details template
   */
  private drawMainIdea(doc: PDFKit.PDFDocument, organizer: GraphicOrganizerData): void {
    doc.font('Helvetica-Bold').fontSize(14)
    doc.text(organizer.title, 50, doc.y, { width: LETTER_WIDTH - 100, align: 'center' })
    doc.moveDown(1)

    const centerX = LETTER_WIDTH / 2

    // Main idea box at top
    const mainBoxWidth = 350
    const mainBoxHeight = 80
    doc.rect(centerX - mainBoxWidth / 2, doc.y, mainBoxWidth, mainBoxHeight).stroke()
    doc.font('Helvetica-Bold').fontSize(11)
    doc.text('Main Idea', centerX - mainBoxWidth / 2 + 10, doc.y + 5, {
      width: mainBoxWidth - 20,
      align: 'center'
    })
    this.addWritingLinesInArea(doc, centerX - mainBoxWidth / 2 + 20, doc.y + 25, mainBoxWidth - 40, 3)

    const mainBoxBottom = doc.y + mainBoxHeight + 20

    // Supporting detail boxes (3)
    const detailWidth = 150
    const detailHeight = 180
    const spacing = (LETTER_WIDTH - 100 - 3 * detailWidth) / 2
    const detailY = mainBoxBottom + 40

    for (let i = 0; i < 3; i++) {
      const x = 50 + i * (detailWidth + spacing)

      // Connection line
      doc.moveTo(centerX, mainBoxBottom - 20).lineTo(x + detailWidth / 2, detailY).stroke()

      // Detail box
      doc.rect(x, detailY, detailWidth, detailHeight).stroke()
      doc.font('Helvetica-Bold').fontSize(10)
      doc.text(`Detail ${i + 1}`, x + 10, detailY + 5, {
        width: detailWidth - 20,
        align: 'center'
      })

      // Writing lines
      this.addWritingLinesInArea(doc, x + 10, detailY + 25, detailWidth - 20, 8)
    }
  }

  /**
   * Draw comparison matrix template
   */
  private drawComparisonMatrix(doc: PDFKit.PDFDocument, organizer: GraphicOrganizerData): void {
    doc.font('Helvetica-Bold').fontSize(14)
    doc.text(organizer.title, 50, doc.y, { width: LETTER_WIDTH - 100, align: 'center' })
    doc.moveDown(1)

    const startX = 60
    const startY = doc.y
    const cols = 4 // 1 criteria column + 3 item columns
    const rows = 5 // 1 header row + 4 criteria rows
    const colWidth = (LETTER_WIDTH - 120) / cols
    const rowHeight = 80

    // Draw grid
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const x = startX + col * colWidth
        const y = startY + row * rowHeight

        // Header row styling
        if (row === 0) {
          doc.rect(x, y, colWidth, rowHeight).fill('#E5A80D')
          doc.fillColor('#000000')
        } else {
          doc.rect(x, y, colWidth, rowHeight).stroke()
        }

        // First column (criteria labels)
        if (col === 0 && row > 0) {
          doc.rect(x, y, colWidth, rowHeight).fill('#f5f5f5')
          doc.fillColor('#000000')
        }

        // Add header labels
        if (row === 0) {
          doc.font('Helvetica-Bold').fontSize(9)
          const headerLabels = ['Criteria', 'Item 1', 'Item 2', 'Item 3']
          doc.text(headerLabels[col], x + 5, y + rowHeight / 2 - 5, {
            width: colWidth - 10,
            align: 'center'
          })
        } else if (col === 0) {
          // Criteria label
          doc.font('Helvetica-Bold').fontSize(8)
          doc.text(`Criteria ${row}:`, x + 5, y + 5, { width: colWidth - 10 })
          doc.moveTo(x + 5, y + 20).lineTo(x + colWidth - 10, y + 20).stroke()
        } else {
          // Writing lines for comparison cells
          this.addWritingLinesInArea(doc, x + 5, y + 10, colWidth - 10, 3)
        }
      }
    }
  }

  /**
   * Draw flowchart template
   */
  private drawFlowchart(doc: PDFKit.PDFDocument, organizer: GraphicOrganizerData): void {
    doc.font('Helvetica-Bold').fontSize(14)
    doc.text(organizer.title, 50, doc.y, { width: LETTER_WIDTH - 100, align: 'center' })
    doc.moveDown(1)

    const centerX = LETTER_WIDTH / 2
    const boxWidth = 200
    const boxHeight = 80
    const spacing = 30
    const steps = 5

    let currentY = doc.y + 20

    for (let i = 0; i < steps; i++) {
      // Step box
      doc.rect(centerX - boxWidth / 2, currentY, boxWidth, boxHeight).stroke()

      // Step label
      doc.font('Helvetica-Bold').fontSize(9)
      doc.text(`Step ${i + 1}`, centerX - boxWidth / 2 + 10, currentY + 5, {
        width: boxWidth - 20,
        align: 'center'
      })

      // Writing lines
      this.addWritingLinesInArea(doc, centerX - boxWidth / 2 + 15, currentY + 25, boxWidth - 30, 3)

      currentY += boxHeight

      // Arrow to next step (except for last)
      if (i < steps - 1) {
        doc.moveTo(centerX, currentY).lineTo(centerX, currentY + spacing).stroke()
        // Arrow head
        doc
          .moveTo(centerX - 6, currentY + spacing - 8)
          .lineTo(centerX, currentY + spacing)
          .lineTo(centerX + 6, currentY + spacing - 8)
          .fill()
        doc.fillColor('#000000')
        currentY += spacing
      }
    }
  }

  /**
   * Helper to add writing lines in an area
   */
  private addWritingLinesInArea(
    doc: PDFKit.PDFDocument,
    x: number,
    y: number,
    width: number,
    lineCount: number
  ): void {
    const lineSpacing = 18
    for (let i = 0; i < lineCount; i++) {
      doc.moveTo(x, y + i * lineSpacing).lineTo(x + width, y + i * lineSpacing).stroke('#cccccc')
    }
  }

  /**
   * Generate an exit ticket PDF
   */
  private async generateExitTicketPDF(
    material: GeneratedMaterial,
    context: { courseName: string; unitName: string }
  ): Promise<{ success: boolean; pdfBuffer?: Buffer; error?: string }> {
    try {
      const exitTicket = material.content.exitTicket
      if (!exitTicket) {
        return { success: false, error: 'No exit ticket data' }
      }

      const doc = new PDFDocument({ size: 'LETTER', margin: 50 })
      const chunks: Buffer[] = []
      doc.on('data', (chunk: Buffer) => chunks.push(chunk))

      // Header
      this.drawMaterialHeader(doc, material, context)

      // Student info section
      doc.font('Helvetica').fontSize(10)
      doc.text('Name: ', 50, doc.y, { continued: true })
      doc.moveTo(90, doc.y + 12).lineTo(300, doc.y + 12).stroke()
      doc.text('', 50, doc.y)
      doc.moveDown(0.5)
      doc.text('Date: ', 50, doc.y, { continued: true })
      doc.moveTo(85, doc.y + 12).lineTo(200, doc.y + 12).stroke()
      doc.moveDown(1.5)

      // Questions
      for (const question of exitTicket.questions) {
        if (doc.y > LETTER_HEIGHT - 150) {
          doc.addPage()
        }

        this.drawExitTicketQuestion(doc, question)
      }

      doc.end()

      const pdfBuffer = await new Promise<Buffer>((resolve) => {
        doc.on('end', () => resolve(Buffer.concat(chunks)))
      })

      return { success: true, pdfBuffer }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to generate exit ticket PDF'
      return { success: false, error: message }
    }
  }

  /**
   * Draw an exit ticket question
   */
  private drawExitTicketQuestion(
    doc: PDFKit.PDFDocument,
    question: ExitTicketData['questions'][number]
  ): void {
    // Question type indicator
    const typeColors: Record<string, string> = {
      reflection: '#4A90D9',
      check: '#5CB85C',
      application: '#F0AD4E'
    }

    // Question number and text
    doc.font('Helvetica-Bold').fontSize(11)
    doc.fillColor(typeColors[question.type] ?? '#333333')
    doc.text(`${question.number}.`, 50, doc.y, { continued: true })
    doc.fillColor('#000000')
    doc.font('Helvetica').fontSize(11)
    doc.text(` ${question.text}`, { width: LETTER_WIDTH - 100 })
    doc.moveDown(0.5)

    // Response lines
    const lines = question.lines ?? 3
    for (let i = 0; i < lines; i++) {
      doc.moveTo(60, doc.y + 15).lineTo(LETTER_WIDTH - 60, doc.y + 15).stroke()
      doc.moveDown(1)
    }

    doc.moveDown(0.5)
  }

  /**
   * Generate a diagram PDF
   */
  private async generateDiagramPDF(
    material: GeneratedMaterial,
    context: { courseName: string; unitName: string }
  ): Promise<{ success: boolean; pdfBuffer?: Buffer; error?: string }> {
    try {
      const imageBase64 = material.content.diagramImage
      if (!imageBase64) {
        return { success: false, error: 'No diagram image' }
      }

      const doc = new PDFDocument({ size: 'LETTER', margin: 50 })
      const chunks: Buffer[] = []
      doc.on('data', (chunk: Buffer) => chunks.push(chunk))

      // Header
      this.drawMaterialHeader(doc, material, context)

      // Instructions if present
      if (material.content.instructions) {
        doc.font('Helvetica-Oblique').fontSize(10)
        doc.fillColor('#666666')
        doc.text(material.content.instructions, 50, doc.y, { width: LETTER_WIDTH - 100 })
        doc.fillColor('#000000')
        doc.moveDown(1)
      }

      // Draw the diagram image
      const imageBuffer = Buffer.from(imageBase64, 'base64')
      const maxWidth = LETTER_WIDTH - 100
      const maxHeight = LETTER_HEIGHT - doc.y - 100

      doc.image(imageBuffer, 50, doc.y, {
        fit: [maxWidth, maxHeight],
        align: 'center'
      })

      // Prompt used (for reference)
      if (material.content.diagramPrompt) {
        doc.moveDown(2)
        doc.font('Helvetica-Oblique').fontSize(8)
        doc.fillColor('#999999')
        doc.text(`Generated using prompt: "${material.content.diagramPrompt}"`, 50, doc.y, {
          width: LETTER_WIDTH - 100,
          align: 'center'
        })
        doc.fillColor('#000000')
      }

      doc.end()

      const pdfBuffer = await new Promise<Buffer>((resolve) => {
        doc.on('end', () => resolve(Buffer.concat(chunks)))
      })

      return { success: true, pdfBuffer }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to generate diagram PDF'
      return { success: false, error: message }
    }
  }

  /**
   * Draw standard material header
   */
  private drawMaterialHeader(
    doc: PDFKit.PDFDocument,
    material: GeneratedMaterial,
    context: { courseName: string; unitName: string }
  ): void {
    // Title
    doc.font('Helvetica-Bold').fontSize(16)
    doc.text(material.name, 50, 50, { width: LETTER_WIDTH - 100, align: 'center' })
    doc.moveDown(0.3)

    // Context line
    if (context.courseName || context.unitName) {
      doc.font('Helvetica').fontSize(10)
      doc.fillColor('#666666')
      const contextParts = [context.courseName, context.unitName].filter(Boolean)
      doc.text(contextParts.join(' | '), { align: 'center' })
      doc.fillColor('#000000')
      doc.moveDown(0.3)
    }

    // Topic
    if (material.topic) {
      doc.font('Helvetica-Oblique').fontSize(10)
      doc.text(`Topic: ${material.topic}`, { align: 'center' })
    }

    doc.moveDown(0.5)

    // Divider
    doc.moveTo(50, doc.y).lineTo(LETTER_WIDTH - 50, doc.y).stroke('#cccccc')
    doc.moveDown(1)
  }
}

// Singleton instance
export const pdfService = new PDFService()
