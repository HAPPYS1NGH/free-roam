import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { publicAssets } from './public-assets.mjs'
import { siteOrigin, socialImage, writeSiteMetadata } from './site-metadata.mjs'

test('release metadata requires an unambiguous HTTPS origin', () => {
  assert.equal(siteOrigin(undefined), null)
  assert.throws(() => siteOrigin(undefined, true), /Set SITE_URL/)
  for (const value of ['http://example.test', 'https://example".test', 'https://example&.test', 'https://user:pass@example.test', 'https://example.test/app', 'https://example.test/?q=x', 'https://example.test/#x']) {
    assert.throws(() => siteOrigin(value))
  }
  assert.equal(siteOrigin('https://example.test/'), 'https://example.test')
})

test('release pages and sitemap share the configured origin and exclude studio routes', t => {
  const directory = mkdtempSync(join(tmpdir(), 'free-roam-metadata-'))
  t.after(() => rmSync(directory, { recursive: true, force: true }))
  mkdirSync(join(directory, 'free-roam'))
  for (const route of ['index.html', 'free-roam/index.html']) {
    writeFileSync(join(directory, route), `<head><meta property="og:image" content="${socialImage}" /></head>`)
  }
  writeSiteMetadata(directory, 'https://example.test')
  for (const [file, path] of [['index.html', '/'], ['free-roam/index.html', '/free-roam/']]) {
    const html = readFileSync(join(directory, file), 'utf8')
    assert.ok(html.includes(`rel="canonical" href="https://example.test${path}"`))
    assert.ok(html.includes('content="https://example.test/free-roam/og-image.jpg"'))
    assert.ok(html.includes('name="twitter:image" content="https://example.test/free-roam/og-image.jpg"'))
  }
  assert.match(readFileSync(join(directory, 'robots.txt'), 'utf8'), /Sitemap: https:\/\/example.test\/sitemap.xml/)
  const sitemap = readFileSync(join(directory, 'sitemap.xml'), 'utf8')
  assert.ok(sitemap.includes('<loc>https://example.test/free-roam/</loc>'))
  assert.ok(!sitemap.includes('studio'))
})

// Social networks crop or reject cards of other sizes, and the release only
// publishes listed files.
test('the social card is a published 1200 × 630 JPEG', () => {
  assert.ok(publicAssets.includes(socialImage.slice(1)))
  const bytes = readFileSync(new URL(`../public${socialImage}`, import.meta.url))
  assert.equal(bytes.readUInt16BE(0), 0xffd8)
  // The frame header (SOF0 or SOF2) holds the height, then the width.
  let offset = 2
  while (![0xffc0, 0xffc2].includes(bytes.readUInt16BE(offset))) offset += 2 + bytes.readUInt16BE(offset + 2)
  assert.deepEqual([bytes.readUInt16BE(offset + 7), bytes.readUInt16BE(offset + 5)], [1200, 630])
})
