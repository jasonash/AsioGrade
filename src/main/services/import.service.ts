/**
 * Import Service
 *
 * Handles importing content from URLs and files for standards parsing.
 * Provides secure URL fetching, file dialog, and text extraction.
 */

import { dialog, BrowserWindow } from 'electron'
import { readFile } from 'fs/promises'
import https from 'https'
import mammoth from 'mammoth'
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs'
import type { ServiceResult } from '../../shared/types/common.types'

/**
 * Extract text from PDF buffer using pdfjs-dist directly
 * This is more lenient than pdf-parse for malformed PDFs
 */
async function extractPdfText(data: Buffer): Promise<string> {
  const uint8Array = new Uint8Array(data)

  // Load PDF with options optimized for Node.js (no worker) and error recovery
  const loadingTask = pdfjsLib.getDocument({
    data: uint8Array,
    // Disable worker - not needed in Node.js/Electron main process
    useWorkerFetch: false,
    isEvalSupported: false,
    useSystemFonts: true,
    disableFontFace: true,
    // Don't stop on recoverable errors (like bad XRef entries)
    stopAtErrors: false
  })

  const pdf = await loadingTask.promise
  const textParts: string[] = []

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const textContent = await page.getTextContent()
    const pageText = textContent.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ')
    textParts.push(pageText)
  }

  return textParts.join('\n\n')
}

/**
 * Fetch URL using Node's https module (handles certificate issues better)
 */
function fetchWithHttps(url: string): Promise<{ data: Buffer; contentType: string; contentDisposition: string }> {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url)

    const options: https.RequestOptions = {
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,application/pdf,*/*;q=0.8'
      },
      // Handle sites with incomplete certificate chains (common with .gov sites)
      rejectUnauthorized: false
    }

    const req = https.get(options, (res) => {
      // Handle redirects
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        fetchWithHttps(res.headers.location).then(resolve).catch(reject)
        return
      }

      if (res.statusCode && res.statusCode >= 400) {
        reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`))
        return
      }

      const chunks: Buffer[] = []
      res.on('data', (chunk: Buffer) => chunks.push(chunk))
      res.on('end', () => {
        resolve({
          data: Buffer.concat(chunks),
          contentType: res.headers['content-type'] || '',
          contentDisposition: res.headers['content-disposition'] || ''
        })
      })
      res.on('error', reject)
    })

    req.on('error', reject)
    req.setTimeout(30000, () => {
      req.destroy()
      reject(new Error('Request timed out'))
    })
  })
}

class ImportService {
  /**
   * Fetch content from a URL (HTTPS only)
   */
  async fetchUrl(url: string): Promise<ServiceResult<string>> {
    // Validate URL format
    let parsedUrl: URL
    try {
      parsedUrl = new URL(url)
    } catch {
      return { success: false, error: 'Invalid URL format' }
    }

    // Only allow HTTPS
    if (parsedUrl.protocol !== 'https:') {
      return { success: false, error: 'Only HTTPS URLs are supported for security' }
    }

    try {
      const response = await fetchWithHttps(parsedUrl.toString())
      const { data, contentType, contentDisposition } = response

      // Handle PDF downloads automatically
      if (contentType.includes('application/pdf')) {
        try {
          const text = await extractPdfText(data)

          if (!text.trim()) {
            return { success: false, error: 'No text content found in the PDF. It may contain only scanned images.' }
          }

          return { success: true, data: text }
        } catch (err) {
          console.error('PDF extraction error:', err)
          return { success: false, error: 'Failed to extract text from the PDF. The file may be scanned images or corrupted.' }
        }
      }

      // Handle other file downloads - try to read as text
      if (contentDisposition.includes('attachment') || contentType.includes('application/octet-stream')) {
        // Try to determine file type from content-disposition filename
        const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/)
        const filename = filenameMatch ? filenameMatch[1].replace(/['"]/g, '') : ''

        if (filename.toLowerCase().endsWith('.pdf')) {
          try {
            const text = await extractPdfText(data)

            if (!text.trim()) {
              return { success: false, error: 'No text content found in the PDF. It may contain only scanned images.' }
            }

            return { success: true, data: text }
          } catch (err) {
            console.error('PDF extraction error:', err)
            return { success: false, error: 'Failed to extract text from the PDF' }
          }
        }

        if (filename.toLowerCase().endsWith('.txt')) {
          const text = data.toString('utf-8')
          if (!text.trim()) {
            return { success: false, error: 'The text file is empty' }
          }
          return { success: true, data: text }
        }

        // Unknown file type - try to parse as PDF anyway (common for .gov sites)
        try {
          const text = await extractPdfText(data)
          if (text.trim()) {
            return { success: true, data: text }
          }
        } catch {
          // Not a PDF, continue
        }

        // Unknown file type
        return {
          success: false,
          error: `This URL downloads a file type we can't process (${filename || 'unknown'}). We support PDF and text files.`
        }
      }

      // Handle HTML content - extract text
      if (contentType.includes('text/html')) {
        const html = data.toString('utf-8')
        // Simple HTML to text conversion - strip tags
        const text = html
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
          .replace(/<[^>]+>/g, '\n')
          .replace(/&nbsp;/g, ' ')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/\n\s*\n/g, '\n\n')
          .trim()

        if (!text) {
          return { success: false, error: 'No text content found on the page' }
        }

        return { success: true, data: text }
      }

      // Handle plain text or other text types
      if (contentType.includes('text/')) {
        const text = data.toString('utf-8')
        if (!text.trim()) {
          return { success: false, error: 'No content found at URL' }
        }
        return { success: true, data: text }
      }

      // Unknown content type - try to parse as PDF anyway
      try {
        const text = await extractPdfText(data)
        if (text.trim()) {
          return { success: true, data: text }
        }
      } catch {
        // Not a PDF
      }

      // Unknown content type
      return {
        success: false,
        error: `Unsupported content type: ${contentType}. Try downloading the file and using "From File" instead.`
      }
    } catch (error) {
      console.error('Fetch error:', error)
      const message = error instanceof Error ? error.message : 'Unknown error'

      if (message.includes('timed out')) {
        return { success: false, error: 'Request timed out. The server may be slow - try again later.' }
      }
      if (message.includes('ENOTFOUND') || message.includes('EAI_AGAIN')) {
        return { success: false, error: 'Could not find the website. Check the URL and your internet connection.' }
      }
      if (message.includes('ECONNREFUSED')) {
        return { success: false, error: 'Connection refused by the server. The site may be down.' }
      }

      return { success: false, error: `Failed to fetch: ${message}` }
    }
  }

  /**
   * Show native file dialog for selecting .txt or .pdf files
   */
  async openFileDialog(): Promise<ServiceResult<string | null>> {
    try {
      const focusedWindow = BrowserWindow.getFocusedWindow()

      const dialogOptions: Electron.OpenDialogOptions = {
        title: 'Select Standards File',
        properties: ['openFile'],
        filters: [
          { name: 'All Supported', extensions: ['txt', 'pdf'] },
          { name: 'Text Files', extensions: ['txt'] },
          { name: 'PDF Files', extensions: ['pdf'] }
        ]
      }

      const result = focusedWindow
        ? await dialog.showOpenDialog(focusedWindow, dialogOptions)
        : await dialog.showOpenDialog(dialogOptions)

      if (result.canceled || result.filePaths.length === 0) {
        return { success: true, data: null }
      }

      return { success: true, data: result.filePaths[0] }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to open file dialog'
      return { success: false, error: message }
    }
  }

  /**
   * Show native file dialog for selecting document files (PDF, DOCX, TXT)
   * Used for importing existing assessments/materials
   */
  async openMaterialFileDialog(): Promise<ServiceResult<string | null>> {
    try {
      const focusedWindow = BrowserWindow.getFocusedWindow()

      const dialogOptions: Electron.OpenDialogOptions = {
        title: 'Select Material to Import',
        properties: ['openFile'],
        filters: [
          { name: 'All Supported', extensions: ['pdf', 'docx', 'doc', 'txt'] },
          { name: 'PDF Files', extensions: ['pdf'] },
          { name: 'Word Documents', extensions: ['docx', 'doc'] },
          { name: 'Text Files', extensions: ['txt'] }
        ]
      }

      const result = focusedWindow
        ? await dialog.showOpenDialog(focusedWindow, dialogOptions)
        : await dialog.showOpenDialog(dialogOptions)

      if (result.canceled || result.filePaths.length === 0) {
        return { success: true, data: null }
      }

      return { success: true, data: result.filePaths[0] }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to open file dialog'
      return { success: false, error: message }
    }
  }

  /**
   * Read text file contents
   */
  async readTextFile(filePath: string): Promise<ServiceResult<string>> {
    try {
      const content = await readFile(filePath, 'utf-8')

      if (!content.trim()) {
        return { success: false, error: 'File is empty' }
      }

      return { success: true, data: content }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to read file'
      return { success: false, error: message }
    }
  }

  /**
   * Extract text from PDF file
   */
  async readPdfText(filePath: string): Promise<ServiceResult<string>> {
    try {
      const dataBuffer = await readFile(filePath)
      const text = await extractPdfText(dataBuffer)

      if (!text.trim()) {
        return { success: false, error: 'No text content found in PDF. It may contain only scanned images.' }
      }

      return { success: true, data: text }
    } catch (error) {
      console.error('PDF extraction error:', error)
      const message = error instanceof Error ? error.message : 'Failed to extract text from PDF'
      // Provide more helpful error message for common issues
      if (message.includes('XRef') || message.includes('Invalid PDF')) {
        return {
          success: false,
          error: 'This PDF has a non-standard format. Try re-exporting it from the original application, or convert it to DOCX/TXT.'
        }
      }
      return { success: false, error: message }
    }
  }

  /**
   * Extract text from DOCX file
   */
  async readDocxText(filePath: string): Promise<ServiceResult<string>> {
    try {
      const dataBuffer = await readFile(filePath)
      const result = await mammoth.extractRawText({ buffer: dataBuffer })

      if (!result.value.trim()) {
        return { success: false, error: 'No text content found in document' }
      }

      return { success: true, data: result.value }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to extract text from document'
      return { success: false, error: message }
    }
  }

  /**
   * Extract text from any supported file based on extension
   */
  async extractTextFromFile(filePath: string): Promise<ServiceResult<string>> {
    const extension = filePath.toLowerCase().split('.').pop()

    switch (extension) {
      case 'pdf':
        return this.readPdfText(filePath)
      case 'docx':
      case 'doc':
        return this.readDocxText(filePath)
      case 'txt':
        return this.readTextFile(filePath)
      default:
        return { success: false, error: `Unsupported file type: .${extension}` }
    }
  }

  /**
   * Extract text from a buffer based on MIME type
   * Used for extracting text from files downloaded from Google Drive
   */
  async extractTextFromBuffer(buffer: Buffer, mimeType: string): Promise<ServiceResult<string>> {
    try {
      if (mimeType === 'application/pdf') {
        const text = await extractPdfText(buffer)
        return { success: true, data: text }
      } else if (
        mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      ) {
        const result = await mammoth.extractRawText({ buffer })
        return { success: true, data: result.value }
      } else if (mimeType === 'text/plain') {
        return { success: true, data: buffer.toString('utf-8') }
      } else {
        return { success: false, error: `Unsupported MIME type: ${mimeType}` }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to extract text from buffer'
      return { success: false, error: message }
    }
  }
}

export const importService = new ImportService()
