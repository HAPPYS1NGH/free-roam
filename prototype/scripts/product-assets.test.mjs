import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { assetSource, publicAssets } from './public-assets.mjs'

const reference = JSON.parse(readFileSync(new URL('./product-reference.json', import.meta.url), 'utf8'))
const catalog = JSON.parse(readFileSync(new URL('../src/free-roam/catalog.json', import.meta.url), 'utf8'))

// The release app ships prototype/public/sounds/{open,close,hover,<retune take>}.wav.
// The local pack only overrides them in builds on your own Mac, so it never counts.
test('the synthesised fallback sounds are unchanged', () => {
  const tokens = JSON.parse(readFileSync(new URL('../tokens.json', import.meta.url), 'utf8'))
  const shipped = ['open', 'close', 'hover', tokens.behaviour.retuneTake]
  assert.deepEqual(publicAssets.filter(asset => asset.startsWith('sounds/')), shipped.map(name => `sounds/${name}.wav`))
  assert.deepEqual(Object.keys(reference.sounds), shipped)
  for (const [name, expectedHash] of Object.entries(reference.sounds)) {
    const bytes = readFileSync(new URL(`../public/sounds/${name}.wav`, import.meta.url))
    assert.equal(createHash('sha256').update(bytes).digest('hex'), expectedHash, name)
  }
})

// The site plays what the Mac app bundles. Checked against the built app when
// there is one, since that's what you hear.
test('the site sounds are byte for byte the ones in the built Mac app', t => {
  const app = new URL('../../dist/Free Roam.app/Contents/Resources/', import.meta.url)
  if (!existsSync(app)) return t.skip('no built app in dist/')
  const tokens = JSON.parse(readFileSync(new URL('../tokens.json', import.meta.url), 'utf8'))
  const publicDir = fileURLToPath(new URL('../public/', import.meta.url))
  for (const name of ['open', 'close', 'hover', tokens.behaviour.retuneTake]) {
    const site = readFileSync(new URL(`../public/${assetSource(publicDir, `sounds/${name}.wav`)}`, import.meta.url))
    assert.ok(site.equals(readFileSync(new URL(`${name}.wav`, app))), name)
  }
})

test('web wheel settings match the Mac app', () => {
  const tokens = JSON.parse(readFileSync(new URL('../tokens.json', import.meta.url), 'utf8'))
  for (const section of ['animations', 'sizes', 'colors', 'flags', 'behaviour']) {
    assert.deepEqual(tokens[section], reference.settings[section], section)
  }
})

test('approved playlists and public selections have valid tracks and local artwork', () => {
  assert.equal(new Set(catalog.map(station => station.id)).size, catalog.length)
  assert.deepEqual(catalog.filter(station => station.provenance === 'owner-approved-playlist').map(station => station.name), ["God's Favorite", 'gym', 'PLow', 'Morning Playlist'])
  assert.ok(!catalog.some(station => ['pop', 'dance', 'sunset', 'classics'].includes(station.id)))
  for (const station of catalog) {
    if (station.provenance === 'owner-approved-playlist') {
      assert.equal(station.sourceUrl, null)
      assert.ok(station.tracks.length > 0)
    } else {
      assert.equal(new URL(station.sourceUrl).hostname, 'music.apple.com')
    }
    assert.ok(station.tracks.every(track => track.title && track.artist && track.duration > 0))
    for (const cover of station.covers) {
      assert.match(cover, /^\/free-roam\/albums\/[a-z0-9-]+\.jpg$/)
      const bytes = readFileSync(new URL(`../public${cover}`, import.meta.url))
      assert.equal(bytes.readUInt16BE(0), 0xffd8, cover)
    }
  }
})
