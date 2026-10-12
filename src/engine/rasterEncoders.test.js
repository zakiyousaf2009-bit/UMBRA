import { describe, expect, it } from 'vitest'
import { encodeBmp, hasBmpSignature, hasIcoSignature } from './rasterEncoders.js'

describe('local bitmap encoders', () => {
  it('writes a valid uncompressed BMP header and pixel data', async () => {
    const blob = encodeBmp({ width: 1, height: 1, data: new Uint8ClampedArray([12, 34, 56, 255]) })
    const bytes = new Uint8Array(await blob.arrayBuffer())
    const view = new DataView(bytes.buffer)
    expect(blob.type).toBe('image/bmp')
    expect(hasBmpSignature(bytes)).toBe(true)
    expect(view.getUint32(2, true)).toBe(58)
    expect(view.getUint16(28, true)).toBe(24)
    expect([...bytes.slice(54, 57)]).toEqual([56, 34, 12])
    expect(bytes).toHaveLength(58)
  })

  it('recognizes the ICO signature used by the PNG container encoder', () => {
    expect(hasIcoSignature(new Uint8Array([0, 0, 1, 0]))).toBe(true)
    expect(hasIcoSignature(new Uint8Array([0, 0, 2, 0]))).toBe(false)
  })
})
