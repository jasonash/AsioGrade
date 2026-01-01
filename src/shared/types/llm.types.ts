/**
 * LLM Provider Types
 *
 * Type definitions for the LLM abstraction layer supporting
 * OpenAI, Anthropic, and Google providers.
 */

import type { ServiceResult } from './common.types'

// Supported LLM providers
export type LLMProviderType = 'openai' | 'anthropic' | 'google'

// Provider configuration stored in settings
export interface LLMProviderConfig {
  apiKey: string | null
  model: string
}

// Full provider settings from storage
export interface LLMProvidersConfig {
  default: LLMProviderType | null
  openai: LLMProviderConfig
  anthropic: LLMProviderConfig
  google: LLMProviderConfig
  temperature: number
}

// Provider status for UI display
export interface LLMProviderStatus {
  id: LLMProviderType
  name: string
  configured: boolean
  isDefault: boolean
  models: LLMModelInfo[]
  currentModel: string
}

// Model information
export interface LLMModelInfo {
  id: string
  name: string
  contextWindow: number
  description?: string
}

// Request to send to LLM
export interface LLMRequest {
  prompt: string
  systemPrompt?: string
  maxTokens?: number
  temperature?: number
  provider?: LLMProviderType
  model?: string
}

// Response from LLM
export interface LLMResponse {
  content: string
  usage: LLMUsage
  model: string
  provider: LLMProviderType
  finishReason?: string
}

// Token usage information
export interface LLMUsage {
  inputTokens: number
  outputTokens: number
  totalTokens: number
}

// Stream chunk for streaming responses
export interface LLMStreamChunk {
  content: string
  done: boolean
  usage?: LLMUsage
}

// Connection test result
export interface LLMConnectionTestResult {
  success: boolean
  provider: LLMProviderType
  model: string
  latencyMs?: number
  error?: string
}

// Error types for LLM operations
export type LLMErrorCode =
  | 'NO_PROVIDER_CONFIGURED'
  | 'INVALID_API_KEY'
  | 'RATE_LIMITED'
  | 'CONTEXT_LENGTH_EXCEEDED'
  | 'MODEL_NOT_FOUND'
  | 'NETWORK_ERROR'
  | 'PROVIDER_ERROR'
  | 'UNKNOWN_ERROR'

export interface LLMError {
  code: LLMErrorCode
  message: string
  provider?: LLMProviderType
  retryable: boolean
  details?: unknown
}

// Service result types for LLM operations
export type LLMCompleteResult = ServiceResult<LLMResponse>
export type LLMTestResult = ServiceResult<LLMConnectionTestResult>
export type LLMProvidersResult = ServiceResult<LLMProviderStatus[]>

// ============================================================
// Image Generation Types (Gemini)
// ============================================================

/**
 * Request for image generation
 */
export interface ImageGenerationRequest {
  prompt: string
  provider?: LLMProviderType // Currently only 'google' supported
  model?: string // e.g., 'gemini-2.5-flash-image'
  aspectRatio?: '1:1' | '16:9' | '4:3'
}

/**
 * Response from image generation
 */
export interface ImageGenerationResponse {
  imageBase64: string
  mimeType: string
  promptUsed: string
  model: string
  provider: LLMProviderType
}

export type LLMImageResult = ServiceResult<ImageGenerationResponse>

// ============================================================
// Vision/Image Analysis Types
// ============================================================

/**
 * Request for extracting text from an image using vision models
 */
export interface VisionExtractionRequest {
  imageBase64: string
  mimeType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'
  prompt?: string // Custom prompt, defaults to text extraction
  provider?: LLMProviderType
}

/**
 * Response from vision text extraction
 */
export interface VisionExtractionResponse {
  extractedText: string
  model: string
  provider: LLMProviderType
}

export type VisionExtractionResult = ServiceResult<VisionExtractionResponse>

// Available models per provider
export const OPENAI_MODELS: LLMModelInfo[] = [
  {
    id: 'gpt-4.1',
    name: 'GPT-4.1',
    contextWindow: 1000000,
    description: 'Smartest non-reasoning model'
  },
  {
    id: 'gpt-4.1-mini',
    name: 'GPT-4.1 Mini',
    contextWindow: 1000000,
    description: 'Fast and cost-effective'
  },
  {
    id: 'gpt-4.1-nano',
    name: 'GPT-4.1 Nano',
    contextWindow: 1000000,
    description: 'Fastest and cheapest'
  },
  {
    id: 'o4-mini',
    name: 'O4 Mini',
    contextWindow: 100000,
    description: 'Reasoning model for math/coding'
  },
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    contextWindow: 128000,
    description: 'Legacy model, good for audio'
  }
]

export const ANTHROPIC_MODELS: LLMModelInfo[] = [
  {
    id: 'claude-sonnet-4-20250514',
    name: 'Claude Sonnet 4',
    contextWindow: 200000,
    description: 'Latest Sonnet model with excellent reasoning'
  },
  {
    id: 'claude-3-5-sonnet-20241022',
    name: 'Claude 3.5 Sonnet',
    contextWindow: 200000,
    description: 'Most intelligent Claude model'
  },
  {
    id: 'claude-3-5-haiku-20241022',
    name: 'Claude 3.5 Haiku',
    contextWindow: 200000,
    description: 'Fast and cost-effective'
  },
  {
    id: 'claude-3-opus-20240229',
    name: 'Claude 3 Opus',
    contextWindow: 200000,
    description: 'Previous most capable model'
  }
]

export const GOOGLE_MODELS: LLMModelInfo[] = [
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    contextWindow: 1000000,
    description: 'Latest stable Gemini model - fast and capable'
  },
  {
    id: 'gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    contextWindow: 1000000,
    description: 'Most powerful Gemini model with adaptive thinking'
  },
  {
    id: 'gemini-2.5-flash-lite',
    name: 'Gemini 2.5 Flash Lite',
    contextWindow: 1000000,
    description: 'Fast, low-cost, high-performance'
  },
  {
    id: 'gemini-2.0-flash',
    name: 'Gemini 2.0 Flash',
    contextWindow: 1000000,
    description: 'Previous generation, still available'
  }
]

// Helper to get models for a provider
export function getModelsForProvider(provider: LLMProviderType): LLMModelInfo[] {
  switch (provider) {
    case 'openai':
      return OPENAI_MODELS
    case 'anthropic':
      return ANTHROPIC_MODELS
    case 'google':
      return GOOGLE_MODELS
  }
}

// Helper to get provider display name
export function getProviderName(provider: LLMProviderType): string {
  switch (provider) {
    case 'openai':
      return 'OpenAI'
    case 'anthropic':
      return 'Anthropic'
    case 'google':
      return 'Google'
  }
}
