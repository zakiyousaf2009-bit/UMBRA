let encoderPromise

const supported = new Set(['heic', 'heif', 'hif'])
const defaultOptions = { quality: 50, lossless: false, preset: 'slow', tune: 'ssim', tuIntraDepth: 2, complexity: 50, chroma: '420', sharpYUV: false }

function failure(key, message) {
  return Object.assign(new Error(key), { cause: message })
}

async function loadEncoder(onProgress) {
  onProgress?.({ message: 'Preparing HEIC engine...', progress: 0 })
  if (!encoderPromise) {
    encoderPromise = (async () => {
      try {
        const glueUrl = new URL('/wasm/heif-encoder/heic-enc.js', self.location.origin).href
        const [{ default: createEncoder }, wasmResponse] = await Promise.all([
          import(/* @vite-ignore */ glueUrl),
          fetch(new URL('/wasm/heif-encoder/heic-enc.wasm', self.location.origin), { credentials: 'same-origin' }),
        ])
        if (!wasmResponse.ok) throw new Error(`Local encoder asset returned ${wasmResponse.status}.`)
        const wasmBytes = new Uint8Array(await wasmResponse.arrayBuffer())
        const module = await createEncoder({ wasmBinary: wasmBytes })
        onProgress?.({ message: 'HEIC engine ready.', progress: 1 })
        return module
      } catch (cause) {
        encoderPromise = null
        throw failure('heif-encode-unavailable', cause?.message || 'The bundled HEVC encoder could not start.')
      }
    })()
  }
  return encoderPromise
}

function convertBitDepth(image, targetDepth) {
  if ((image.depth || 8) === targetDepth) return image
  const pixelValues = image.width * image.height * 4
  const input = image.depth === 8 ? image.data : new Uint16Array(image.data.buffer, image.data.byteOffset)
  const from = (1 << (image.depth || 8)) - 1
  const to = (1 << targetDepth) - 1
  const samples = new Uint16Array(pixelValues)
  for (let index = 0; index < pixelValues; index += 1) samples[index] = Math.round(input[index] / from * to)
  return { ...image, data: new Uint8ClampedArray(samples.buffer), depth: targetDepth }
}

function encodePixels(module, image, options) {
  const holder = {}
  module.encode(image.data, image.width, image.height, { ...defaultOptions, ...options, bitDepth: image.depth || 8 }, holder)
  const output = holder.error || holder.success
  if (typeof output === 'string') throw new Error(output)
  if (output instanceof Error) throw output
  if (!output) throw new Error('HEVC encoder returned no image bytes.')
  return new Uint8Array(output)
}

export function encodeHeifPixels(module, rawImage, options = {}) {
  const extension = String(options.extension || 'heic').replace(/^\./, '').toLowerCase()
  if (!supported.has(extension)) throw failure('unsupported-format', `Unsupported HEIF output extension: ${extension}`)
  const bitDepth = Number(options.bitDepth) === 10 ? 10 : 8
  const image = convertBitDepth(rawImage, bitDepth)
  const bytes = setFtypBrand(encodePixels(module, image, {
    quality: Math.max(1, Math.min(100, Number(options.quality) || 90)),
    lossless: Boolean(options.lossless),
    preset: options.preset || 'medium',
    chroma: options.chroma === '444' ? '444' : '420',
  }), extension)
  return bytes
}

function setFtypBrand(bytes, extension) {
  let marker = -1
  for (let index = 0; index <= bytes.length - 4; index += 1) {
    if (bytes[index] === 0x66 && bytes[index + 1] === 0x74 && bytes[index + 2] === 0x79 && bytes[index + 3] === 0x70) { marker = index; break }
  }
  if (marker < 4 || marker + 8 > bytes.length) throw failure('heif-encode-failed', 'The HEVC encoder returned an invalid ISO BMFF file.')
  const majorBrand = extension === 'heif' || extension === 'hif' ? 'mif1' : 'heic'
  bytes.set([...majorBrand].map(character => character.charCodeAt(0)), marker + 4)
  return bytes
}

/** A lazy, worker-only HEVC image adapter. It accepts browser-decoded RGBA pixels. */
export const heifEncoderAdapter = {
  canEncode(extension) { return supported.has(String(extension).replace(/^\./, '').toLowerCase()) },
  notes(extension) {
    const suffix = String(extension).replace(/^\./, '').toLowerCase()
    return `Decodes selected HEVC stills. Encodes ${suffix.toUpperCase()} with local x265 HEVC; metadata, HDR preservation, animation and auxiliary images are not retained.`
  },
  async encode(rawImage, options = {}, onProgress) {
    const extension = String(options.extension || 'heic').replace(/^\./, '').toLowerCase()
    if (!this.canEncode(extension)) throw failure('unsupported-format', `Unsupported HEIF output extension: ${extension}`)
    if (!rawImage?.data || !rawImage.width || !rawImage.height) throw failure('heif-encode-failed', 'No decoded RGBA pixels were provided.')
    const module = await loadEncoder(onProgress)
    const bytes = encodeHeifPixels(module, rawImage, options)
    const warnings = []
    if (options.keepExif || options.keepIcc) warnings.push('The HEVC encoder accepts RGBA pixels only; EXIF and ICC metadata were not embedded.')
    return { blob: new Blob([bytes], { type: 'image/heic' }), warnings, bytes }
  },
}

export { setFtypBrand }
