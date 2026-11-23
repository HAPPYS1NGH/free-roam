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
  assert.ok(built.includes('Like the radio when you free roam, <span>except every station is your playlist.</span>'), 'lede')
  for (const name of ['God&#x27;s Favorite', 'High', 'Vibe', 'Culture Truth', 'Serbian', 'Right Eyebrow']) {
    assert.ok(built.includes(`>${name}</span>`), name)
  }
  for (const question of ['I use Spotify. Does it work?', 'Do I have to pay for Apple Music?', 'How is this different from Spotify Radio?', 'Why would it want Screen Recording?', 'Is it free?']) {
    assert.ok(built.includes(question), question)
  }
  assert.ok(built.includes('Call starting? Silence in a flick.'), 'Radio Off use case')
  assert.ok(!/notari[sz]ed/i.test(built), 'no signed-and-notarized claims')
})
