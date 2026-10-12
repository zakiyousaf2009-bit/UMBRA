import { beforeAll, describe, expect, it } from 'vitest'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import sharp from 'sharp'
import { heic } from '@pbk20191/icodec/node'
import { encodeHeifPixels } from './heifEncoder.js'

const width = 48
const height = 40

function colorPattern(alpha = false) {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
    const index = (y * width + x) * 4
    data[index] = x * 5
    data[index + 1] = y * 6
    data[index + 2] = 150
    data[index + 3] = alpha ? (x < width / 2 ? 0 : 255) : 255
  }
  return data
}

function ftypBrand(bytes) {
  const marker = Buffer.from(bytes).indexOf('ftyp')
  return Buffer.from(bytes).toString('ascii', marker + 4, marker + 8)
}

async function imageFrom(bytes, channels = 4) {
  const { data, info } = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  return { data: new Uint8ClampedArray(data), width: info.width, height: info.height, depth: 8, channels }
}

describe('local HEVC HEIC encoder', () => {
  let encoderModule
  let appHeifDecoder
  beforeAll(async () => {
    const gluePath = pathToFileURL(resolve('public/wasm/heif-encoder/heic-enc.js')).href
    const [{ default: createEncoder }, encoderWasm] = await Promise.all([
      import(/* @vite-ignore */ gluePath),
      readFile('public/wasm/heif-encoder/heic-enc.wasm'),
    ])
    encoderModule = await createEncoder({ wasmBinary: new Uint8Array(encoderWasm) })
    await heic.loadDecoder()
    const [{ default: createLibHeif }, libHeifWasm] = await Promise.all([
      import('libheif-js/libheif-wasm/libheif-bundle.mjs'),
      readFile('node_modules/libheif-js/libheif-wasm/libheif.wasm'),
    ])
    appHeifDecoder = await createLibHeif({ wasmBinary: new Uint8Array(libHeifWasm), locateFile: () => '' })
  }, 60_000)

  it('encodes a real RGBA image into an ISO BMFF HEVC file', () => {
    const raw = { data: colorPattern(), width, height, depth: 8 }
    const encoded = encodeHeifPixels(encoderModule, raw, { extension:'heic', quality:88, preset:'ultrafast', chroma:'444' })
    expect(ftypBrand(encoded)).toBe('heic')
    expect(encoded.length).toBeGreaterThan(100)
  })

  it('encodes an explicit 10-bit HEVC output', () => {
    const raw = { data: colorPattern(), width, height, depth: 8 }
    const encoded = encodeHeifPixels(encoderModule, raw, { extension:'heic', quality:88, bitDepth:10, chroma:'420', preset:'ultrafast' })
    expect(ftypBrand(encoded)).toBe('heic')
    expect([heic.decode(encoded).width, heic.decode(encoded).height]).toEqual([width, height])
  })

  it('opens the HEIC output with UMBRA’s bundled libheif decoder', () => {
    const raw = { data: colorPattern(), width, height, depth: 8 }
    const encoded = encodeHeifPixels(encoderModule, raw, { extension:'heic', quality:90, preset:'ultrafast', chroma:'420' })
    const decoder = new appHeifDecoder.HeifDecoder()
    const images = decoder.decode(encoded)
    expect(images.length).toBeGreaterThan(0)
    expect(images[0].get_width()).toBe(width)
    expect(images[0].get_height()).toBe(height)
    images.forEach(image => image.free())
    if (decoder.decoder) appHeifDecoder.heif_context_free(decoder.decoder)
  }, 60_000)

  it('round trips JPEG pixels with matching dimensions and useful PSNR', async () => {
    const png = await sharp(colorPattern(), { raw: { width, height, channels: 4 } }).jpeg({ quality: 95 }).toBuffer()
    const input = await imageFrom(png)
    const heif = encodeHeifPixels(encoderModule, input, { extension:'heic', quality:90, preset:'ultrafast', chroma:'444' })
    const decoded = heic.decode(heif)
    expect([decoded.width, decoded.height]).toEqual([width, height])
    const outputJpeg = await sharp(decoded.data, { raw: { width, height, channels: 4 } }).jpeg({ quality: 90 }).toBuffer()
    expect(await sharp(outputJpeg).metadata()).toMatchObject({ width, height, format: 'jpeg' })
    let squaredError = 0
    for (let index = 0; index < input.data.length; index += 4) for (let channel = 0; channel < 3; channel += 1) squaredError += (input.data[index + channel] - decoded.data[index + channel]) ** 2
    squaredError /= width * height * 3
    expect(10 * Math.log10((255 ** 2) / squaredError)).toBeGreaterThan(35)
  })

  it('round trips transparent PNG pixels and can emit generic mif1-branded HEIF', async () => {
    const png = await sharp(colorPattern(true), { raw: { width, height, channels: 4 } }).png().toBuffer()
    const input = await imageFrom(png)
    const encoded = encodeHeifPixels(encoderModule, input, { extension:'heic', lossless:true, preset:'ultrafast', chroma:'444' })
    const decoded = heic.decode(encoded)
    expect([decoded.width, decoded.height]).toEqual([width, height])
    for (let pixel = 0; pixel < width * height; pixel += 1) expect(decoded.data[pixel * 4 + 3]).toBe(input.data[pixel * 4 + 3])
    const outputPng = await sharp(decoded.data, { raw: { width, height, channels: 4 } }).png().toBuffer()
    expect(await sharp(outputPng).metadata()).toMatchObject({ width, height, format: 'png' })
    const generic = encodeHeifPixels(encoderModule, input, { extension:'hif', lossless:true, preset:'ultrafast', chroma:'444' })
    expect(ftypBrand(generic)).toBe('mif1')
  })
})
