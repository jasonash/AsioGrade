/**
 * OpenAI Provider
 *
 * Implements the LLM provider interface for OpenAI's API.
 * Supports GPT-4, GPT-4 Turbo, and GPT-4o models.
 */

import OpenAI from 'openai'
import { AbstractLLMProvider } from './base.provider'
import {
  LLMRequest,
  LLMResponse,
  LLMStreamChunk,
  LLMConnectionTestResult,
  OPENAI_MODELS,
  LLMModelInfo
} from '../../../../shared/types/llm.types'

export class OpenAIProvider extends AbstractLLMProvider {
  readonly id = 'openai' as const
  readonly name = 'OpenAI'
  readonly models: LLMModelInfo[] = OPENAI_MODELS

  private client: OpenAI | null = null
  private defaultTemperature = 0.7

  constructor(apiKey: string | null, model: string = 'gpt-4o') {
    super(apiKey, model)
    this.initClient()
  }

  private initClient(): void {
    if (this.apiKey) {
      this.client = new OpenAI({ apiKey: this.apiKey })
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
      throw this.createError('NO_PROVIDER_CONFIGURED', 'OpenAI client not initialized')
    }

    const model = this.getRequestModel(request)
    const temperature = this.getRequestTemperature(request, this.defaultTemperature)

    try {
      const messages: OpenAI.ChatCompletionMessageParam[] = []

      if (request.systemPrompt) {
        messages.push({ role: 'system', content: request.systemPrompt })
      }

      messages.push({ role: 'user', content: request.prompt })

      const response = await this.client.chat.completions.create({
        model,
        messages,
        max_tokens: request.maxTokens,
        temperature
      })

      const choice = response.choices[0]
      const content = choice?.message?.content ?? ''

      return {
        content,
        usage: {
          inputTokens: response.usage?.prompt_tokens ?? 0,
          outputTokens: response.usage?.completion_tokens ?? 0,
          totalTokens: response.usage?.total_tokens ?? 0
        },
        model: response.model,
        provider: this.id,
        finishReason: choice?.finish_reason ?? undefined
      }
    } catch (error) {
      throw this.handleError(error)
    }
  }

  async *stream(request: LLMRequest): AsyncGenerator<LLMStreamChunk> {
    this.validateConfiguration()

    if (!this.client) {
      throw this.createError('NO_PROVIDER_CONFIGURED', 'OpenAI client not initialized')
    }

    const model = this.getRequestModel(request)
    const temperature = this.getRequestTemperature(request, this.defaultTemperature)

    try {
      const messages: OpenAI.ChatCompletionMessageParam[] = []

      if (request.systemPrompt) {
        messages.push({ role: 'system', content: request.systemPrompt })
      }

      messages.push({ role: 'user', content: request.prompt })

      const stream = await this.client.chat.completions.create({
        model,
        messages,
        max_tokens: request.maxTokens,
        temperature,
        stream: true,
        stream_options: { include_usage: true }
      })

      let totalInputTokens = 0
      let totalOutputTokens = 0

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content ?? ''
        const finishReason = chunk.choices[0]?.finish_reason

        // Update usage from final chunk
        if (chunk.usage) {
          totalInputTokens = chunk.usage.prompt_tokens
          totalOutputTokens = chunk.usage.completion_tokens
        }

        if (content || finishReason === 'stop') {
          yield {
            content,
            done: finishReason === 'stop',
            usage:
              finishReason === 'stop'
                ? {
                    inputTokens: totalInputTokens,
                    outputTokens: totalOutputTokens,
                    totalTokens: totalInputTokens + totalOutputTokens
                  }
                : undefined
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
    if (error instanceof OpenAI.APIError) {
      return error.message
    }
    if (error instanceof Error) {
      return error.message
    }
    return 'An unknown error occurred'
  }

  private handleError(error: unknown): never {
    if (error instanceof OpenAI.APIError) {
      const status = error.status

      if (status === 401) {
        throw this.createError('INVALID_API_KEY', 'Invalid OpenAI API key', false, error)
      }

      if (status === 429) {
        throw this.createError(
          'RATE_LIMITED',
          'Rate limited by OpenAI. Please try again later.',
          true,
          error
        )
      }

      if (status === 400 && error.message.includes('context_length')) {
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
        throw this.createError('NETWORK_ERROR', 'Network error connecting to OpenAI', true, error)
      }
      throw this.createError('UNKNOWN_ERROR', error.message, false, error)
    }

    throw this.createError('UNKNOWN_ERROR', 'An unknown error occurred', false, error)
  }
}
