import { describe, expect, it } from 'vitest'
import * as codecs from './extendedFormats.js'

const sample = { width:2, height:1, data:new Uint8ClampedArray([230,30,60,255,12,120,240,180]) }
const cases = [
  ['PBM','encodePbm','decodePbm','image/x-portable-bitmap','P4'],
  ['PGM','encodePgm','decodePgm','image/x-portable-graymap','P5'],
  ['PAM','encodePam','decodePam','image/x-portable-arbitrarymap','P7'],
  ['Farbfeld','encodeFarbfeld','decodeFarbfeld','image/farbfeld','farbfeld'],
  ['TGA','encodeTga','decodeTga','image/x-tga',null],
]

describe.each(cases)('%s local codec', (label, encoder, decoder, mime, signature) => {
  it('encodes valid bytes and decodes the original dimensions', async () => {
    const blob = codecs[encoder](sample)
    const bytes = new Uint8Array(await blob.arrayBuffer())
    const decoded = codecs[decoder](bytes)
    expect(blob.type).toBe(mime)
    expect(bytes.length).toBeGreaterThan(0)
    expect(decoded).toMatchObject({ width:sample.width, height:sample.height })
    expect(decoded.data).toHaveLength(sample.data.length)
    if (signature) expect(new TextDecoder().decode(bytes.subarray(0,signature.length))).toBe(signature)
  })
})

it('preserves PAM pixels whose first binary channel is a whitespace byte', async () => {
  const image = { width:1, height:1, data:new Uint8ClampedArray([1,2,3,10]) }
  const encoded = codecs.encodePam(image)
  const decoded = codecs.decodePam(new Uint8Array(await encoded.arrayBuffer()))
  expect([...decoded.data]).toEqual([...image.data])
})

it('rejects compressed TGA instead of interpreting it as raw pixels', () => {
  const bytes = new Uint8Array(18)
  bytes[2] = 10
  expect(() => codecs.decodeTga(bytes)).toThrow('unsupported-format')
})
