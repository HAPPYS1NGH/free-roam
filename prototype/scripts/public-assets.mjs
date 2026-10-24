import { copyFileSync, mkdirSync, readdirSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'

export const publicAssets = [
  'fonts/sofia-sans-extra-condensed/latin-600.woff2',
  'fonts/sofia-sans-extra-condensed/latin-ext-600.woff2',
  'fonts/sofia-sans-extra-condensed/OFL.txt',
  'free-roam/coast.jpg',
  'free-roam/app-icon.png',
  ...['night', 'focus', 'morning', 'energy', 'slow', 'rewind'].map(name => `free-roam/stations/${name}.svg`),
  ...['open', 'close', 'hover', 'retune', 'retune-b', 'retune-c'].map(name => `sounds/${name}.wav`),
]

// A new file in public/ must never become public merely because it exists.
export function preparePublicAssets(source, destination) {
  rmSync(destination, { recursive: true, force: true })
  for (const asset of publicAssets) {
    const target = join(destination, asset)
    mkdirSync(dirname(target), { recursive: true })
    copyFileSync(join(source, asset), target)
  }
}

export function listFiles(root, prefix = '') {
  return readdirSync(join(root, prefix), { withFileTypes: true }).flatMap(entry => {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name
    return entry.isDirectory() ? listFiles(root, path) : [path]
  })
}
