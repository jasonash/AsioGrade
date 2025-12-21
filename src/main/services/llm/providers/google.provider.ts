/**
 * Google Provider
 *
 * Implements the LLM provider interface for Google's Gemini API.
 * Supports Gemini Pro, Gemini 1.5 Pro, and Gemini 1.5 Flash models.
 */

import { GoogleGenerativeAI } from '@google/generative-ai'
import { AbstractLLMProvider } from './base.provider'
import { GOOGLE_MODELS } from '../../../../shared/types/llm.types'
import type {
  LLMRequest,
  LLMResponse,
  LLMStreamChunk,
  LLMConnectionTestResult,
  LLMModelInfo
} from '../../../../shared/types/llm.types'

export class GoogleProvider extends AbstractLLMProvider {
  readonly id = 'google' as const
  readonly name = 'Google'
  readonly models: LLMModelInfo[] = GOOGLE_MODELS

  private client: GoogleGenerativeAI | null = null
  private defaultTemperature = 0.7

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

  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message
    }
    return 'An unknown error occurred'
  }

  private handleError(error: unknown): never {
    if (error instanceof Error) {
      const message = error.message.toLowerCase()

      if (message.includes('api key') || message.includes('401') || message.includes('invalid')) {
        throw this.createError('INVALID_API_KEY', 'Invalid Google API key', false, error)
      }

      if (message.includes('429') || message.includes('rate') || message.includes('quota')) {
        throw this.createError(
          'RATE_LIMITED',
          'Rate limited by Google. Please try again later.',
          true,
          error
        )
      }

      if (message.includes('context') || message.includes('too long')) {
        throw this.createError(
          'CONTEXT_LENGTH_EXCEEDED',
          'Request exceeds model context length',
          false,
          error
        )
      }

      if (message.includes('404') || message.includes('not found')) {
        throw this.createError('MODEL_NOT_FOUND', `Model "${this.model}" not found`, false, error)
      }

      if (message.includes('network') || message.includes('econnrefused')) {
        throw this.createError('NETWORK_ERROR', 'Network error connecting to Google', true, error)
      }

      throw this.createError('PROVIDER_ERROR', error.message, false, error)
    }

    throw this.createError('UNKNOWN_ERROR', 'An unknown error occurred', false, error)
  }
}
