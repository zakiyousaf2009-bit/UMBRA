import { describe, expect, it } from 'vitest'
import { decodePpm, decodeQoi, encodePpm, encodeQoi } from './portableFormats.js'
import { detectBytes } from './detect.js'

const sample = { width: 2, height: 1, data: new Uint8ClampedArray([255, 20, 30, 255, 0, 200, 80, 128]) }

describe('portable image format round trips', () => {
  it('encodes and decodes QOI without changing RGBA pixels', async () => {
    const blob = encodeQoi(sample)
    const bytes = new Uint8Array(await blob.arrayBuffer())
    const decoded = decodeQoi(bytes)
    expect(detectBytes(bytes).ext).toBe('qoi')
    expect([decoded.width, decoded.height]).toEqual([sample.width, sample.height])
    expect(decoded.data).toEqual(sample.data)
  })

  it('encodes and decodes binary PPM with transparent pixels composited over white', async () => {
    const blob = encodePpm(sample)
    const bytes = new Uint8Array(await blob.arrayBuffer())
    const decoded = decodePpm(bytes)
    expect(detectBytes(bytes).ext).toBe('ppm')
    expect([decoded.width, decoded.height]).toEqual([sample.width, sample.height])
    expect([...decoded.data]).toEqual([255,20,30,255,127,227,167,255])
  })

  it('rejects malformed QOI and PPM data', () => {
    expect(() => decodeQoi(new Uint8Array([1, 2, 3]))).toThrow()
    expect(() => decodePpm(new TextEncoder().encode('P6\n1 1\n255\n\0'))).toThrow()
  })
})
