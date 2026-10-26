import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import test from 'node:test'
import { listFiles, preparePublicAssets, publicAssets } from './public-assets.mjs'

test('personal exports and unapproved assets never reach the public directory', () => {
  const root = mkdtempSync(join(tmpdir(), 'free-roam-assets-'))
  try {
    const source = join(root, 'public')
    const destination = join(root, 'site')
    const privateFiles = ['library/library.json', 'library/cover.jpg', 'wallpaper/desktop.jpg', 'sounds/local/retune.wav', 'free-roam/unapproved.png']
    for (const file of [...publicAssets, ...privateFiles]) {
      const path = join(source, file)
      mkdirSync(dirname(path), { recursive: true })
      writeFileSync(path, file)
    }
    mkdirSync(join(destination, 'library'), { recursive: true })
    writeFileSync(join(destination, 'library/stale.json'), 'old private export')
    preparePublicAssets(source, destination)
    assert.deepEqual(listFiles(destination).sort(), [...publicAssets].sort())
    assert.equal(readFileSync(join(destination, 'sounds/retune.wav'), 'utf8'), 'sounds/retune.wav')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
