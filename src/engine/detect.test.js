import { describe, expect, it } from 'vitest'
import { detectBytes, detectFormat } from './detect.js'

function ftyp(brand, compatible = []) {
  const brands = compatible
  const bytes = new Uint8Array(16 + brands.length * 4)
  new DataView(bytes.buffer).setUint32(0, bytes.length)
  bytes.set(new TextEncoder().encode('ftyp'), 4)
  bytes.set(new TextEncoder().encode(brand.padEnd(4,' ').slice(0,4)), 8)
  new DataView(bytes.buffer).setUint32(12, 0)
  brands.forEach((item,index)=>bytes.set(new TextEncoder().encode(item.padEnd(4,' ').slice(0,4)),16+index*4))
  return bytes
}

describe('image magic-byte detection', () => {
  it.each(['heic','heix','mif1','avif','avci','avcs','hej2'])('recognizes the %s ISO BMFF brand', brand => {
    const detected = detectBytes(ftyp(brand))
    expect(detected.container).toBe('heif')
    expect(detected.unknown).toBe(false)
    expect(detected.ext).toBe(brand === 'avif' ? 'avif' : 'heic')
  })

  it('recognizes an HIF-style HEIF-compatible brand regardless of extension', () => {
    const detected = detectBytes(ftyp('mif1',['heic']))
    expect(detected.brands).toContain('mif1')
    expect(detected.brands).toContain('heic')
    expect(detected.container).toBe('heif')
  })

  it('accepts HIF as an HEIF filename after inspecting its container bytes', async () => {
    const file = new File([ftyp('mif1')], 'camera.hif', { type:'image/jpeg' })
    const detected = await detectFormat(file)
    expect(detected.container).toBe('heif')
    expect(detected.mismatch).toBe(false)
  })

  it('detects PNG from its signature', () => {
    expect(detectBytes(Uint8Array.from([137,80,78,71,13,10,26,10])).ext).toBe('png')
  })

  it.each([['P4','pbm'],['P5','pgm'],['P6','ppm'],['P7','pam'],['farbfeld','ff']])('detects %s from its header', (header, extension) => {
    const bytes = new TextEncoder().encode(header)
    expect(detectBytes(bytes).ext).toBe(extension)
  })

  it('recognizes TGA by extension because uncompressed TGA has no fixed magic signature', async () => {
    const file = new File([new Uint8Array(18)], 'image.tga', { type:'' })
    expect(await detectFormat(file)).toMatchObject({ ext:'tga', mime:'image/x-tga', unknown:false })
  })

  it('accepts .farbfeld as an alias for the farbfeld magic signature', async () => {
    const file = new File([new TextEncoder().encode('farbfeld')], 'image.farbfeld', { type:'image/farbfeld' })
    expect(await detectFormat(file)).toMatchObject({ ext:'ff', mismatch:false })
  })
})
