/**
 * Puzzle Service
 *
 * Generates word search and crossword puzzles from vocabulary lists.
 * Uses custom implementations for full control over puzzle format.
 */

import type {
  WordSearchData,
  CrosswordData,
  PuzzleVocabulary
} from '../../shared/types/material.types'
import type { ServiceResult } from '../../shared/types/common.types'

// Direction vectors for word placement
type Direction = { dr: number; dc: number; name: string }

// Simple directions for word search (no backwards)
const SIMPLE_DIRECTIONS: Direction[] = [
  { dr: 0, dc: 1, name: 'right' },
  { dr: 1, dc: 0, name: 'down' },
  { dr: 1, dc: 1, name: 'diagonal-right' }
]

class PuzzleService {
  /**
   * Generate a word search puzzle
   */
  generateWordSearch(
    words: string[],
    size?: 'small' | 'medium' | 'large'
  ): ServiceResult<WordSearchData> {
    try {
      // Clean and validate words
      const cleanedWords = words
        .map(w => w.toUpperCase().replace(/[^A-Z]/g, ''))
        .filter(w => w.length >= 3 && w.length <= 15)
        .sort((a, b) => b.length - a.length) // Place longer words first

      if (cleanedWords.length === 0) {
        return { success: false, error: 'No valid words provided' }
      }

      // Determine grid size
      const longestWord = Math.max(...cleanedWords.map(w => w.length))
      let gridSize: number
      switch (size) {
        case 'small':
          gridSize = Math.max(10, longestWord + 2)
          break
        case 'large':
          gridSize = Math.max(20, longestWord + 4)
          break
        case 'medium':
        default:
          gridSize = Math.max(15, longestWord + 3)
      }

      // Initialize empty grid
      const grid: string[][] = Array(gridSize)
        .fill(null)
        .map(() => Array(gridSize).fill(''))

      const solution: WordSearchData['solution'] = []
      const placedWords: string[] = []

      // Try to place each word
      for (const word of cleanedWords) {
        const placed = this.placeWordInGrid(grid, word, SIMPLE_DIRECTIONS)
        if (placed) {
          solution.push(placed)
          placedWords.push(word)
        }
      }

      if (placedWords.length === 0) {
        return { success: false, error: 'Could not place any words in the grid' }
      }

      // Fill empty cells with random letters
      this.fillEmptyCells(grid)

      return {
        success: true,
        data: {
          grid,
          words: placedWords,
          size: gridSize,
          solution
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Word search generation failed'
      return { success: false, error: message }
    }
  }

  /**
   * Try to place a word in the grid
   */
  private placeWordInGrid(
    grid: string[][],
    word: string,
    directions: Direction[]
  ): { word: string; startRow: number; startCol: number; direction: string } | null {
    const size = grid.length
    const maxAttempts = 100
    let attempts = 0

    while (attempts < maxAttempts) {
      attempts++

      // Random starting position
      const startRow = Math.floor(Math.random() * size)
      const startCol = Math.floor(Math.random() * size)

      // Random direction
      const dir = directions[Math.floor(Math.random() * directions.length)]

      // Check if word fits
      if (this.canPlaceWord(grid, word, startRow, startCol, dir)) {
        // Place the word
        this.placeWord(grid, word, startRow, startCol, dir)
        return { word, startRow, startCol, direction: dir.name }
      }
    }

    return null
  }

  /**
   * Check if a word can be placed at a position
   */
  private canPlaceWord(
    grid: string[][],
    word: string,
    startRow: number,
    startCol: number,
    dir: Direction
  ): boolean {
    const size = grid.length

    for (let i = 0; i < word.length; i++) {
      const row = startRow + i * dir.dr
      const col = startCol + i * dir.dc

      // Check bounds
      if (row < 0 || row >= size || col < 0 || col >= size) {
        return false
      }

      // Check cell is empty or has matching letter
      const cell = grid[row][col]
      if (cell !== '' && cell !== word[i]) {
        return false
      }
    }

    return true
  }

  /**
   * Place a word in the grid
   */
  private placeWord(
    grid: string[][],
    word: string,
    startRow: number,
    startCol: number,
    dir: Direction
  ): void {
    for (let i = 0; i < word.length; i++) {
      const row = startRow + i * dir.dr
      const col = startCol + i * dir.dc
      grid[row][col] = word[i]
    }
  }

  /**
   * Fill empty cells with random letters
   */
  private fillEmptyCells(grid: string[][]): void {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    for (let row = 0; row < grid.length; row++) {
      for (let col = 0; col < grid[row].length; col++) {
        if (grid[row][col] === '') {
          grid[row][col] = letters[Math.floor(Math.random() * letters.length)]
        }
      }
    }
  }

  /**
   * Generate a crossword puzzle
   */
  generateCrossword(
    vocabulary: PuzzleVocabulary[]
  ): ServiceResult<CrosswordData> {
    try {
      if (vocabulary.length < 2) {
        return { success: false, error: 'Need at least 2 words for a crossword' }
      }

      // Sort by word length (place longer words first)
      const sorted = [...vocabulary].sort((a, b) => b.word.length - a.word.length)

      // Initialize with larger grid
      const maxWordLength = Math.max(...sorted.map(v => v.word.length))
      const gridSize = Math.max(20, maxWordLength * 2)

      // Create grid (null = black square, string = letter)
      const grid: (string | null)[][] = Array(gridSize)
        .fill(null)
        .map(() => Array(gridSize).fill(null))

      const placedWords: {
        word: string
        clue: string
        row: number
        col: number
        direction: 'across' | 'down'
      }[] = []

      // Place first word in center
      const firstWord = sorted[0]
      const centerRow = Math.floor(gridSize / 2)
      const centerCol = Math.floor((gridSize - firstWord.word.length) / 2)

      this.placeCrosswordWord(grid, firstWord.word, centerRow, centerCol, 'across')
      placedWords.push({
        word: firstWord.word,
        clue: firstWord.clue,
        row: centerRow,
        col: centerCol,
        direction: 'across'
      })

      // Try to place remaining words
      for (let i = 1; i < sorted.length; i++) {
        const vocab = sorted[i]
        const placement = this.findCrosswordPlacement(grid, vocab.word, placedWords)

        if (placement) {
          this.placeCrosswordWord(grid, vocab.word, placement.row, placement.col, placement.direction)
          placedWords.push({
            word: vocab.word,
            clue: vocab.clue,
            row: placement.row,
            col: placement.col,
            direction: placement.direction
          })
        }
      }

      if (placedWords.length < 2) {
        return { success: false, error: 'Could not create crossword with intersecting words' }
      }

      // Trim the grid to used area
      const { trimmedGrid, offset } = this.trimCrosswordGrid(grid)

      // Adjust positions after trimming
      const adjustedWords = placedWords.map(w => ({
        ...w,
        row: w.row - offset.row,
        col: w.col - offset.col
      }))

      // Assign numbers
      const { acrossClues, downClues } = this.assignCrosswordNumbers(trimmedGrid, adjustedWords)

      return {
        success: true,
        data: {
          grid: trimmedGrid,
          acrossClues,
          downClues,
          size: { rows: trimmedGrid.length, cols: trimmedGrid[0]?.length ?? 0 }
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Crossword generation failed'
      return { success: false, error: message }
    }
  }

  /**
   * Place a word in the crossword grid
   */
  private placeCrosswordWord(
    grid: (string | null)[][],
    word: string,
    row: number,
    col: number,
    direction: 'across' | 'down'
  ): void {
    const dr = direction === 'down' ? 1 : 0
    const dc = direction === 'across' ? 1 : 0

    for (let i = 0; i < word.length; i++) {
      grid[row + i * dr][col + i * dc] = word[i]
    }
  }

  /**
   * Find a valid placement for a word that intersects existing words
   */
  private findCrosswordPlacement(
    grid: (string | null)[][],
    word: string,
    existingWords: { word: string; row: number; col: number; direction: 'across' | 'down' }[]
  ): { row: number; col: number; direction: 'across' | 'down' } | null {
    // For each placed word, try to intersect
    for (const existing of existingWords) {
      // Try opposite direction
      const newDirection: 'across' | 'down' = existing.direction === 'across' ? 'down' : 'across'

      // Find common letters
      for (let ei = 0; ei < existing.word.length; ei++) {
        const existingLetter = existing.word[ei]

        for (let ni = 0; ni < word.length; ni++) {
          if (word[ni] === existingLetter) {
            // Calculate intersection point
            let row: number, col: number

            if (newDirection === 'down') {
              // Existing is across, new is down
              row = existing.row - ni
              col = existing.col + ei
            } else {
              // Existing is down, new is across
              row = existing.row + ei
              col = existing.col - ni
            }

            // Check if placement is valid
            if (this.canPlaceCrosswordWord(grid, word, row, col, newDirection)) {
              return { row, col, direction: newDirection }
            }
          }
        }
      }
    }

    return null
  }

  /**
   * Check if a crossword word can be placed
   */
  private canPlaceCrosswordWord(
    grid: (string | null)[][],
    word: string,
    row: number,
    col: number,
    direction: 'across' | 'down'
  ): boolean {
    const size = grid.length
    const dr = direction === 'down' ? 1 : 0
    const dc = direction === 'across' ? 1 : 0

    // Check bounds
    const endRow = row + (word.length - 1) * dr
    const endCol = col + (word.length - 1) * dc

    if (row < 0 || endRow >= size || col < 0 || endCol >= size) {
      return false
    }

    // Check cell before word (should be empty)
    const beforeRow = row - dr
    const beforeCol = col - dc
    if (beforeRow >= 0 && beforeCol >= 0 && beforeRow < size && beforeCol < size) {
      if (grid[beforeRow][beforeCol] !== null) {
        return false
      }
    }

    // Check cell after word (should be empty)
    const afterRow = row + word.length * dr
    const afterCol = col + word.length * dc
    if (afterRow >= 0 && afterCol >= 0 && afterRow < size && afterCol < size) {
      if (grid[afterRow][afterCol] !== null) {
        return false
      }
    }

    let hasIntersection = false

    // Check each cell
    for (let i = 0; i < word.length; i++) {
      const r = row + i * dr
      const c = col + i * dc
      const cell = grid[r][c]

      if (cell === null) {
        // Empty cell - check adjacent cells in perpendicular direction
        const perpDr = direction === 'across' ? 1 : 0
        const perpDc = direction === 'down' ? 1 : 0

        const adj1Row = r - perpDr
        const adj1Col = c - perpDc
        const adj2Row = r + perpDr
        const adj2Col = c + perpDc

        // Adjacent cells should be empty (unless it's the start/end of word)
        if (adj1Row >= 0 && adj1Col >= 0 && adj1Row < size && adj1Col < size) {
          if (grid[adj1Row][adj1Col] !== null) {
            return false // Adjacent cell has letter
          }
        }
        if (adj2Row >= 0 && adj2Col >= 0 && adj2Row < size && adj2Col < size) {
          if (grid[adj2Row][adj2Col] !== null) {
            return false // Adjacent cell has letter
          }
        }
      } else if (cell === word[i]) {
        // Intersection - letter matches
        hasIntersection = true
      } else {
        // Conflict - different letter
        return false
      }
    }

    // Must have at least one intersection (except for first word)
    return hasIntersection
  }

  /**
   * Trim empty rows and columns from crossword grid
   */
  private trimCrosswordGrid(grid: (string | null)[][]): {
    trimmedGrid: (string | null)[][]
    offset: { row: number; col: number }
  } {
    let minRow = grid.length
    let maxRow = 0
    let minCol = grid[0].length
    let maxCol = 0

    // Find bounds of used area
    for (let row = 0; row < grid.length; row++) {
      for (let col = 0; col < grid[row].length; col++) {
        if (grid[row][col] !== null) {
          minRow = Math.min(minRow, row)
          maxRow = Math.max(maxRow, row)
          minCol = Math.min(minCol, col)
          maxCol = Math.max(maxCol, col)
        }
      }
    }

    // Add small margin
    minRow = Math.max(0, minRow - 1)
    maxRow = Math.min(grid.length - 1, maxRow + 1)
    minCol = Math.max(0, minCol - 1)
    maxCol = Math.min(grid[0].length - 1, maxCol + 1)

    // Extract trimmed grid
    const trimmedGrid: (string | null)[][] = []
    for (let row = minRow; row <= maxRow; row++) {
      trimmedGrid.push(grid[row].slice(minCol, maxCol + 1))
    }

    return {
      trimmedGrid,
      offset: { row: minRow, col: minCol }
    }
  }

  /**
   * Assign numbers to crossword clues
   */
  private assignCrosswordNumbers(
    _grid: (string | null)[][],
    words: { word: string; clue: string; row: number; col: number; direction: 'across' | 'down' }[]
  ): {
    acrossClues: CrosswordData['acrossClues']
    downClues: CrosswordData['downClues']
  } {
    // Find all cells that start a word
    const startCells: Map<string, number> = new Map()
    let clueNumber = 1

    // Sort words by position (top-to-bottom, left-to-right)
    const sortedWords = [...words].sort((a, b) => {
      if (a.row !== b.row) return a.row - b.row
      return a.col - b.col
    })

    for (const word of sortedWords) {
      const key = `${word.row},${word.col}`
      if (!startCells.has(key)) {
        startCells.set(key, clueNumber++)
      }
    }

    // Build clue lists
    const acrossClues: CrosswordData['acrossClues'] = []
    const downClues: CrosswordData['downClues'] = []

    for (const word of sortedWords) {
      const key = `${word.row},${word.col}`
      const number = startCells.get(key) ?? 0

      const clueData = {
        number,
        clue: word.clue,
        answer: word.word,
        row: word.row,
        col: word.col
      }

      if (word.direction === 'across') {
        acrossClues.push(clueData)
      } else {
        downClues.push(clueData)
      }
    }

    // Sort clues by number
    acrossClues.sort((a, b) => a.number - b.number)
    downClues.sort((a, b) => a.number - b.number)

    return { acrossClues, downClues }
  }
}

// Singleton instance
export const puzzleService = new PuzzleService()
