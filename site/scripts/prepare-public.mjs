import { fileURLToPath } from 'node:url'
import { preparePublicAssets } from './public-assets.mjs'

const root = fileURLToPath(new URL('../', import.meta.url))
preparePublicAssets(`${root}public`, `${root}.site-public`)
console.log('Prepared approved site assets and the sounds from assets/sounds/. Personal exports are excluded.')
