import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { listFiles, publicAssets } from './public-assets.mjs'

const dist = fileURLToPath(new URL('../dist/', import.meta.url))
const files = listFiles(dist)
const allowed = new Set([...publicAssets, 'index.html', 'free-roam/index.html'])
for (const file of files) {
  assert.ok(allowed.has(file) || /^assets\/[^/]+\.(js|css)$/.test(file), `Unexpected release file: ${file}`)
  if (/\.(js|html|css)$/.test(file)) {
    const content = readFileSync(`${dist}/${file}`, 'utf8')
    for (const privateMarker of ['library/library.json', '/sounds/local/', '/wallpaper/', 'dialkit-root', 'Prototype variants', 'mini-player']) {
      assert.ok(!content.includes(privateMarker), `Private or studio code in ${file}: ${privateMarker}`)
    }
  }
}
for (const file of allowed) assert.ok(files.includes(file), `Missing release asset: ${file}`)
const landing = readFileSync(`${dist}/free-roam/index.html`, 'utf8')
assert.ok(landing.includes('Take the<br/>long way'), 'Landing-page headline must exist without JavaScript')
assert.ok(landing.includes('Choose Radio Off'), 'Product copy must be statically rendered')
console.log(`Release check passed: ${files.length} files, no private exports or studio controls.`)
