/**
 * Base LLM Provider Interface
 *
 * All LLM providers must implement this interface to ensure
 * consistent behavior across OpenAI, Anthropic, and Google.
 */

import type {
  LLMProviderType,
  LLMRequest,
  LLMResponse,
  LLMStreamChunk,
  LLMConnectionTestResult,
  LLMModelInfo,
  LLMError,
  ImageGenerationRequest,
  ImageGenerationResponse
} from '../../../../shared/types/llm.types'

/**
 * Base interface that all LLM providers must implement
 */
export interface BaseLLMProvider {
  /**
   * Provider identifier
   */
  readonly id: LLMProviderType

  /**
   * Human-readable provider name
   */
  readonly name: string

  /**
   * Available models for this provider
   */
  readonly models: LLMModelInfo[]

  /**
   * Check if the provider is configured with an API key
   */
  isConfigured(): boolean

  /**
   * Get the current API key (may be null)
   */
  getApiKey(): string | null

  /**
   * Set the API key for this provider
   */
  setApiKey(apiKey: string | null): void

  /**
   * Get the current model
   */
  getModel(): string

  /**
   * Set the model to use
   */
  setModel(model: string): void

  /**
   * Send a completion request and get a full response
   */
  complete(request: LLMRequest): Promise<LLMResponse>

  /**
   * Send a completion request and stream the response
   */
  stream(request: LLMRequest): AsyncGenerator<LLMStreamChunk>

  /**
   * Test the connection to verify API key and model work
   */
  testConnection(): Promise<LLMConnectionTestResult>

  /**
   * Generate an image (optional - only supported by some providers)
   * Currently only Google/Gemini supports this via gemini-2.5-flash-image model
   */
  generateImage?(request: ImageGenerationRequest): Promise<ImageGenerationResponse>

  /**
   * Check if this provider supports image generation
   */
  supportsImageGeneration(): boolean
}

/**
 * Abstract base class with common functionality
 */
export abstract class AbstractLLMProvider implements BaseLLMProvider {
  abstract readonly id: LLMProviderType
  abstract readonly name: string
  abstract readonly models: LLMModelInfo[]

  protected apiKey: string | null = null
  protected model: string = ''

  constructor(apiKey: string | null, model: string) {
    this.apiKey = apiKey
    this.model = model
  }

  isConfigured(): boolean {
    return this.apiKey !== null && this.apiKey.length > 0
  }

  getApiKey(): string | null {
    return this.apiKey
  }

  setApiKey(apiKey: string | null): void {
    this.apiKey = apiKey
  }

  getModel(): string {
    return this.model
  }

  setModel(model: string): void {
    this.model = model
  }

  abstract complete(request: LLMRequest): Promise<LLMResponse>
  abstract stream(request: LLMRequest): AsyncGenerator<LLMStreamChunk>
  abstract testConnection(): Promise<LLMConnectionTestResult>

  /**
   * Default: image generation not supported
   * Override in providers that support it (e.g., Google)
   */
  supportsImageGeneration(): boolean {
    return false
  }

  /**
   * Create a standardized LLM error
   */
  protected createError(
    code: LLMError['code'],
    message: string,
    retryable: boolean = false,
    details?: unknown
  ): LLMError {
    return {
      code,
      message,
      provider: this.id,
      retryable,
      details
    }
  }

  /**
   * Validate that the provider is configured before making a request
   */
  protected validateConfiguration(): void {
    if (!this.isConfigured()) {
      throw this.createError(
        'NO_PROVIDER_CONFIGURED',
        `${this.name} is not configured. Please add an API key.`
      )
    }
  }

  /**
   * Get the model to use for a request, with fallback to default
   */
  protected getRequestModel(request: LLMRequest): string {
    return request.model ?? this.model
  }

  /**
   * Get the temperature to use for a request, with fallback to default
   */
  protected getRequestTemperature(request: LLMRequest, defaultTemp: number): number {
    return request.temperature ?? defaultTemp
  }
}
