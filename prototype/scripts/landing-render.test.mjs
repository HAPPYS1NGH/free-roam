import assert from 'node:assert/strict'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { createServer } from 'vite'

test('landing prerender stays identical across broadcast times and includes approved playlists', async t => {
  const server = await createServer({
    root: fileURLToPath(new URL('../', import.meta.url)),
    server: { middlewareMode: true, hmr: false, ws: false },
    appType: 'custom',
    optimizeDeps: { noDiscovery: true, include: [] },
  })
  t.after(() => server.close())
  const { LandingPage } = await server.ssrLoadModule('/src/free-roam/LandingPage.tsx')
  const now = Date.now
  t.after(() => { Date.now = now })
  Date.now = () => Date.UTC(2026, 9, 25)
  const built = renderToString(createElement(LandingPage))
  Date.now = () => Date.UTC(2026, 9, 26)
  assert.equal(renderToString(createElement(LandingPage)), built)
  for (const name of ['God&#x27;s Favorite', 'gym', 'PLow', 'Morning Playlist']) {
    assert.ok(built.includes(`Tune to ${name}`), name)
  }
  assert.ok(built.includes('sound effects from Static'))
})
