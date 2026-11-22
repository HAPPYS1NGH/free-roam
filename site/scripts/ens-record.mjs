// Builds the Namespace offchain upsert body for an ENS subname.
// The upsert replaces texts, addresses and metadata wholesale, so every record the
// subname already has is carried over and only the contenthash changes.

const CID = /^(Qm[1-9A-HJ-NP-Za-km-z]{44}|b[a-z2-7]{20,})$/

export function splitName(name) {
  const [label, ...rest] = name.split('.')
  const parentName = rest.join('.')
  if (!label || rest.length < 2 || !parentName.endsWith('.eth')) throw new Error(`Not a subname of a .eth name: ${name}`)
  return { label, parentName }
}

const pairs = (records = {}) => Object.entries(records).map(([key, value]) => ({ key, value }))

export function subnameRecord(name, cid, existing, defaultTexts = {}) {
  if (!CID.test(cid)) throw new Error(`Not an IPFS CID: ${cid}`)
  const body = {
    ...splitName(name),
    texts: pairs(existing ? existing.texts : defaultTexts),
    addresses: Object.entries(existing?.addresses ?? {}).map(([coin, value]) => ({ coin: Number(coin), value })),
    metadata: pairs(existing?.metadata),
    contenthash: `ipfs://${cid}`,
  }
  if (existing?.owner) body.owner = existing.owner
  return body
}
