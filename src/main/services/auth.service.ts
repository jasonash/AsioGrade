import { google } from 'googleapis'
import { OAuth2Client, Credentials } from 'google-auth-library'
import { shell, BrowserWindow, app } from 'electron'
import * as http from 'http'
import * as fs from 'fs'
import * as path from 'path'
import { URL } from 'url'
import { storageService } from './storage.service'
import type { UserInfo, OAuthTokens } from './storage.service'

// OAuth configuration interface
interface OAuthConfig {
  clientId: string
  clientSecret: string
  redirectUri: string
}

/**
 * Load OAuth credentials from config file or environment variables
 * Priority: config/oauth.json > environment variables
 */
function loadOAuthConfig(): OAuthConfig {
  const redirectUri = 'http://localhost:8089/oauth/callback'

  // Try to load from config file first
  const configPaths = [
    // Development: project root
    path.join(process.cwd(), 'config', 'oauth.json'),
    // Production: in extraResources folder (macOS/Linux)
    path.join(process.resourcesPath ?? '', 'config', 'oauth.json'),
    // Production: next to the app executable
    path.join(app.getAppPath(), 'config', 'oauth.json'),
    // Production: in resources folder
    path.join(app.getAppPath(), '..', 'config', 'oauth.json')
  ]

  for (const configPath of configPaths) {
    try {
      if (fs.existsSync(configPath)) {
        const configData = fs.readFileSync(configPath, 'utf-8')
        const config = JSON.parse(configData) as { clientId?: string; clientSecret?: string }

        if (config.clientId && config.clientSecret) {
          console.log(`Loaded OAuth config from: ${configPath}`)
          return {
            clientId: config.clientId,
            clientSecret: config.clientSecret,
            redirectUri
          }
        }
      }
    } catch {
      // Continue to next path or fallback
    }
  }

  // Fallback to environment variables
  console.log('OAuth config file not found, using environment variables')
  return {
    clientId: process.env['GOOGLE_CLIENT_ID'] ?? '',
    clientSecret: process.env['GOOGLE_CLIENT_SECRET'] ?? '',
    redirectUri
  }
}

// Load OAuth configuration
const OAUTH_CONFIG = loadOAuthConfig()

// Required OAuth scopes for TeachingHelp
const OAUTH_SCOPES = [
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/drive.file', // Access app-created files
  'https://www.googleapis.com/auth/spreadsheets' // Write grades to sheets
]

export interface AuthResult {
  success: boolean
  user?: UserInfo
  error?: string
}

class AuthService {
  private oauth2Client: OAuth2Client
  private callbackServer: http.Server | null = null

  constructor() {
    this.oauth2Client = new google.auth.OAuth2(
      OAUTH_CONFIG.clientId,
      OAUTH_CONFIG.clientSecret,
      OAUTH_CONFIG.redirectUri
    )

    // Set up token refresh handler
    this.oauth2Client.on('tokens', (tokens) => {
      this.handleTokenRefresh(tokens)
    })

    // Load existing tokens if available
    this.loadStoredTokens()
  }

  private loadStoredTokens(): void {
    const tokens = storageService.getTokens()
    if (tokens) {
      this.oauth2Client.setCredentials({
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken,
        expiry_date: tokens.expiresAt
      })
    }
  }

  private handleTokenRefresh(tokens: Credentials): void {
    const currentTokens = storageService.getTokens()
    if (currentTokens && tokens.access_token) {
      const updatedTokens: OAuthTokens = {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token ?? currentTokens.refreshToken,
        expiresAt: tokens.expiry_date ?? Date.now() + 3600 * 1000,
        scope: currentTokens.scope
      }
      storageService.setTokens(updatedTokens)
    }
  }

  /**
   * Check if OAuth is properly configured
   */
  isConfigured(): boolean {
    return Boolean(OAUTH_CONFIG.clientId && OAUTH_CONFIG.clientSecret)
  }

  /**
   * Check if user is authenticated with valid tokens
   */
  isAuthenticated(): boolean {
    const tokens = storageService.getTokens()
    const user = storageService.getUser()
    return Boolean(tokens && user && !storageService.isTokenExpired())
  }

  /**
   * Check if we have a refresh token stored (for token refresh attempts)
   */
  hasRefreshToken(): boolean {
    const tokens = storageService.getTokens()
    return Boolean(tokens?.refreshToken)
  }

  /**
   * Get current user info
   */
  getCurrentUser(): UserInfo | null {
    return storageService.getUser()
  }

  /**
   * Get a valid access token, refreshing if necessary
   */
  async getAccessToken(): Promise<string | null> {
    const tokens = storageService.getTokens()
    if (!tokens) return null

    if (storageService.isTokenExpired()) {
      try {
        await this.refreshToken()
      } catch {
        return null
      }
    }

    return storageService.getTokens()?.accessToken ?? null
  }

  /**
   * Refresh the access token using the refresh token
   */
  async refreshToken(): Promise<void> {
    const tokens = storageService.getTokens()
    if (!tokens?.refreshToken) {
      throw new Error('No refresh token available')
    }

    this.oauth2Client.setCredentials({
      refresh_token: tokens.refreshToken
    })

    const { credentials } = await this.oauth2Client.refreshAccessToken()

    const updatedTokens: OAuthTokens = {
      accessToken: credentials.access_token ?? '',
      refreshToken: credentials.refresh_token ?? tokens.refreshToken,
      expiresAt: credentials.expiry_date ?? Date.now() + 3600 * 1000,
      scope: tokens.scope
    }

    storageService.setTokens(updatedTokens)
    this.oauth2Client.setCredentials(credentials)
  }

  /**
   * Start the OAuth login flow
   * Opens the browser for Google sign-in and waits for callback
   */
  async login(): Promise<AuthResult> {
    if (!this.isConfigured()) {
      return {
        success: false,
        error: 'OAuth not configured. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables.'
      }
    }

    try {
      // Generate the auth URL
      const authUrl = this.oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: OAUTH_SCOPES,
        prompt: 'consent' // Force consent to get refresh token
      })

      // Start local server to receive callback (don't await yet)
      const authCodePromise = this.startCallbackServer()

      // Open browser for authentication
      await shell.openExternal(authUrl)

      // Now wait for the auth code from callback
      const code = await authCodePromise

      // Exchange code for tokens
      const { tokens } = await this.oauth2Client.getToken(code)
      this.oauth2Client.setCredentials(tokens)

      // Get user info
      const oauth2 = google.oauth2({ version: 'v2', auth: this.oauth2Client })
      const userInfoResponse = await oauth2.userinfo.get()
      const userInfo = userInfoResponse.data

      const user: UserInfo = {
        id: userInfo.id ?? '',
        email: userInfo.email ?? '',
        name: userInfo.name ?? '',
        picture: userInfo.picture ?? undefined
      }

      // Store tokens and user info
      const oauthTokens: OAuthTokens = {
        accessToken: tokens.access_token ?? '',
        refreshToken: tokens.refresh_token ?? '',
        expiresAt: tokens.expiry_date ?? Date.now() + 3600 * 1000,
        scope: OAUTH_SCOPES
      }

      storageService.setTokens(oauthTokens)
      storageService.setUser(user)

      return { success: true, user }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Login failed'
      return { success: false, error: message }
    } finally {
      this.stopCallbackServer()
    }
  }

  /**
   * Log out and clear stored credentials
   */
  async logout(): Promise<void> {
    // Revoke the access token if possible
    const tokens = storageService.getTokens()
    if (tokens?.accessToken) {
      try {
        await this.oauth2Client.revokeToken(tokens.accessToken)
      } catch {
        // Ignore revocation errors - token might already be invalid
      }
    }

    // Clear stored credentials
    storageService.clearAuth()
    this.oauth2Client.setCredentials({})
  }

  /**
   * Start a local HTTP server to receive the OAuth callback
   */
  private startCallbackServer(): Promise<string> {
    return new Promise((resolve, reject) => {
      this.callbackServer = http.createServer((req, res) => {
        const url = new URL(req.url ?? '', OAUTH_CONFIG.redirectUri)

        if (url.pathname === '/oauth/callback') {
          const code = url.searchParams.get('code')
          const error = url.searchParams.get('error')

          if (error) {
            res.writeHead(400, { 'Content-Type': 'text/html' })
            res.end(this.getErrorPage(error))
            reject(new Error(`OAuth error: ${error}`))
            return
          }

          if (code) {
            res.writeHead(200, { 'Content-Type': 'text/html' })
            res.end(this.getSuccessPage())
            resolve(code)
            return
          }

          res.writeHead(400, { 'Content-Type': 'text/html' })
          res.end(this.getErrorPage('No authorization code received'))
          reject(new Error('No authorization code received'))
        } else {
          res.writeHead(404)
          res.end('Not found')
        }
      })

      this.callbackServer.listen(8089, 'localhost', () => {
        // Server is ready
      })

      this.callbackServer.on('error', (error) => {
        reject(error)
      })

      // Timeout after 5 minutes
      setTimeout(() => {
        reject(new Error('OAuth timeout - no response received'))
        this.stopCallbackServer()
      }, 5 * 60 * 1000)
    })
  }

  private stopCallbackServer(): void {
    if (this.callbackServer) {
      this.callbackServer.close()
      this.callbackServer = null
    }
  }

  private getSuccessPage(): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <title>TeachingHelp - Login Successful</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              display: flex;
              justify-content: center;
              align-items: center;
              height: 100vh;
              margin: 0;
              background: linear-gradient(135deg, #1e3a5f 0%, #2d5a87 100%);
              color: white;
            }
            .container {
              text-align: center;
              padding: 40px;
              background: rgba(255,255,255,0.1);
              border-radius: 12px;
              backdrop-filter: blur(10px);
            }
            h1 { margin-bottom: 16px; }
            p { opacity: 0.9; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>Login Successful!</h1>
            <p>You can close this window and return to TeachingHelp.</p>
          </div>
          <script>setTimeout(() => window.close(), 3000);</script>
        </body>
      </html>
    `
  }

  private getErrorPage(error: string): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <title>TeachingHelp - Login Failed</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              display: flex;
              justify-content: center;
              align-items: center;
              height: 100vh;
              margin: 0;
              background: linear-gradient(135deg, #5f1e1e 0%, #872d2d 100%);
              color: white;
            }
            .container {
              text-align: center;
              padding: 40px;
              background: rgba(255,255,255,0.1);
              border-radius: 12px;
              backdrop-filter: blur(10px);
            }
            h1 { margin-bottom: 16px; }
            p { opacity: 0.9; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>Login Failed</h1>
            <p>${error}</p>
            <p>Please close this window and try again.</p>
          </div>
        </body>
      </html>
    `
  }

  /**
   * Get the OAuth2 client for use by other services (e.g., DriveService)
   */
  getOAuth2Client(): OAuth2Client {
    return this.oauth2Client
  }

  /**
   * Send auth status update to all windows
   */
  broadcastAuthStatus(mainWindow: BrowserWindow | null): void {
    const user = this.getCurrentUser()
    const isAuthenticated = this.isAuthenticated()

    mainWindow?.webContents.send('auth:statusChanged', {
      isAuthenticated,
      user
    })
  }
}

// Singleton instance
export const authService = new AuthService()
