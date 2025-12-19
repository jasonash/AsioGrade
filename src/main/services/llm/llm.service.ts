/**
 * LLM Service
 *
 * Provider-agnostic LLM abstraction layer that manages multiple providers
 * (OpenAI, Anthropic, Google) and provides a unified interface for
 * text completion, streaming, and connection testing.
 */

import { storageService } from '../storage.service'
import { BaseLLMProvider } from './providers/base.provider'
import { OpenAIProvider } from './providers/openai.provider'
import { AnthropicProvider } from './providers/anthropic.provider'
import { GoogleProvider } from './providers/google.provider'
import {
  LLMProviderType,
  LLMRequest,
  LLMResponse,
  LLMStreamChunk,
  LLMConnectionTestResult,
  LLMProviderStatus,
  LLMError,
  getModelsForProvider,
  getProviderName
} from '../../../shared/types/llm.types'
import { ServiceResult } from '../../../shared/types/common.types'

class LLMService {
  private providers: Map<LLMProviderType, BaseLLMProvider> = new Map()

  constructor() {
    this.initProviders()
  }

  /**
   * Initialize providers with stored configuration
   */
  private initProviders(): void {
    const config = storageService.getLLMProviders()

    this.providers.set(
      'openai',
      new OpenAIProvider(config.openai.apiKey, config.openai.model)
    )

    this.providers.set(
      'anthropic',
      new AnthropicProvider(config.anthropic.apiKey, config.anthropic.model)
    )

    this.providers.set(
      'google',
      new GoogleProvider(config.google.apiKey, config.google.model)
    )
  }

  /**
   * Refresh providers from storage (call after API key changes)
   */
  refreshProviders(): void {
    const config = storageService.getLLMProviders()

    const openai = this.providers.get('openai')
    if (openai) {
      openai.setApiKey(config.openai.apiKey)
      openai.setModel(config.openai.model)
    }

    const anthropic = this.providers.get('anthropic')
    if (anthropic) {
      anthropic.setApiKey(config.anthropic.apiKey)
      anthropic.setModel(config.anthropic.model)
    }

    const google = this.providers.get('google')
    if (google) {
      google.setApiKey(config.google.apiKey)
      google.setModel(config.google.model)
    }
  }

  /**
   * Get a specific provider
   */
  private getProvider(providerId: LLMProviderType): BaseLLMProvider {
    const provider = this.providers.get(providerId)
    if (!provider) {
      throw this.createError('PROVIDER_ERROR', `Provider ${providerId} not found`)
    }
    return provider
  }

  /**
   * Get the default provider, or first configured provider
   */
  private getDefaultProvider(): BaseLLMProvider {
    const config = storageService.getLLMProviders()

    // Try the configured default
    if (config.default) {
      const defaultProvider = this.providers.get(config.default)
      if (defaultProvider?.isConfigured()) {
        return defaultProvider
      }
    }

    // Fallback to first configured provider
    for (const provider of this.providers.values()) {
      if (provider.isConfigured()) {
        return provider
      }
    }

    throw this.createError(
      'NO_PROVIDER_CONFIGURED',
      'No LLM provider is configured. Please add an API key in Settings.'
    )
  }

  /**
   * Send a completion request
   */
  async complete(request: LLMRequest): Promise<ServiceResult<LLMResponse>> {
    try {
      // Refresh providers to ensure latest API keys
      this.refreshProviders()

      const provider = request.provider
        ? this.getProvider(request.provider)
        : this.getDefaultProvider()

      const response = await provider.complete(request)
      return { success: true, data: response }
    } catch (error) {
      return {
        success: false,
        error: this.formatError(error)
      }
    }
  }

  /**
   * Stream a completion request
   */
  async *stream(request: LLMRequest): AsyncGenerator<LLMStreamChunk> {
    // Refresh providers to ensure latest API keys
    this.refreshProviders()

    const provider = request.provider
      ? this.getProvider(request.provider)
      : this.getDefaultProvider()

    yield* provider.stream(request)
  }

  /**
   * Test connection to a provider
   */
  async testConnection(providerId: LLMProviderType): Promise<ServiceResult<LLMConnectionTestResult>> {
    try {
      // Refresh providers to ensure latest API keys
      this.refreshProviders()

      const provider = this.getProvider(providerId)
      const result = await provider.testConnection()

      return { success: true, data: result }
    } catch (error) {
      return {
        success: false,
        error: this.formatError(error)
      }
    }
  }

  /**
   * Get status of all providers
   */
  getProviders(): ServiceResult<LLMProviderStatus[]> {
    try {
      // Refresh providers to ensure latest configuration
      this.refreshProviders()

      const config = storageService.getLLMProviders()
      const statuses: LLMProviderStatus[] = []

      for (const [id, provider] of this.providers) {
        statuses.push({
          id,
          name: getProviderName(id),
          configured: provider.isConfigured(),
          isDefault: config.default === id,
          models: getModelsForProvider(id),
          currentModel: provider.getModel()
        })
      }

      return { success: true, data: statuses }
    } catch (error) {
      return {
        success: false,
        error: this.formatError(error)
      }
    }
  }

  /**
   * Check if any provider is configured
   */
  hasConfiguredProvider(): boolean {
    for (const provider of this.providers.values()) {
      if (provider.isConfigured()) {
        return true
      }
    }
    return false
  }

  /**
   * Get the default provider type
   */
  getDefaultProviderType(): LLMProviderType | null {
    const config = storageService.getLLMProviders()
    return config.default
  }

  /**
   * Create a standardized error
   */
  private createError(code: LLMError['code'], message: string): LLMError {
    return {
      code,
      message,
      retryable: false
    }
  }

  /**
   * Format an error for the service result
   */
  private formatError(error: unknown): string {
    if (error && typeof error === 'object' && 'message' in error) {
      return (error as LLMError).message
    }
    if (error instanceof Error) {
      return error.message
    }
    return 'An unknown error occurred'
  }
}

// Singleton instance
export const llmService = new LLMService()
