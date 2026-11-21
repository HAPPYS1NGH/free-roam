import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { siteOrigin } from './site-metadata.mjs'

siteOrigin(process.env.SITE_URL, true)
const cwd = fileURLToPath(new URL('../', import.meta.url))
for (const args of [['test'], ['run', 'build']]) {
  const result = spawnSync('npm', args, { cwd, stdio: 'inherit', env: { ...process.env, RELEASE_BUILD: '1' } })
  if (result.error) throw result.error
  if (result.status !== 0) process.exit(result.status ?? 1)
}
console.log('Release prepared in site/dist/. Publish only this directory.')
