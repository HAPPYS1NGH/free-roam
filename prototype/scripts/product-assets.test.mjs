import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const reference = JSON.parse(readFileSync(new URL('./product-reference.json', import.meta.url), 'utf8'))
const catalog = JSON.parse(readFileSync(new URL('../src/free-roam/catalog.json', import.meta.url), 'utf8'))

test('public sound effects match the installed Static app byte for byte', () => {
  for (const [name, expectedHash] of Object.entries(reference.sounds)) {
    const bytes = readFileSync(new URL(`../public/sounds/static/${name}.wav`, import.meta.url))
    assert.equal(createHash('sha256').update(bytes).digest('hex'), expectedHash, name)
  }
})

test('web wheel settings match the installed Static app', () => {
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
