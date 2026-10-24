import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { createServer } from 'vite'

const root = fileURLToPath(new URL('../', import.meta.url))
const server = await createServer({ root, server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom', optimizeDeps: { noDiscovery: true, include: [] } })
try {
  const { LandingPage } = await server.ssrLoadModule('/src/free-roam/LandingPage.tsx')
  const file = `${root}dist/free-roam/index.html`
  const html = readFileSync(file, 'utf8')
  const markup = renderToString(createElement(LandingPage))
  writeFileSync(file, html.replace('<div id="root"></div>', `<div id="root">${markup}</div>`))
  console.log('Prerendered the Free Roam landing page.')
} finally {
  await server.close()
}
