import { fileURLToPath } from 'node:url'
import { assetSource, preparePublicAssets, publicAssets } from './public-assets.mjs'

const root = fileURLToPath(new URL('../', import.meta.url))
preparePublicAssets(`${root}public`, `${root}.site-public`)
for (const asset of publicAssets.filter(asset => asset.startsWith('sounds/'))) console.log(`${asset} from public/${assetSource(`${root}public`, asset)}`)
console.log('Prepared approved site assets. Personal exports are excluded.')
