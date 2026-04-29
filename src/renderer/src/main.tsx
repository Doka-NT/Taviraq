import ReactDOM from 'react-dom/client'
import '@xterm/xterm/css/xterm.css'
import './styles.css'
import { App } from './App'

window.addEventListener('error', (event) => {
  console.error(event.error instanceof Error ? event.error.stack : event.message)
})

window.addEventListener('unhandledrejection', (event) => {
  console.error(event.reason instanceof Error ? event.reason.stack : String(event.reason))
})

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <App />
)
