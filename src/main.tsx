import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { LibraryProvider } from './lib/library'
import { SettingsProvider } from './lib/settings'
import './styles.css'

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <SettingsProvider>
      <LibraryProvider>
        <App />
      </LibraryProvider>
    </SettingsProvider>
  </StrictMode>,
)
