import assert from 'node:assert/strict'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { createServer } from 'vite'

test('landing prerender stays identical across times and time zones, and has the hero, stations and FAQ', async t => {
  const server = await createServer({
    root: fileURLToPath(new URL('../', import.meta.url)),
    server: { middlewareMode: true, hmr: false, ws: false },
    appType: 'custom',
    optimizeDeps: { noDiscovery: true, include: [] },
  })
  t.after(() => server.close())
  const { LandingPage } = await server.ssrLoadModule('/src/free-roam/LandingPage.tsx')
  const now = Date.now
  const zone = process.env.TZ
  t.after(() => { Date.now = now; process.env.TZ = zone })
  Date.now = () => Date.UTC(2026, 9, 25)
  process.env.TZ = 'UTC'
  const built = renderToString(createElement(LandingPage))
  Date.now = () => Date.UTC(2026, 9, 26, 15, 30)
  process.env.TZ = 'Asia/Kolkata'
  assert.equal(renderToString(createElement(LandingPage)), built)

  assert.ok(built.includes('anywhere.</span>'), 'headline')
  assert.ok(built.includes('Flick to a Music or Spotify playlist and it plays, <span>without switching apps.</span>'), 'lede')
  for (const name of ['God&#x27;s Favorite', 'High', 'Vibe', 'Culture Truth', 'Serbian', 'Right Eyebrow']) {
    assert.ok(built.includes(`>${name}</span>`), name)
  }
  for (const question of ['Does it work with Spotify?', 'Do I need Apple Music or Spotify Premium?', 'Why use it instead of Music or Spotify?', 'Can I choose my own stations?', 'Does this page play music?', 'What can it see on my Mac?', 'How does it update?']) {
    assert.ok(built.includes(question), question)
  }
  assert.ok(built.includes('Free and open source. For Music or Spotify, on macOS 14 or later.'), 'closing line')
  assert.ok(!/notari[sz]ed/i.test(built), 'no signed-and-notarized claims')
})
