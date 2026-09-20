import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { App } from '@/app/App'
import { initializeTheme } from '@/shared/hooks/useTheme'
import { registerServiceWorker } from '@/shared/lib/registerServiceWorker'

initializeTheme()
registerServiceWorker()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
