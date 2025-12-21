/**
 * Anthropic Provider
 *
 * Implements the LLM provider interface for Anthropic's API.
 * Supports Claude 3.5, Claude 3 Opus, and other Claude models.
 */

import Anthropic from '@anthropic-ai/sdk'
import { AbstractLLMProvider } from './base.provider'
import { ANTHROPIC_MODELS } from '../../../../shared/types/llm.types'
import type {
  LLMRequest,
  LLMResponse,
  LLMStreamChunk,
  LLMConnectionTestResult,
  LLMModelInfo
} from '../../../../shared/types/llm.types'

export class AnthropicProvider extends AbstractLLMProvider {
  readonly id = 'anthropic' as const
  readonly name = 'Anthropic'
  readonly models: LLMModelInfo[] = ANTHROPIC_MODELS

  private client: Anthropic | null = null
  private defaultTemperature = 0.7
  private defaultMaxTokens = 4096

  constructor(apiKey: string | null, model: string = 'claude-3-5-sonnet-20241022') {
    super(apiKey, model)
    this.initClient()
  }

  private initClient(): void {
    if (this.apiKey) {
      this.client = new Anthropic({ apiKey: this.apiKey })
    } else {
      this.client = null
    }
  }

  override setApiKey(apiKey: string | null): void {
    super.setApiKey(apiKey)
    this.initClient()
  }

  async complete(request: LLMRequest): Promise<LLMResponse> {
    this.validateConfiguration()

    if (!this.client) {
      throw this.createError('NO_PROVIDER_CONFIGURED', 'Anthropic client not initialized')
    }

    const model = this.getRequestModel(request)
    const temperature = this.getRequestTemperature(request, this.defaultTemperature)
    const maxTokens = request.maxTokens ?? this.defaultMaxTokens

    try {
      const response = await this.client.messages.create({
        model,
        max_tokens: maxTokens,
        temperature,
        system: request.systemPrompt,
        messages: [{ role: 'user', content: request.prompt }]
      })

      // Extract text content from the response
      const textContent = response.content.find((block) => block.type === 'text')
      const content = textContent?.type === 'text' ? textContent.text : ''

      return {
        content,
        usage: {
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens,
          totalTokens: response.usage.input_tokens + response.usage.output_tokens
        },
        model: response.model,
        provider: this.id,
        finishReason: response.stop_reason ?? undefined
      }
    } catch (error) {
      throw this.handleError(error)
    }
  }

  async *stream(request: LLMRequest): AsyncGenerator<LLMStreamChunk> {
    this.validateConfiguration()

    if (!this.client) {
      throw this.createError('NO_PROVIDER_CONFIGURED', 'Anthropic client not initialized')
    }

    const model = this.getRequestModel(request)
    const temperature = this.getRequestTemperature(request, this.defaultTemperature)
    const maxTokens = request.maxTokens ?? this.defaultMaxTokens

    try {
      const stream = this.client.messages.stream({
        model,
        max_tokens: maxTokens,
        temperature,
        system: request.systemPrompt,
        messages: [{ role: 'user', content: request.prompt }]
      })

      let inputTokens = 0
      let outputTokens = 0

      for await (const event of stream) {
        if (event.type === 'message_start') {
          inputTokens = event.message.usage.input_tokens
        } else if (event.type === 'content_block_delta') {
          if (event.delta.type === 'text_delta') {
            yield {
              content: event.delta.text,
              done: false
            }
          }
        } else if (event.type === 'message_delta') {
          outputTokens = event.usage.output_tokens
          yield {
            content: '',
            done: true,
            usage: {
              inputTokens,
              outputTokens,
              totalTokens: inputTokens + outputTokens
            }
          }
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
    if (error instanceof Anthropic.APIError) {
      return error.message
    }
    if (error instanceof Error) {
      return error.message
    }
    return 'An unknown error occurred'
  }

  private handleError(error: unknown): never {
    if (error instanceof Anthropic.APIError) {
      const status = error.status

      if (status === 401) {
        throw this.createError('INVALID_API_KEY', 'Invalid Anthropic API key', false, error)
      }

      if (status === 429) {
        throw this.createError(
          'RATE_LIMITED',
          'Rate limited by Anthropic. Please try again later.',
          true,
          error
        )
      }

      if (status === 400 && error.message.includes('context')) {
        throw this.createError(
          'CONTEXT_LENGTH_EXCEEDED',
          'Request exceeds model context length',
          false,
          error
        )
      }

      if (status === 404) {
        throw this.createError('MODEL_NOT_FOUND', `Model "${this.model}" not found`, false, error)
      }

      throw this.createError('PROVIDER_ERROR', error.message, false, error)
    }

    if (error instanceof Error) {
      if (error.message.includes('network') || error.message.includes('ECONNREFUSED')) {
        throw this.createError(
          'NETWORK_ERROR',
          'Network error connecting to Anthropic',
          true,
          error
        )
      }
      throw this.createError('UNKNOWN_ERROR', error.message, false, error)
    }

    throw this.createError('UNKNOWN_ERROR', 'An unknown error occurred', false, error)
  }
}
