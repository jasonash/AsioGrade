# Software Licensing Implementation Plan

**Status:** Planning / Not Yet Implemented
**Goal:** One-time purchase license to recoup development effort

---

## Overview

Implement a simple license key system using a third-party service (Gumroad or LemonSqueezy) to handle payments and key generation. The app validates the key once and stores the activation locally.

---

## Platform Comparison

| Feature | Gumroad | LemonSqueezy |
|---------|---------|--------------|
| Fee | 10% flat | 5% + 50¢ |
| License key API | Yes | Yes |
| UI/UX | Dated but functional | Modern |
| Tax handling | Basic | Better (EU VAT, etc.) |
| Popularity | Very established | Newer, growing |
| Payout | PayPal, Stripe | Stripe, PayPal |

**Recommendation:** LemonSqueezy has better fees and modern tooling, but Gumroad is more battle-tested. Either works fine.

---

## User Flow

```
┌─────────────────────────────────────────────────────────┐
│                      PURCHASE FLOW                       │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  1. User discovers app (website, word of mouth)         │
│                         │                               │
│                         ▼                               │
│  2. User purchases on Gumroad/LemonSqueezy              │
│     - Enters payment info                               │
│     - Receives license key via email                    │
│                         │                               │
│                         ▼                               │
│  3. User downloads app (from website or purchase page)  │
│                         │                               │
│                         ▼                               │
│  4. User opens app → sees "Enter License Key" prompt    │
│                         │                               │
│                         ▼                               │
│  5. User enters key → App validates via API             │
│                         │                               │
│                         ▼                               │
│  6. Success → Key stored locally → Full access          │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## App Behavior Options

### Option A: Hard Gate (Simpler)
- App shows license entry screen on first launch
- Cannot proceed without valid key
- Simplest to implement

### Option B: Trial Mode (More User-Friendly)
- App works fully for X days (e.g., 14 days)
- Or limited features (e.g., 1 course only)
- After trial, requires key to continue
- Better conversion but more complex

**Recommendation:** Start with Option A. Add trial later if needed.

---

## Implementation Steps

### Step 1: Set Up Payment Platform

1. Create account on Gumroad or LemonSqueezy
2. Create a product for TeachingHelp
3. Enable license key generation
4. Set up product page with description, screenshots
5. Note your API credentials

### Step 2: Create License Service (Main Process)

**New file:** `src/main/services/license.service.ts`

```typescript
import { storageService } from './storage.service'
import { net } from 'electron'

interface LicenseInfo {
  key: string
  email: string
  activatedAt: string
  valid: boolean
}

class LicenseService {
  private readonly LICENSE_KEY = 'license_info'

  /**
   * Check if app is licensed
   */
  isLicensed(): boolean {
    const license = storageService.get(this.LICENSE_KEY) as LicenseInfo | null
    return license?.valid === true
  }

  /**
   * Get stored license info
   */
  getLicenseInfo(): LicenseInfo | null {
    return storageService.get(this.LICENSE_KEY) as LicenseInfo | null
  }

  /**
   * Validate a license key with the licensing server
   */
  async validateKey(licenseKey: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Example for LemonSqueezy - adjust for your platform
      const response = await fetch('https://api.lemonsqueezy.com/v1/licenses/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          license_key: licenseKey,
        }),
      })

      const data = await response.json()

      if (data.valid) {
        // Store the validated license
        const licenseInfo: LicenseInfo = {
          key: licenseKey,
          email: data.meta?.customer_email ?? '',
          activatedAt: new Date().toISOString(),
          valid: true,
        }
        storageService.set(this.LICENSE_KEY, licenseInfo)
        return { success: true }
      } else {
        return { success: false, error: 'Invalid license key' }
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Validation failed'
      }
    }
  }

  /**
   * Clear stored license (for testing or deactivation)
   */
  clearLicense(): void {
    storageService.delete(this.LICENSE_KEY)
  }
}

export const licenseService = new LicenseService()
```

### Step 3: Add IPC Handlers

**Update:** `src/main/ipc/handlers.ts`

```typescript
// Add to handler registration
ipcMain.handle('license:check', () => {
  return licenseService.isLicensed()
})

ipcMain.handle('license:validate', async (_, key: string) => {
  return licenseService.validateKey(key)
})

ipcMain.handle('license:info', () => {
  return licenseService.getLicenseInfo()
})
```

### Step 4: Update Preload

**Update:** `src/preload/index.ts`

```typescript
// Add to validInvokeChannels
'license:check',
'license:validate',
'license:info',
```

### Step 5: Create License Entry UI

**New file:** `src/renderer/src/pages/LicenseActivationPage.tsx`

```typescript
import { useState } from 'react'
import Box from '@mui/material/Box'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import Alert from '@mui/material/Alert'
import Paper from '@mui/material/Paper'

interface LicenseActivationPageProps {
  onActivated: () => void
}

export function LicenseActivationPage({ onActivated }: LicenseActivationPageProps) {
  const [licenseKey, setLicenseKey] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isValidating, setIsValidating] = useState(false)

  const handleActivate = async () => {
    if (!licenseKey.trim()) {
      setError('Please enter a license key')
      return
    }

    setIsValidating(true)
    setError(null)

    const result = await window.api.invoke('license:validate', licenseKey.trim())

    setIsValidating(false)

    if (result.success) {
      onActivated()
    } else {
      setError(result.error ?? 'Invalid license key')
    }
  }

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        bgcolor: 'background.default',
      }}
    >
      <Paper sx={{ p: 4, maxWidth: 400, width: '100%' }}>
        <Typography variant="h5" fontWeight={700} gutterBottom>
          Activate TeachingHelp
        </Typography>

        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Enter your license key to activate the app. You received this key
          via email after purchase.
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <TextField
          fullWidth
          label="License Key"
          value={licenseKey}
          onChange={(e) => setLicenseKey(e.target.value)}
          placeholder="XXXX-XXXX-XXXX-XXXX"
          sx={{ mb: 2 }}
        />

        <Button
          fullWidth
          variant="contained"
          onClick={handleActivate}
          disabled={isValidating}
        >
          {isValidating ? 'Validating...' : 'Activate'}
        </Button>

        <Typography variant="body2" color="text.secondary" sx={{ mt: 3, textAlign: 'center' }}>
          Don't have a license?{' '}
          <a href="https://your-store-url.com" target="_blank" rel="noopener">
            Purchase here
          </a>
        </Typography>
      </Paper>
    </Box>
  )
}
```

### Step 6: Gate the App

**Update:** `src/renderer/src/App.tsx`

```typescript
import { useEffect, useState } from 'react'
import { LicenseActivationPage } from './pages/LicenseActivationPage'

function App() {
  const [isLicensed, setIsLicensed] = useState<boolean | null>(null)

  useEffect(() => {
    // Check license on app start
    window.api.invoke('license:check').then(setIsLicensed)
  }, [])

  // Still checking
  if (isLicensed === null) {
    return <LoadingScreen />
  }

  // Not licensed - show activation
  if (!isLicensed) {
    return <LicenseActivationPage onActivated={() => setIsLicensed(true)} />
  }

  // Licensed - show normal app
  return <MainApp />
}
```

---

## Pricing Considerations

### Market Research (Education Tools)
- Simple utilities: $19-39
- Comprehensive tools: $49-99
- Premium/professional: $149+

### Suggested Pricing for TeachingHelp
- **$49** - Fair price for a comprehensive tool
- Consider **$39 launch price** to build initial user base
- **Educational discount** (10-20%) - teachers expect and appreciate this

### Pricing Psychology
- Avoid $50 (feels expensive), $49 feels better
- Round numbers ($50, $100) feel more premium
- Odd numbers ($47, $67) feel more calculated/value-oriented

---

## Security Considerations

### What This Approach Protects Against
- Casual sharing (key only works once or limited activations)
- Accidental piracy (makes honest path easy)

### What This Doesn't Protect Against
- Determined crackers (but this is a niche education app)
- Code modification (Electron apps are JavaScript)

### Practical Reality
- Niche apps rarely have piracy problems
- Teachers aren't the piracy demographic
- Time spent on anti-piracy > time spent making app better
- A cracked copy in the hands of someone who wouldn't pay anyway costs you nothing

**Recommendation:** Implement basic validation and don't overthink it.

---

## Optional Enhancements (Later)

### Machine Locking
- Tie license to hardware fingerprint
- Limit activations (e.g., 2 machines per key)
- More complex but prevents casual sharing

### Offline Grace Period
- Allow app to work offline for X days
- Re-validate when online
- Better UX for spotty internet

### License Tiers
- Basic: Core features
- Pro: AI features, advanced analytics
- More revenue potential but more complexity

### Subscription Model
- Monthly/yearly recurring
- Harder to pirate, predictable revenue
- But users often prefer one-time

---

## Implementation Checklist

- [ ] Choose platform (Gumroad vs LemonSqueezy)
- [ ] Create account and product
- [ ] Set up product page with description/screenshots
- [ ] Implement license.service.ts
- [ ] Add IPC handlers
- [ ] Create LicenseActivationPage component
- [ ] Update App.tsx to gate on license
- [ ] Test full purchase → activation flow
- [ ] Create simple marketing website
- [ ] Announce/launch

---

## Questions to Decide

1. **Which platform?** Gumroad (established) vs LemonSqueezy (modern, lower fees)
2. **Price point?** Suggest $49, maybe $39 launch
3. **Hard gate or trial?** Suggest hard gate to start
4. **Activation limit?** Suggest 2-3 machines per key
5. **Educational discount?** Suggest yes, 15-20%

---

## Resources

- [Gumroad License Keys API](https://help.gumroad.com/article/76-license-keys)
- [LemonSqueezy License API](https://docs.lemonsqueezy.com/api/license-keys)
- [Electron Security Best Practices](https://www.electronjs.org/docs/latest/tutorial/security)
