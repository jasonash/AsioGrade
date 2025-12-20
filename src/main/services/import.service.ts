/**
 * Import Service
 *
 * Handles importing content from URLs and files for standards parsing.
 * Provides secure URL fetching, file dialog, and text extraction.
 */

import { dialog, BrowserWindow } from 'electron'
import { readFile } from 'fs/promises'
import { ServiceResult } from '../../shared/types/common.types'

// pdf-parse doesn't have proper ES module exports, use require
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdfParse = require('pdf-parse')

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

    // Fetch with timeout
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30000)

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'TeachingHelp/1.0 (Standards Import)'
        }
      })
      clearTimeout(timeout)

      if (!response.ok) {
        return { success: false, error: `HTTP error: ${response.status} ${response.statusText}` }
      }

      const contentType = response.headers.get('content-type') || ''

      // Handle HTML content - extract text
      if (contentType.includes('text/html')) {
        const html = await response.text()
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

      // Handle plain text
      const text = await response.text()
      if (!text.trim()) {
        return { success: false, error: 'No content found at URL' }
      }

      return { success: true, data: text }
    } catch (error) {
      clearTimeout(timeout)
      if (error instanceof Error && error.name === 'AbortError') {
        return { success: false, error: 'Request timed out after 30 seconds' }
      }
      const message = error instanceof Error ? error.message : 'Failed to fetch URL'
      return { success: false, error: message }
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
      const data = await pdfParse(dataBuffer)

      if (!data.text.trim()) {
        return { success: false, error: 'No text content found in PDF' }
      }

      return { success: true, data: data.text }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to extract text from PDF'
      return { success: false, error: message }
    }
  }
}

export const importService = new ImportService()
