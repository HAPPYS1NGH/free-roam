// Points an offchain ENS subname at an IPFS CID through Namespace's offchain API.
// Usage: NAMESPACE_API_KEY=... node scripts/publish-ens.mjs <subname> <cid>
import { subnameRecord } from './ens-record.mjs'

const [name, cid] = process.argv.slice(2)
const apiKey = process.env.NAMESPACE_API_KEY
const api = process.env.NAMESPACE_OFFCHAIN_BASE_URL ?? 'https://offchain-manager.namespace.ninja'
if (!name || !cid) throw new Error('Usage: node scripts/publish-ens.mjs <subname> <cid>')
if (!apiKey) throw new Error('NAMESPACE_API_KEY is not set')

async function current() {
  const response = await fetch(`${api}/api/v1/subnames/${encodeURIComponent(name)}`)
  if (response.status === 404) return null
  if (!response.ok) throw new Error(`Reading ${name} failed: ${response.status} ${await response.text()}`)
  return response.json()
}

const existing = await current()
const defaultTexts = process.env.SITE_URL ? { url: process.env.SITE_URL } : {}
const response = await fetch(`${api}/api/v1/subnames`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', 'x-auth-token': apiKey },
  body: JSON.stringify(subnameRecord(name, cid, existing, defaultTexts)),
})
if (!response.ok) throw new Error(`Updating ${name} failed: ${response.status} ${await response.text()}`)

const saved = await current()
if (saved?.contenthash !== `ipfs://${cid}`) throw new Error(`${name} reads back ${saved?.contenthash}, expected ipfs://${cid}`)
console.log(`${existing ? 'Updated' : 'Created'} ${name} -> ipfs://${cid}`)
