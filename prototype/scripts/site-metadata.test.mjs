import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { siteOrigin, writeSiteMetadata } from './site-metadata.mjs'

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
    writeFileSync(join(directory, route), '<head><meta property="og:image" content="/free-roam/coast.jpg" /></head>')
  }
  writeSiteMetadata(directory, 'https://example.test')
  for (const [file, path] of [['index.html', '/'], ['free-roam/index.html', '/free-roam/']]) {
    const html = readFileSync(join(directory, file), 'utf8')
    assert.ok(html.includes(`rel="canonical" href="https://example.test${path}"`))
    assert.ok(html.includes('content="https://example.test/free-roam/coast.jpg"'))
  }
  assert.match(readFileSync(join(directory, 'robots.txt'), 'utf8'), /Sitemap: https:\/\/example.test\/sitemap.xml/)
  const sitemap = readFileSync(join(directory, 'sitemap.xml'), 'utf8')
  assert.ok(sitemap.includes('<loc>https://example.test/free-roam/</loc>'))
  assert.ok(!sitemap.includes('studio'))
})
