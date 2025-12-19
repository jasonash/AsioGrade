import type { ReactElement } from 'react'
import { useState } from 'react'

function App(): ReactElement {
  const [count, setCount] = useState(0)

  return (
    <div className="app">
      <header className="app-header">
        <h1>TeachingHelp</h1>
        <p>Your AI-powered teaching assistant</p>
      </header>

      <main className="app-main">
        <div className="card">
          <p>Platform: {window.electronAPI?.platform ?? 'unknown'}</p>
          <button onClick={() => setCount((c) => c + 1)}>
            Count is {count}
          </button>
          <p>Click the button to verify React is working</p>
        </div>
      </main>

      <footer className="app-footer">
        <p>Ready for development</p>
      </footer>
    </div>
  )
}

export default App
