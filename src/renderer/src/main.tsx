import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { MuiThemeProvider } from './theme'
import '@fontsource/dm-serif-text'
import './styles/global.css'

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <MuiThemeProvider>
      <App />
    </MuiThemeProvider>
  </React.StrictMode>
)
