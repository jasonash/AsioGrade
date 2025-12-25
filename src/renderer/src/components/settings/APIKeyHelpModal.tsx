import { type ReactElement } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Link from '@mui/material/Link'
import Stepper from '@mui/material/Stepper'
import Step from '@mui/material/Step'
import StepLabel from '@mui/material/StepLabel'
import StepContent from '@mui/material/StepContent'
import Alert from '@mui/material/Alert'
import Divider from '@mui/material/Divider'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import type { LLMProviderType } from '../../../../shared/types/llm.types'
import { getProviderName } from '../../../../shared/types/llm.types'

interface APIKeyHelpModalProps {
  isOpen: boolean
  onClose: () => void
  provider: LLMProviderType
}

interface ProviderGuide {
  url: string
  pricingUrl: string
  steps: Array<{
    label: string
    content: string
    tip?: string
  }>
  costInfo: string
  freeOption?: string
}

const providerGuides: Record<LLMProviderType, ProviderGuide> = {
  openai: {
    url: 'https://platform.openai.com/api-keys',
    pricingUrl: 'https://openai.com/api/pricing/',
    steps: [
      {
        label: 'Create an OpenAI account',
        content: 'Go to platform.openai.com and click "Sign up". You can use your email, Google account, or Microsoft account.',
        tip: 'Use your school email if your district has an existing OpenAI account.'
      },
      {
        label: 'Add payment method',
        content: 'Navigate to Settings > Billing and add a credit card. OpenAI requires a payment method before you can use the API.',
        tip: 'You can set a monthly spending limit to avoid unexpected charges.'
      },
      {
        label: 'Create an API key',
        content: 'Go to Settings > API Keys and click "Create new secret key". Give it a name like "TeachingHelp" so you remember what it\'s for.'
      },
      {
        label: 'Copy your API key',
        content: 'Copy the API key immediately - you won\'t be able to see it again! Paste it into TeachingHelp settings.',
        tip: 'Store a backup in a secure password manager.'
      }
    ],
    costInfo: 'OpenAI charges based on usage. GPT-4o costs approximately $2.50-$10 per 1M tokens (roughly 750,000 words). Typical lesson planning uses a few cents per request.',
    freeOption: 'New accounts may receive $5-18 in free credits.'
  },
  anthropic: {
    url: 'https://console.anthropic.com/settings/keys',
    pricingUrl: 'https://www.anthropic.com/pricing#anthropic-api',
    steps: [
      {
        label: 'Create an Anthropic account',
        content: 'Go to console.anthropic.com and click "Sign up". You\'ll need to verify your email address.',
      },
      {
        label: 'Add payment method',
        content: 'Go to Settings > Billing and add a credit card. Anthropic requires prepaid credits before API usage.',
        tip: 'Start with $5-10 in credits to test. You can add more later.'
      },
      {
        label: 'Create an API key',
        content: 'Navigate to Settings > API Keys and click "Create Key". Name it something memorable like "TeachingHelp".'
      },
      {
        label: 'Copy your API key',
        content: 'Copy the key immediately - it starts with "sk-ant-". Paste it into TeachingHelp settings.',
        tip: 'The key is only shown once. Save it in a secure location.'
      }
    ],
    costInfo: 'Anthropic charges based on usage. Claude 3.5 Sonnet costs approximately $3-15 per 1M tokens. Educational content generation typically costs a few cents per request.',
    freeOption: 'New accounts may receive limited free credits for testing.'
  },
  google: {
    url: 'https://aistudio.google.com/app/apikey',
    pricingUrl: 'https://ai.google.dev/pricing',
    steps: [
      {
        label: 'Sign in to Google AI Studio',
        content: 'Go to aistudio.google.com and sign in with your Google account. This is the same account you use for Gmail or Google Drive.',
        tip: 'Use your personal Google account. Some school accounts may have AI Studio disabled.'
      },
      {
        label: 'Create an API key',
        content: 'Click "Get API key" in the left sidebar, then "Create API key". You can create a key in a new or existing Google Cloud project.',
        tip: 'If prompted, you can create a new project called "TeachingHelp".'
      },
      {
        label: 'Copy your API key',
        content: 'Copy the API key that appears. It starts with "AIza". Paste it into TeachingHelp settings.'
      },
      {
        label: 'Enable the API (if needed)',
        content: 'If you see an error about the API not being enabled, click the link in the error message to enable the Generative Language API.',
        tip: 'This is a one-time setup step.'
      }
    ],
    costInfo: 'Google offers generous free tiers. Gemini 1.5 Flash is free up to 15 requests/minute. Gemini 1.5 Pro has a free tier of 50 requests/day.',
    freeOption: 'Google Gemini has the most generous free tier - perfect for getting started without any cost!'
  }
}

export function APIKeyHelpModal({ isOpen, onClose, provider }: APIKeyHelpModalProps): ReactElement {
  const guide = providerGuides[provider]
  const providerName = getProviderName(provider)

  const handleOpenLink = (url: string): void => {
    window.electronAPI.invoke('shell:openExternal', url)
  }

  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{ sx: { maxHeight: '85vh' } }}
    >
      <DialogTitle sx={{ pb: 1 }}>
        <Typography variant="h6" fontWeight={600}>
          How to Get a {providerName} API Key
        </Typography>
      </DialogTitle>

      <DialogContent dividers>
        {/* Quick link to provider */}
        <Box sx={{ mb: 3 }}>
          <Button
            variant="contained"
            endIcon={<OpenInNewIcon />}
            onClick={() => handleOpenLink(guide.url)}
            fullWidth
          >
            Open {providerName} API Keys Page
          </Button>
        </Box>

        {/* Free tier notice for Google */}
        {guide.freeOption && (
          <Alert severity="success" sx={{ mb: 3 }}>
            {guide.freeOption}
          </Alert>
        )}

        {/* Step-by-step guide */}
        <Typography variant="subtitle2" fontWeight={600} gutterBottom>
          Step-by-Step Guide
        </Typography>

        <Stepper orientation="vertical" sx={{ mb: 3 }}>
          {guide.steps.map((step, index) => (
            <Step key={index} active expanded>
              <StepLabel>
                <Typography fontWeight={500}>{step.label}</Typography>
              </StepLabel>
              <StepContent>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  {step.content}
                </Typography>
                {step.tip && (
                  <Alert severity="info" sx={{ py: 0.5 }}>
                    <Typography variant="body2">{step.tip}</Typography>
                  </Alert>
                )}
              </StepContent>
            </Step>
          ))}
        </Stepper>

        <Divider sx={{ my: 2 }} />

        {/* Cost information */}
        <Typography variant="subtitle2" fontWeight={600} gutterBottom>
          Pricing Information
        </Typography>
        <Typography variant="body2" color="text.secondary" paragraph>
          {guide.costInfo}
        </Typography>
        <Button
          variant="text"
          size="small"
          endIcon={<OpenInNewIcon fontSize="small" />}
          onClick={() => handleOpenLink(guide.pricingUrl)}
          sx={{ textTransform: 'none' }}
        >
          View full pricing details
        </Button>

        <Divider sx={{ my: 2 }} />

        {/* Security tips */}
        <Typography variant="subtitle2" fontWeight={600} gutterBottom>
          Security Tips
        </Typography>
        <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
          <Typography component="li" variant="body2" color="text.secondary">
            Never share your API key with others
          </Typography>
          <Typography component="li" variant="body2" color="text.secondary">
            TeachingHelp stores your key securely on your computer only
          </Typography>
          <Typography component="li" variant="body2" color="text.secondary">
            You can delete and create a new key anytime if compromised
          </Typography>
          <Typography component="li" variant="body2" color="text.secondary">
            Set spending limits in the provider dashboard to control costs
          </Typography>
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  )
}
