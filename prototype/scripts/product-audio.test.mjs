import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { transformWithOxc } from 'vite'

// Exercise the audio controller with an asynchronous decoder and suspended output.
// This catches the first-gesture silence that a file checksum cannot catch.
test('cold-load first gesture plays the product clip at its configured gain; mute plays nothing', async t => {
  const requested = []
  const started = []
  const gains = []
  const originals = { fetch: globalThis.fetch, AudioContext: globalThis.AudioContext, OfflineAudioContext: globalThis.OfflineAudioContext }
  t.after(() => Object.assign(globalThis, originals))
  globalThis.fetch = async url => {
    requested.push(url)
    const bytes = await readFile(new URL(`../public${url}`, import.meta.url))
    return { ok: true, headers: new Headers({ 'content-type': 'audio/wav' }), arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) }
  }
  globalThis.OfflineAudioContext = class {
    async decodeAudioData(bytes) {
      return { duration: (bytes.byteLength - 44) / 88200, bytes: bytes.byteLength }
    }
  }
  globalThis.AudioContext = class {
    state = 'suspended'
    currentTime = 0
    destination = {}
    resume() { this.state = 'running'; return Promise.resolve() }
    createBufferSource() {
      const source = { buffer: null, connect(destination) { return destination }, start: () => started.push(source.buffer), stop() {} }
      return source
    }
    createGain() {
      const gain = { gain: { value: 0 }, connect() {} }
      gains.push(gain)
      return gain
    }
  }
  const source = await readFile(new URL('../src/sound.ts', import.meta.url), 'utf8')
  const { code } = await transformWithOxc(source, 'sound.ts')
  const { preloadProductSounds, unlockAudio, playSound, SILENT_DB } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)
  const loading = preloadProductSounds()
  unlockAudio()
  playSound('open', -2, 'Product')
  assert.equal(started.length, 0)
  await loading
  await Promise.resolve()
  assert.equal(started.length, 1)
  assert.equal(started[0].bytes, 12392)
  assert.ok(Math.abs(gains[0].gain.value - 10 ** (-2 / 20)) < 1e-9)
  playSound('close', SILENT_DB, 'Product')
  assert.equal(started.length, 1)
  assert.deepEqual(requested.sort(), ['close', 'hover', 'open', 'retune'].map(name => `/sounds/${name}.wav`))
})
