/**
 * LLM Service
 *
 * Provider-agnostic LLM abstraction layer that manages multiple providers
 * (OpenAI, Anthropic, Google) and provides a unified interface for
 * text completion, streaming, and connection testing.
 */

import { storageService } from '../storage.service'
import type { BaseLLMProvider } from './providers/base.provider'
import { OpenAIProvider } from './providers/openai.provider'
import { AnthropicProvider } from './providers/anthropic.provider'
import { GoogleProvider } from './providers/google.provider'
import {
  getModelsForProvider,
  getProviderName
} from '../../../shared/types/llm.types'
import type {
  LLMProviderType,
  LLMRequest,
  LLMResponse,
  LLMStreamChunk,
  LLMConnectionTestResult,
  LLMProviderStatus,
  LLMError,
  ImageGenerationRequest,
  ImageGenerationResponse,
  VisionExtractionRequest,
  VisionExtractionResponse
} from '../../../shared/types/llm.types'
import type { ServiceResult } from '../../../shared/types/common.types'
import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'
import { GoogleGenerativeAI } from '@google/generative-ai'

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
   * Get info about the current default provider and model
   */
  getCurrentProviderInfo(): { provider: LLMProviderType; model: string } | null {
    const config = storageService.getLLMProviders()
    if (!config.default) return null

    const providerConfig = config[config.default]
    return {
      provider: config.default,
      model: providerConfig.model
    }
  }

  /**
   * Check if image generation is available (Google provider configured)
   */
  supportsImageGeneration(): boolean {
    this.refreshProviders()
    const google = this.providers.get('google')
    return Boolean(google?.isConfigured() && google.supportsImageGeneration())
  }

  /**
   * Generate an image using Gemini
   * Currently only Google provider supports this
   */
  async generateImage(
    request: ImageGenerationRequest
  ): Promise<ServiceResult<ImageGenerationResponse>> {
    try {
      this.refreshProviders()

      // Image generation only supported by Google/Gemini
      const providerId = request.provider ?? 'google'
      if (providerId !== 'google') {
        return {
          success: false,
          error: 'Image generation is only supported by Google/Gemini provider'
        }
      }

      const provider = this.getProvider('google')

      if (!provider.isConfigured()) {
        return {
          success: false,
          error: 'Google/Gemini API key is not configured. Please add an API key in Settings.'
        }
      }

      if (!provider.supportsImageGeneration()) {
        return {
          success: false,
          error: 'Image generation is not supported by this provider'
        }
      }

      // Type assertion since we know Google provider has generateImage
      const response = await provider.generateImage!(request)
      return { success: true, data: response }
    } catch (error) {
      return {
        success: false,
        error: this.formatError(error)
      }
    }
  }

  /**
   * Extract text from an image using vision capabilities
   * All three providers (OpenAI GPT-4o, Anthropic Claude, Google Gemini) support vision
   */
  async extractTextFromImage(
    request: VisionExtractionRequest
  ): Promise<ServiceResult<VisionExtractionResponse>> {
    try {
      this.refreshProviders()

      const config = storageService.getLLMProviders()
      let providerId = request.provider ?? config.default

      // If no default set, find any configured provider
      if (!providerId) {
        const providerTypes: LLMProviderType[] = ['openai', 'anthropic', 'google']
        for (const type of providerTypes) {
          const provider = this.providers.get(type)
          if (provider?.isConfigured()) {
            providerId = type
            break
          }
        }
      }

      if (!providerId) {
        return {
          success: false,
          error: 'No LLM provider configured. Please add an API key in Settings.'
        }
      }

      const provider = this.providers.get(providerId)
      if (!provider?.isConfigured()) {
        return {
          success: false,
          error: `${getProviderName(providerId)} is not configured. Please add an API key in Settings.`
        }
      }

      const prompt = request.prompt ??
        'Extract all text from this image. Preserve the original formatting, paragraphs, and structure as much as possible. If there are tables, lists, or special formatting, represent them clearly. Only output the extracted text, no additional commentary.'

      let extractedText: string
      const model = provider.getModel()

      // Call the appropriate provider's vision API
      if (providerId === 'anthropic') {
        const anthropicClient = new Anthropic({ apiKey: provider.getApiKey()! })
        const response = await anthropicClient.messages.create({
          model,
          max_tokens: 4096,
          messages: [{
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: request.mimeType,
                  data: request.imageBase64
                }
              },
              { type: 'text', text: prompt }
            ]
          }]
        })
        const textContent = response.content.find(block => block.type === 'text')
        extractedText = textContent?.type === 'text' ? textContent.text : ''

      } else if (providerId === 'openai') {
        const openaiClient = new OpenAI({ apiKey: provider.getApiKey()! })
        const response = await openaiClient.chat.completions.create({
          model,
          max_tokens: 4096,
          messages: [{
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: {
                  url: `data:${request.mimeType};base64,${request.imageBase64}`
                }
              },
              { type: 'text', text: prompt }
            ]
          }]
        })
        extractedText = response.choices[0]?.message?.content ?? ''

      } else if (providerId === 'google') {
        const googleClient = new GoogleGenerativeAI(provider.getApiKey()!)
        const genModel = googleClient.getGenerativeModel({ model })
        const response = await genModel.generateContent([
          {
            inlineData: {
              mimeType: request.mimeType,
              data: request.imageBase64
            }
          },
          prompt
        ])
        extractedText = response.response.text()

      } else {
        return {
          success: false,
          error: `Unsupported provider for vision: ${providerId}`
        }
      }

      return {
        success: true,
        data: {
          extractedText,
          model,
          provider: providerId
        }
      }
    } catch (error) {
      console.error('Vision extraction error:', error)
      return {
        success: false,
        error: this.formatError(error)
      }
    }
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
