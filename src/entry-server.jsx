import './ssr-shims.js'
import React from 'react'
import { renderToPipeableStream } from 'react-dom/server'
import { StaticRouter } from 'react-router-dom/server'
import { HelmetProvider } from 'react-helmet-async'
import { ThemeProvider } from './context/ThemeContext.jsx'
import App from './App.jsx'

// Server-side render of one URL. Resolves when the stream ends, which only
// happens after every lazy route chunk has loaded, so the markup contains
// the full page instead of a Suspense fallback. Returns the app markup and
// the helmet context (title/meta tags) for the caller to inject into index.html.
export function render(url) {
  const helmetContext = {}
  return new Promise((resolve, reject) => {
    let html = ''
    const decoder = new TextDecoder()
    const { pipe } = renderToPipeableStream(
      <React.StrictMode>
        <HelmetProvider context={helmetContext}>
          <ThemeProvider>
            <StaticRouter location={url}>
              <App />
            </StaticRouter>
          </ThemeProvider>
        </HelmetProvider>
      </React.StrictMode>,
      {
        onError(err) {
          reject(err)
        },
      },
    )
    pipe({
      write(chunk) {
        html += typeof chunk === 'string' ? chunk : decoder.decode(chunk, { stream: true })
      },
      end() {
        html += decoder.decode()
        resolve({ html, helmet: helmetContext.helmet })
      },
      on() {},
      once() {},
      emit() {},
    })
  })
}
