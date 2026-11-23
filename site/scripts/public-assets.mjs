import { copyFileSync, mkdirSync, readdirSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const publicAssets = [
  'fonts/sofia-sans-extra-condensed/latin-600.woff2',
  'fonts/sofia-sans-extra-condensed/latin-ext-600.woff2',
  'fonts/sofia-sans-extra-condensed/OFL.txt',
  'favicon.ico',
  'apple-touch-icon.png',
  'free-roam/coast.jpg',
  // The hero's coast photo for each time of day; the page loads only the current one.
  ...['dawn', 'day', 'dusk', 'night'].map(time => `free-roam/scenes/coast-${time}.jpg`),
  'free-roam/badge.png',
  // The Mac app on film: portrait for phones ("On your Mac"), landscape for
  // desktops (How it works), each with its poster frame.
  'free-roam/demo/anywhere.mp4',
  'free-roam/demo/anywhere.jpg',
  'free-roam/demo/anywhere-wide.mp4',
  'free-roam/demo/anywhere-wide.jpg',
  'free-roam/og-image.jpg',
  ...['night', 'indie', 'rap', 'punjabi', 'electronic', 'road', 'currents', 'gods-favorite-0', 'high-0', 'vibe-0', 'vibe-1', 'vibe-2', 'vibe-3', 'culture-truth-0', 'culture-truth-1', 'serbian-0', 'right-eyebrow-0', 'right-eyebrow-1', 'right-eyebrow-2', 'right-eyebrow-3'].map(name => `free-roam/albums/${name}.jpg`),
  ...['open', 'close', 'hover', 'retune'].map(name => `sounds/${name}.wav`),
]

// The sounds the Mac app bundles too, published at /sounds/<name>.wav.
export const soundsDir = fileURLToPath(new URL('../../assets/sounds/', import.meta.url))

// A new file in public/ must never become public merely because it exists.
export function preparePublicAssets(source, destination, sounds = soundsDir) {
  rmSync(destination, { recursive: true, force: true })
  for (const asset of publicAssets) {
    const target = join(destination, asset)
    mkdirSync(dirname(target), { recursive: true })
    copyFileSync(asset.startsWith('sounds/') ? join(sounds, asset.slice('sounds/'.length)) : join(source, asset), target)
  }
}

export function listFiles(root, prefix = '') {
  return readdirSync(join(root, prefix), { withFileTypes: true }).flatMap(entry => {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name
    return entry.isDirectory() ? listFiles(root, path) : [path]
  })
}
