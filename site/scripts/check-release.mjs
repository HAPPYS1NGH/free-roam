import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { siteOrigin, socialImage } from './site-metadata.mjs'
import { listFiles, publicAssets } from './public-assets.mjs'

const dist = fileURLToPath(new URL('../dist/', import.meta.url))
const files = listFiles(dist)
const sha256 = path => createHash('sha256').update(readFileSync(path)).digest('hex')
// Gitignored files on the building Mac that must never ship, even under another
// name. A host's checkout has no wallpaper, so there it can only report a skip.
const publicDir = fileURLToPath(new URL('../public/', import.meta.url))
const privateCopies = new Map()
for (const folder of ['wallpaper']) {
  const root = join(publicDir, folder)
  const privateFiles = existsSync(root) ? listFiles(root) : []
  if (privateFiles.length === 0) {
    console.log(`Copy check: skipped public/${folder}/, which is missing or empty.`)
    continue
  }
  for (const file of privateFiles) privateCopies.set(sha256(join(root, file)), `${folder}/${file}`)
  console.log(`Copy check: looking for byte-identical copies of the ${privateFiles.length} files in public/${folder}/.`)
}
const origin = siteOrigin(process.env.SITE_URL, process.env.RELEASE_BUILD === '1')
const allowed = new Set([...publicAssets, 'index.html', '404.html', ...(origin ? ['robots.txt', 'sitemap.xml'] : [])])
for (const file of files) {
  assert.ok(allowed.has(file) || /^assets\/[^/]+\.(js|css)$/.test(file), `Unexpected release file: ${file}`)
  const original = privateCopies.get(sha256(join(dist, file)))
  assert.ok(!original, `${file} is a copy of the gitignored public/${original}`)
  if (/\.(js|html|css)$/.test(file)) {
    const content = readFileSync(`${dist}/${file}`, 'utf8')
    for (const privateMarker of ['library/library.json', '/wallpaper/', 'dialkit-root', 'Prototype variants', 'mini-player']) {
      assert.ok(!content.includes(privateMarker), `Private or studio code in ${file}: ${privateMarker}`)
    }
  }
}
for (const file of allowed) assert.ok(files.includes(file), `Missing release asset: ${file}`)
const landing = readFileSync(`${dist}/index.html`, 'utf8')
assert.ok(landing.includes('anywhere.</span>') && landing.includes('Flick to a Music or Spotify playlist and it plays, <span>without switching apps.</span>'), 'Landing-page headline must exist without JavaScript')
assert.ok(landing.includes('Pick Radio Off'), 'Product copy must be statically rendered')
// The prerender has no WebGL scene and nothing from YouTube: those start in the browser.
for (const marker of ['<canvas', 'youtube.com', 'youtube-nocookie.com', '<iframe']) {
  assert.ok(!landing.includes(marker), `Prerendered landing page includes ${marker}`)
}
const catalog = JSON.parse(readFileSync(new URL('../src/free-roam/catalog.json', import.meta.url), 'utf8'))
for (const station of catalog) {
  const escapedName = station.name.replaceAll("'", '&#x27;')
  assert.ok(landing.includes(`>${escapedName}</span>`), `Landing is missing ${station.name}`)
}
if (origin) {
  for (const route of ['/']) {
    const html = readFileSync(`${dist}${route}index.html`, 'utf8')
    assert.ok(html.includes(`rel="canonical" href="${origin}${route}"`), `Missing canonical: ${route}`)
    assert.ok(html.includes(`content="${origin}${socialImage}"`), `Missing social image: ${route}`)
  }
}
console.log(`Release check passed: ${files.length} files, no private exports or studio controls.`)
