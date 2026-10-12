import { beforeAll, describe, expect, it } from 'vitest'
import { readFile } from 'node:fs/promises'
import sharp from 'sharp'
import { heic } from '@pbk20191/icodec/node'
import { detectBytes } from '../src/engine/detect.js'

const fixture=name=>readFile(new URL(`./fixtures/${name}`,import.meta.url))

describe('checked-in raster fixtures',()=>{
  it.each(['sample.jpg','alpha.png','sample.webp','sample.avif','animated.gif','sample-16bit.tiff'])('decodes %s at expected dimensions',async name=>{
    const metadata=await sharp(await fixture(name)).metadata()
    expect([metadata.width,metadata.height]).toEqual([24,18])
  })

  it('keeps the alpha, animation, and 16-bit fixture properties',async()=>{
    expect((await sharp(await fixture('alpha.png')).metadata()).hasAlpha).toBe(true)
    expect((await sharp(await fixture('animated.gif')).metadata()).pages).toBe(2)
    expect((await sharp(await fixture('sample-16bit.tiff')).metadata()).bitsPerSample).toBe(16)
    expect((await sharp(await fixture('sample.avif')).metadata()).mediaType).toBe('image/avif')
  })

  it('marks the SVG fixture as a local, self-contained sample',async()=>{
    const svg=(await fixture('sample.svg')).toString()
    expect(svg).toContain('<svg')
    expect(svg).not.toMatch(/(?:href|src)=["']https?:/i)
  })
})

describe('checked-in HEVC fixtures',()=>{
  beforeAll(()=>heic.loadDecoder())
  it.each(['sample.heic','sample.hif'])('decodes %s and has a recognized HEIF brand',async name=>{
    const bytes=await fixture(name)
    const image=heic.decode(bytes)
    expect([image.width,image.height]).toEqual([24,18])
    expect(detectBytes(new Uint8Array(bytes)).container).toBe('heif')
  })
})
