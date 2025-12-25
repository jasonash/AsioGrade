/**
 * Google Provider
 *
 * Implements the LLM provider interface for Google's Gemini API.
 * Supports Gemini Pro, Gemini 1.5 Pro, and Gemini 1.5 Flash models.
 */

import { GoogleGenerativeAI, type GenerativeModel } from '@google/generative-ai'
import { AbstractLLMProvider } from './base.provider'
import { GOOGLE_MODELS } from '../../../../shared/types/llm.types'
import type {
  LLMRequest,
  LLMResponse,
  LLMStreamChunk,
  LLMConnectionTestResult,
  LLMModelInfo,
  ImageGenerationRequest,
  ImageGenerationResponse
} from '../../../../shared/types/llm.types'

// Image generation model (Gemini 2.0 Flash with image output)
const IMAGE_GENERATION_MODEL = 'gemini-2.0-flash-exp'

export class GoogleProvider extends AbstractLLMProvider {
  readonly id = 'google' as const
  readonly name = 'Google'
  readonly models: LLMModelInfo[] = GOOGLE_MODELS

  private client: GoogleGenerativeAI | null = null
  private defaultTemperature = 0.7

  /**
   * Google/Gemini supports image generation via the Imagen/Gemini image models
   */
  override supportsImageGeneration(): boolean {
    return true
  }

  constructor(apiKey: string | null, model: string = 'gemini-1.5-pro') {
    super(apiKey, model)
    this.initClient()
  }

  private initClient(): void {
    if (this.apiKey) {
      this.client = new GoogleGenerativeAI(this.apiKey)
    } else {
      this.client = null
    }
  }

  override setApiKey(apiKey: string | null): void {
    super.setApiKey(apiKey)
    this.initClient()
  }

  private getGenerativeModel(modelId: string): GenerativeModel {
    if (!this.client) {
      throw this.createError('NO_PROVIDER_CONFIGURED', 'Google client not initialized')
    }
    return this.client.getGenerativeModel({ model: modelId })
  }

  async complete(request: LLMRequest): Promise<LLMResponse> {
    this.validateConfiguration()

    const modelId = this.getRequestModel(request)
    const temperature = this.getRequestTemperature(request, this.defaultTemperature)

    try {
      const model = this.getGenerativeModel(modelId)

      // Build the prompt with system instruction if provided
      let fullPrompt = request.prompt
      if (request.systemPrompt) {
        fullPrompt = `System: ${request.systemPrompt}\n\nUser: ${request.prompt}`
      }

      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
        generationConfig: {
          temperature,
          maxOutputTokens: request.maxTokens
        }
      })

      const response = result.response
      const content = response.text()

      // Google doesn't provide detailed token counts in the same way
      // We estimate based on the response metadata if available
      const usageMetadata = response.usageMetadata
      const inputTokens = usageMetadata?.promptTokenCount ?? 0
      const outputTokens = usageMetadata?.candidatesTokenCount ?? 0

      return {
        content,
        usage: {
          inputTokens,
          outputTokens,
          totalTokens: inputTokens + outputTokens
        },
        model: modelId,
        provider: this.id,
        finishReason: response.candidates?.[0]?.finishReason ?? undefined
      }
    } catch (error) {
      throw this.handleError(error)
    }
  }

  async *stream(request: LLMRequest): AsyncGenerator<LLMStreamChunk> {
    this.validateConfiguration()

    const modelId = this.getRequestModel(request)
    const temperature = this.getRequestTemperature(request, this.defaultTemperature)

    try {
      const model = this.getGenerativeModel(modelId)

      // Build the prompt with system instruction if provided
      let fullPrompt = request.prompt
      if (request.systemPrompt) {
        fullPrompt = `System: ${request.systemPrompt}\n\nUser: ${request.prompt}`
      }

      const result = await model.generateContentStream({
        contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
        generationConfig: {
          temperature,
          maxOutputTokens: request.maxTokens
        }
      })

      let inputTokens = 0
      let outputTokens = 0

      for await (const chunk of result.stream) {
        const text = chunk.text()

        // Update token counts from usage metadata
        if (chunk.usageMetadata) {
          inputTokens = chunk.usageMetadata.promptTokenCount ?? inputTokens
          outputTokens = chunk.usageMetadata.candidatesTokenCount ?? outputTokens
        }

        yield {
          content: text,
          done: false
        }
      }

      // Final chunk with usage stats
      yield {
        content: '',
        done: true,
        usage: {
          inputTokens,
          outputTokens,
          totalTokens: inputTokens + outputTokens
        }
      }
    } catch (error) {
      throw this.handleError(error)
    }
  }

  async testConnection(): Promise<LLMConnectionTestResult> {
    if (!this.isConfigured()) {
      return {
        success: false,
        provider: this.id,
        model: this.model,
        error: 'API key not configured'
      }
    }

    const startTime = Date.now()

    try {
      // Make a minimal request to verify the connection
      await this.complete({
        prompt: 'Say "ok" and nothing else.',
        maxTokens: 5
      })

      return {
        success: true,
        provider: this.id,
        model: this.model,
        latencyMs: Date.now() - startTime
      }
    } catch (error) {
      return {
        success: false,
        provider: this.id,
        model: this.model,
        latencyMs: Date.now() - startTime,
        error: this.getErrorMessage(error)
      }
    }
  }

  /**
   * Generate an image using Gemini's image generation capabilities
   * Uses the experimental Gemini 2.0 Flash model with image output
   */
  async generateImage(request: ImageGenerationRequest): Promise<ImageGenerationResponse> {
    this.validateConfiguration()

    const modelId = request.model ?? IMAGE_GENERATION_MODEL

    try {
      const model = this.getGenerativeModel(modelId)

      // Build prompt with aspect ratio guidance if specified
      let fullPrompt = request.prompt
      if (request.aspectRatio) {
        const aspectMap = {
          '1:1': 'square format',
          '16:9': 'widescreen landscape format (16:9)',
          '4:3': 'standard landscape format (4:3)'
        }
        fullPrompt = `${request.prompt}\n\nGenerate in ${aspectMap[request.aspectRatio]}.`
      }

      // Request image generation
      // Note: responseModalities is a newer feature, using type assertion for compatibility
      const generateRequest = {
        contents: [
          {
            role: 'user' as const,
            parts: [{ text: fullPrompt }]
          }
        ],
        generationConfig: {
          // Enable image output - this is a newer Gemini 2.0 feature
          responseModalities: ['TEXT', 'IMAGE']
        }
      }

      const result = await model.generateContent(
        generateRequest as Parameters<typeof model.generateContent>[0]
      )

      const response = result.response

      // Extract image from response parts
      const candidates = response.candidates
      if (!candidates || candidates.length === 0) {
        throw this.createError(
          'PROVIDER_ERROR',
          'No response candidates from image generation',
          false
        )
      }

      const parts = candidates[0].content?.parts ?? []

      // Find the image part
      let imageBase64: string | null = null
      let mimeType = 'image/png'

      for (const part of parts) {
        // Check for inline data (base64 image)
        const partWithData = part as { inlineData?: { data: string; mimeType?: string } }
        if (partWithData.inlineData) {
          imageBase64 = partWithData.inlineData.data
          mimeType = partWithData.inlineData.mimeType ?? 'image/png'
          break
        }
      }

      if (!imageBase64) {
        throw this.createError(
          'PROVIDER_ERROR',
          'No image data in response. The model may not have generated an image for this prompt.',
          false
        )
      }

      return {
        imageBase64,
        mimeType,
        promptUsed: fullPrompt,
        model: modelId,
        provider: this.id
      }
    } catch (error) {
      // Re-throw if already an LLMError
      if (error && typeof error === 'object' && 'code' in error) {
        throw error
      }
      throw this.handleError(error)
    }
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message
    }
    return 'An unknown error occurred'
  }

  private handleError(error: unknown): never {
    if (error instanceof Error) {
      const message = error.message.toLowerCase()

      if (message.includes('api key') || message.includes('401') || message.includes('invalid key')) {
        throw this.createError('INVALID_API_KEY', 'Invalid Google API key', false, error)
      }

      // Be specific about rate limiting - check for actual rate limit indicators
      if (
        message.includes('429') ||
        message.includes('rate limit') ||
        message.includes('rate_limit') ||
        message.includes('quota exceeded') ||
        message.includes('resource_exhausted') ||
        message.includes('too many requests')
      ) {
        throw this.createError(
          'RATE_LIMITED',
          'Rate limited by Google. Please try again later.',
          true,
          error
        )
      }

      if (message.includes('context') || message.includes('too long') || message.includes('token limit')) {
        throw this.createError(
          'CONTEXT_LENGTH_EXCEEDED',
          'Request exceeds model context length',
          false,
          error
        )
      }

      if (message.includes('404') || message.includes('not found') || message.includes('does not exist')) {
        throw this.createError('MODEL_NOT_FOUND', `Model "${this.model}" not found`, false, error)
      }

      if (message.includes('network') || message.includes('econnrefused') || message.includes('enotfound')) {
        throw this.createError('NETWORK_ERROR', 'Network error connecting to Google', true, error)
      }

      // Pass through the actual error message for debugging
      throw this.createError('PROVIDER_ERROR', `Google API error: ${error.message}`, false, error)
    }

    throw this.createError('UNKNOWN_ERROR', 'An unknown error occurred', false, error)
  }
}
