import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { siteOrigin } from './site-metadata.mjs'
import { listFiles, publicAssets } from './public-assets.mjs'

const dist = fileURLToPath(new URL('../dist/', import.meta.url))
const files = listFiles(dist)
const origin = siteOrigin(process.env.SITE_URL, process.env.RELEASE_BUILD === '1')
const allowed = new Set([...publicAssets, 'index.html', 'free-roam/index.html', ...(origin ? ['robots.txt', 'sitemap.xml'] : [])])
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
const catalog = JSON.parse(readFileSync(new URL('../src/free-roam/catalog.json', import.meta.url), 'utf8'))
for (const station of catalog) {
  const escapedName = station.name.replaceAll("'", '&#x27;')
  assert.ok(landing.includes(`Tune to ${escapedName}`), `Landing is missing ${station.name}`)
}
if (origin) {
  for (const route of ['/', '/free-roam/']) {
    const html = readFileSync(`${dist}${route}index.html`, 'utf8')
    assert.ok(html.includes(`rel="canonical" href="${origin}${route}"`), `Missing canonical: ${route}`)
    assert.ok(html.includes(`content="${origin}/free-roam/coast.jpg"`), `Missing social image: ${route}`)
  }
}
console.log(`Release check passed: ${files.length} files, no private exports or studio controls.`)
