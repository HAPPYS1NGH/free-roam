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
    const sounds = join(root, 'sounds')
    const privateFiles = ['library/library.json', 'library/cover.jpg', 'wallpaper/desktop.jpg', 'free-roam/unapproved.png']
    for (const file of [...publicAssets.filter(asset => !asset.startsWith('sounds/')), ...privateFiles]) {
      const path = join(source, file)
      mkdirSync(dirname(path), { recursive: true })
      writeFileSync(path, file)
    }
    mkdirSync(sounds)
    for (const name of ['open', 'close', 'hover', 'retune', 'unused']) writeFileSync(join(sounds, `${name}.wav`), `official ${name}`)
    mkdirSync(join(destination, 'library'), { recursive: true })
    writeFileSync(join(destination, 'library/stale.json'), 'old private export')
    preparePublicAssets(source, destination, sounds)
    assert.deepEqual(listFiles(destination).sort(), [...publicAssets].sort())
    // The sounds come from the official set, and only the listed ones.
    assert.equal(readFileSync(join(destination, 'sounds/retune.wav'), 'utf8'), 'official retune')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
