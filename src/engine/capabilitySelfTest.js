import { encodeBmp, encodeIco, hasBmpSignature, hasIcoSignature } from './rasterEncoders.js'
import { decodePpm, decodeQoi, encodePpm, encodeQoi } from './portableFormats.js'
import * as extendedFormats from './extendedFormats.js'

const nativeEncoders = [
  { mime: 'image/jpeg', signature: bytes => bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff },
  { mime: 'image/png', signature: bytes => bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 },
  { mime: 'image/webp', signature: bytes => String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP' },
  { mime: 'image/avif', signature: bytes => {
    const text = String.fromCharCode(...bytes)
    return text.includes('ftypavif') || text.includes('ftypavis')
  } },
]

/** Verify formats by encoding a real RGBA sample, checking its signature, and decoding it. */
export async function runNativeCapabilitySelfTest() {
  const passed = new Set()
  const diagnostics = []
  const canvas = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(2, 2) : Object.assign(document.createElement('canvas'), { width: 2, height: 2 })
  const context = canvas.getContext('2d', { willReadFrequently: true })
  const pixels = new Uint8ClampedArray([255, 20, 30, 255, 0, 200, 80, 255, 10, 20, 240, 255, 250, 240, 0, 255])
  context.putImageData(new ImageData(pixels, 2, 2), 0, 0)
  const image = { data: pixels, width: 2, height: 2 }
  const candidates = [
    ...nativeEncoders.map(encoder => ({ ...encoder, encode: () => canvas.convertToBlob ? canvas.convertToBlob({ type: encoder.mime, quality: .86 }) : new Promise(resolve => canvas.toBlob(resolve, encoder.mime, .86)) })),
    { mime: 'image/bmp', signature: hasBmpSignature, encode: () => encodeBmp(image) },
    { mime: 'image/x-icon', signature: hasIcoSignature, encode: async () => (await encodeIco(image)).blob },
  ]

  for (const encoder of candidates) {
    let bitmap
    let detail = 'Encoder produced a valid signature and decoded at 2 × 2.'
    try {
      const blob = await encoder.encode()
      if (!blob || blob.type !== encoder.mime || blob.size < 16) { detail = `Encoder returned ${blob?.type || 'no blob'} (${blob?.size || 0} bytes).`; diagnostics.push({ component:encoder.mime, ok:false, detail }); continue }
      const bytes = new Uint8Array(await blob.slice(0, 32).arrayBuffer())
      if (!encoder.signature(bytes)) { detail = 'Encoded bytes did not match the expected format signature.'; diagnostics.push({ component:encoder.mime, ok:false, detail }); continue }
      bitmap = await createImageBitmap(blob)
      if (bitmap.width === 2 && bitmap.height === 2) passed.add(encoder.mime)
      else detail = `Decoder returned ${bitmap.width} × ${bitmap.height}; expected 2 × 2.`
      diagnostics.push({ component:encoder.mime, ok:passed.has(encoder.mime), detail })
    } catch (error) { diagnostics.push({ component:encoder.mime, ok:false, detail:error?.stack || error?.message || String(error) }) }
    finally { bitmap?.close() }
  }
  const portableCandidates = [
    { mime: 'image/qoi', encode: encodeQoi, decode: decodeQoi, signature: bytes => String.fromCharCode(...bytes.subarray(0, 4)) === 'qoif' },
    { mime: 'image/x-portable-pixmap', encode: encodePpm, decode: decodePpm, signature: bytes => bytes[0] === 0x50 && bytes[1] === 0x36 },
  ]
  for (const candidate of portableCandidates) {
    try {
      const blob = candidate.encode(image)
      const bytes = new Uint8Array(await blob.arrayBuffer())
      const decoded = candidate.decode(bytes)
      const ok = blob.type === candidate.mime && candidate.signature(bytes) && decoded.width === image.width && decoded.height === image.height && decoded.data.length === pixels.length
      if (ok) passed.add(candidate.mime)
      diagnostics.push({ component:candidate.mime, ok, detail:ok ? 'Portable encoder round-trip passed.' : 'Portable encoder round-trip validation failed.' })
    } catch (error) { diagnostics.push({ component:candidate.mime, ok:false, detail:error?.stack || error?.message || String(error) }) }
  }
  const extendedCandidates = [
    ['image/x-portable-bitmap','encodePbm','decodePbm'], ['image/x-portable-graymap','encodePgm','decodePgm'],
    ['image/x-portable-arbitrarymap','encodePam','decodePam'], ['image/farbfeld','encodeFarbfeld','decodeFarbfeld'], ['image/x-tga','encodeTga','decodeTga'],
  ]
  for (const [mime, encoder, decoder] of extendedCandidates) {
    try {
      const blob = extendedFormats[encoder](image)
      const bytes = new Uint8Array(await blob.arrayBuffer())
      const decoded = extendedFormats[decoder](bytes)
      const ok = blob.type === mime && decoded.width === image.width && decoded.height === image.height && decoded.data.length === pixels.length
      if (ok) passed.add(mime)
      diagnostics.push({ component:mime, ok, detail:ok ? 'Local encode/decode round-trip passed.' : 'Output type or dimensions failed validation.' })
    } catch (error) { diagnostics.push({ component:mime, ok:false, detail:error?.stack || error?.message || String(error) }) }
  }
  return { encoders: passed, diagnostics }
}
