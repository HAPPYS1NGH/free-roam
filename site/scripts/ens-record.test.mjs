import assert from 'node:assert/strict'
import { test } from 'node:test'
import { splitName, subnameRecord } from './ens-record.mjs'

const cid = 'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi'

test('splits a subname into label and parent', () => {
  assert.deepEqual(splitName('freeroam.happysingh.eth'), { label: 'freeroam', parentName: 'happysingh.eth' })
  assert.throws(() => splitName('happysingh.eth'))
  assert.throws(() => splitName('freeroam.happysingh.com'))
})

test('a new subname gets the default texts and the contenthash', () => {
  assert.deepEqual(subnameRecord('freeroam.happysingh.eth', cid, null, { url: 'https://freeroam.happys1ngh.com' }), {
    label: 'freeroam',
    parentName: 'happysingh.eth',
    texts: [{ key: 'url', value: 'https://freeroam.happys1ngh.com' }],
    addresses: [],
    metadata: [],
    contenthash: `ipfs://${cid}`,
  })
})

test('an existing subname keeps every record and only swaps the contenthash', () => {
  const existing = {
    texts: { url: 'https://example.com', avatar: 'https://example.com/a.png' },
    addresses: { 60: '0xaC56f7199E5D5361c7Ed75EB6C5B0608eFACc4b0' },
    metadata: { source: 'ci' },
    owner: '0xaC56f7199E5D5361c7Ed75EB6C5B0608eFACc4b0',
    contenthash: 'ipfs://QmOld',
  }
  const body = subnameRecord('freeroam.happysingh.eth', cid, existing, { url: 'ignored' })
  assert.deepEqual(body.texts, [{ key: 'url', value: 'https://example.com' }, { key: 'avatar', value: 'https://example.com/a.png' }])
  assert.deepEqual(body.addresses, [{ coin: 60, value: existing.addresses[60] }])
  assert.deepEqual(body.metadata, [{ key: 'source', value: 'ci' }])
  assert.equal(body.owner, existing.owner)
  assert.equal(body.contenthash, `ipfs://${cid}`)
})

test('rejects anything that is not a CID', () => {
  assert.throws(() => subnameRecord('freeroam.happysingh.eth', 'ipfs://0xe301', null))
  assert.throws(() => subnameRecord('freeroam.happysingh.eth', '', null))
})
