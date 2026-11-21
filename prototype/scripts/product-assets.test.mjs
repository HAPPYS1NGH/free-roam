import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'
import { publicAssets } from './public-assets.mjs'

const reference = JSON.parse(readFileSync(new URL('./product-reference.json', import.meta.url), 'utf8'))
const catalog = JSON.parse(readFileSync(new URL('../src/free-roam/catalog.json', import.meta.url), 'utf8'))

const SOUNDS = ['open', 'close', 'hover', 'retune']
const sound = name => readFileSync(new URL(`../../assets/sounds/${name}.wav`, import.meta.url))

// assets/sounds/ is the one sound set: the Mac app bundles it and the site
// publishes it at /sounds/<name>.wav.
test('the site publishes the four official sounds, byte for byte', () => {
  assert.deepEqual(publicAssets.filter(asset => asset.startsWith('sounds/')), SOUNDS.map(name => `sounds/${name}.wav`))
  assert.deepEqual(Object.keys(reference.sounds), SOUNDS)
  for (const [name, expectedHash] of Object.entries(reference.sounds)) {
    assert.equal(createHash('sha256').update(sound(name)).digest('hex'), expectedHash, name)
  }
  // Open and close are the same sound, kept as two files.
  assert.ok(sound('open').equals(sound('close')))
})

// Checked against the built app when there is one, since that's what you hear.
test('the built Mac app bundles the same four sounds', t => {
  const app = new URL('../../dist/Free Roam.app/Contents/Resources/', import.meta.url)
  if (!existsSync(app)) return t.skip('no built app in dist/')
  for (const name of SOUNDS) assert.ok(sound(name).equals(readFileSync(new URL(`${name}.wav`, app))), name)
})

test('web wheel settings match the Mac app', () => {
  const tokens = JSON.parse(readFileSync(new URL('../tokens.json', import.meta.url), 'utf8'))
  for (const section of ['animations', 'sizes', 'colors', 'flags', 'behaviour']) {
    assert.deepEqual(tokens[section], reference.settings[section], section)
  }
})

test('approved playlists and public selections have valid tracks and local artwork', () => {
  assert.equal(new Set(catalog.map(station => station.id)).size, catalog.length)
  assert.deepEqual(catalog.filter(station => station.provenance === 'owner-approved-playlist').map(station => station.name), ["God's Favorite", 'High', 'Vibe', 'Culture Truth', 'Serbian', 'Right Eyebrow'])
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
