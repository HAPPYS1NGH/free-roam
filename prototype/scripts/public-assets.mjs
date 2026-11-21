import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'

export const publicAssets = [
  'fonts/sofia-sans-extra-condensed/latin-600.woff2',
  'fonts/sofia-sans-extra-condensed/latin-ext-600.woff2',
  'fonts/sofia-sans-extra-condensed/OFL.txt',
  'favicon.ico',
  'apple-touch-icon.png',
  'free-roam/coast.jpg',
  'free-roam/badge.png',
  'free-roam/og-image.jpg',
  ...['night', 'indie', 'rap', 'punjabi', 'electronic', 'road', 'currents', 'gods-favorite-0', 'high-0', 'vibe-0', 'vibe-1', 'vibe-2', 'vibe-3', 'culture-truth-0', 'culture-truth-1', 'serbian-0', 'right-eyebrow-0', 'right-eyebrow-1', 'right-eyebrow-2', 'right-eyebrow-3'].map(name => `free-roam/albums/${name}.jpg`),
  ...['open', 'close', 'hover', 'retune'].map(name => `sounds/${name}.wav`),
]

// The site plays exactly the sounds the Mac app bundles. Like scripts/bundle.sh,
// each one is the owner's file in sounds/local/ where there is one, and the
// synthesised one otherwise. Only the published name, sounds/<name>.wav, ships.
export function assetSource(source, asset) {
  const local = asset.replace(/^sounds\//, 'sounds/local/')
  return asset.startsWith('sounds/') && existsSync(join(source, local)) ? local : asset
}

// A new file in public/ must never become public merely because it exists.
export function preparePublicAssets(source, destination) {
  rmSync(destination, { recursive: true, force: true })
  for (const asset of publicAssets) {
    const target = join(destination, asset)
    mkdirSync(dirname(target), { recursive: true })
    copyFileSync(join(source, assetSource(source, asset)), target)
  }
}

export function listFiles(root, prefix = '') {
  return readdirSync(join(root, prefix), { withFileTypes: true }).flatMap(entry => {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name
    return entry.isDirectory() ? listFiles(root, path) : [path]
  })
}
