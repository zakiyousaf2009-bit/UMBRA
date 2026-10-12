async function decodeHeif(buffer) {
  let library
  try {
    const [{ default: createModule }, { default: wasmUrl }] = await Promise.all([
      import('libheif-js/libheif-wasm/libheif-bundle.mjs'),
      import('libheif-js/libheif-wasm/libheif.wasm?url'),
    ])
    const response = await fetch(wasmUrl, { credentials: 'same-origin' })
    if (!response.ok) throw new Error('Local HEIF decoder asset could not be read.')
    library = await createModule({ wasmBinary: await response.arrayBuffer(), locateFile: () => wasmUrl })
  } catch (error) {
    throw Object.assign(new Error('codec-load-failed'), { cause: error })
  }

  const decoder = new library.HeifDecoder()
  let images
  try { images = decoder.decode(new Uint8Array(buffer)) }
  catch { throw new Error('heif-corrupt') }
  if (!images?.length) throw new Error('heif-unsupported-brand')
  const image = images.find(candidate => candidate.is_primary()) || images[0]
  const width = image.get_width(), height = image.get_height()
  if (!width || !height || width * height > 100_000_000) throw new Error('heif-out-of-memory')
  const result = await new Promise((resolve, reject) => {
    const target = { data: new Uint8ClampedArray(width * height * 4), width, height }
    image.display(target, value => value ? resolve(value) : reject(new Error('heif-corrupt')))
  }).catch(() => { throw new Error('heif-corrupt') })
  images.forEach(candidate => candidate.free())
  if (decoder.decoder) library.heif_context_free(decoder.decoder)
  return { data: result.data, width, height, depth: 8 }
}

async function createLocalBitmap(blob) {
  try { return await createImageBitmap(blob) }
  catch (nativeError) {
    if (typeof ImageDecoder === 'undefined' || !blob.type) throw nativeError
    const decoder = new ImageDecoder({ data: await blob.arrayBuffer(), type: blob.type })
    try {
      await decoder.tracks.ready
      const frame = await decoder.decode({ frameIndex: 0 })
      return frame.image
    } finally { decoder.close() }
  }
}

async function decodeNative(buffer, sourceMime, sourceFormat) {
  if (sourceMime === 'image/qoi' || sourceMime === 'image/x-portable-pixmap') {
    const { decodeQoi, decodePpm } = await import('../engine/portableFormats.js')
    return (sourceMime === 'image/qoi' ? decodeQoi : decodePpm)(new Uint8Array(buffer))
  }
  const extendedMime = {
    pbm:'image/x-portable-bitmap', pgm:'image/x-portable-graymap', pam:'image/x-portable-arbitrarymap',
    ff:'image/farbfeld', farbfeld:'image/farbfeld', tga:'image/x-tga',
  }[sourceFormat]
  if (extendedMime && (sourceMime === extendedMime || sourceMime === '')) {
    const codecs = await import('../engine/extendedFormats.js')
    const decoder = { 'image/x-portable-bitmap':codecs.decodePbm, 'image/x-portable-graymap':codecs.decodePgm, 'image/x-portable-arbitrarymap':codecs.decodePam, 'image/farbfeld':codecs.decodeFarbfeld, 'image/x-tga':codecs.decodeTga }[extendedMime]
    return decoder(new Uint8Array(buffer))
  }
  let bitmap
  try { bitmap = await createLocalBitmap(new Blob([buffer], { type: sourceMime || '' })) }
  catch (cause) { throw Object.assign(new Error('decode-failed'), { cause }) }
  const width = bitmap.displayWidth || bitmap.width
  const height = bitmap.displayHeight || bitmap.height
  if (!width || !height || width * height > 100_000_000) {
    bitmap.close()
    throw new Error('file-too-large')
  }
  const canvas = new OffscreenCanvas(width, height)
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) { bitmap.close(); throw new Error('decode-failed') }
  context.drawImage(bitmap, 0, 0)
  bitmap.close()
  return context.getImageData(0, 0, canvas.width, canvas.height)
}

async function encodeNative(image, mime, quality, backgroundColor) {
  const canvas = new OffscreenCanvas(image.width, image.height)
  const context = canvas.getContext('2d', { alpha: mime !== 'image/jpeg' })
  const pixels = new ImageData(image.data, image.width, image.height)
  if (mime === 'image/jpeg') {
    context.fillStyle = backgroundColor || '#ffffff'
    context.fillRect(0,0,image.width,image.height)
    const source = new OffscreenCanvas(image.width,image.height)
    source.getContext('2d').putImageData(pixels,0,0)
    context.drawImage(source,0,0)
  } else context.putImageData(pixels, 0, 0)
  const blob = await canvas.convertToBlob({ type: mime, quality })
  if (!blob.size) throw new Error('encode-failed')
  const validation = await createLocalBitmap(blob).catch(() => null)
  if (!validation || validation.width !== image.width || validation.height !== image.height) { validation?.close(); throw new Error('encode-failed') }
  validation.close()
  return { buffer: await blob.arrayBuffer(), mime: blob.type, width: image.width, height: image.height }
}

async function encodeAdditional(image, mime) {
  const { encodeBmp, encodeIco } = await import('../engine/rasterEncoders.js')
  const encoded = mime === 'image/bmp' ? { blob: encodeBmp(image), width: image.width, height: image.height } : await encodeIco(image)
  const validation = await createLocalBitmap(encoded.blob).catch(() => null)
  if (!validation || validation.width !== encoded.width || validation.height !== encoded.height) {
    validation?.close()
    throw new Error('encode-failed')
  }
  validation.close()
  return { buffer: await encoded.blob.arrayBuffer(), mime: encoded.blob.type, width: encoded.width, height: encoded.height }
}

async function encodePortable(image, mime) {
  const { decodeQoi, decodePpm, encodeQoi, encodePpm } = await import('../engine/portableFormats.js')
  const extended = await import('../engine/extendedFormats.js')
  const portable = {
    'image/qoi':{encode:encodeQoi,decode:decodeQoi}, 'image/x-portable-pixmap':{encode:encodePpm,decode:decodePpm},
    'image/x-portable-bitmap':{encode:extended.encodePbm,decode:extended.decodePbm},
    'image/x-portable-graymap':{encode:extended.encodePgm,decode:extended.decodePgm},
    'image/x-portable-arbitrarymap':{encode:extended.encodePam,decode:extended.decodePam},
    'image/farbfeld':{encode:extended.encodeFarbfeld,decode:extended.decodeFarbfeld},
    'image/x-tga':{encode:extended.encodeTga,decode:extended.decodeTga},
  }[mime]
  if (!portable) throw new Error('unsupported-format')
  const blob = portable.encode(image)
  const decoded = portable.decode(new Uint8Array(await blob.arrayBuffer()))
  if (decoded.width !== image.width || decoded.height !== image.height || !decoded.data.some(value => value !== 0)) throw new Error('encode-failed')
  return { buffer: await blob.arrayBuffer(), mime, width: image.width, height: image.height }
}

self.onmessage = async ({ data }) => {
  const { id, buffer, rawPixels, rawWidth, rawHeight, mime, sourceMime, sourceFormat, quality, backgroundColor, container, heifOptions = {} } = data
  let activeStage = 'probe'
  let activeAdapter = 'format detector'
  const stage = (name, phase, adapter) => {
    activeStage = name
    activeAdapter = adapter || activeAdapter
    self.postMessage({ id, status:'stage', stage:name, phase, adapter, time:performance.now() })
  }
  try {
    stage('probe','start','magic-byte detection (main thread)')
    stage('probe','end',sourceMime || 'unknown input type')
    stage('load codec','start',container === 'heif' || ['image/heic','image/heif','image/hif'].includes(mime) ? 'libheif-js / x265 WASM' : 'browser raster APIs')
    stage('load codec','end',container === 'heif' || ['image/heic','image/heif','image/hif'].includes(mime) ? 'libheif-js / x265 WASM' : 'browser raster APIs')
    stage('decode','start',rawPixels ? 'page-native pixel fallback' : container === 'heif' ? 'libheif-js' : 'worker createImageBitmap / ImageDecoder')
    const decoded = rawPixels ? { data: new Uint8ClampedArray(rawPixels), width: rawWidth, height: rawHeight } : container === 'heif' ? await decodeHeif(buffer) : await decodeNative(buffer, sourceMime, sourceFormat)
    stage('decode','end',rawPixels ? 'page-native pixel fallback' : container === 'heif' ? 'libheif-js' : 'worker createImageBitmap / ImageDecoder')
    const raw = decoded
    let result
    stage('encode','start',mime)
    if (['image/heic', 'image/heif', 'image/hif'].includes(mime)) {
      const { heifEncoderAdapter } = await import('../engine/heifEncoder.js')
      const encoded = await heifEncoderAdapter.encode(raw, heifOptions, state => self.postMessage({ id, status: 'preparing-heif', ...state }))
      const validation = await decodeHeif(await encoded.blob.arrayBuffer())
      if (validation.width !== raw.width || validation.height !== raw.height || !validation.data?.some(value=>value!==0)) throw new Error('encode-failed')
      const preview = await encodeNative(raw, 'image/png', 1)
      result = { buffer: encoded.blob.size ? await encoded.blob.arrayBuffer() : encoded.bytes, previewBuffer: preview.buffer, mime: encoded.blob.type, width: raw.width, height: raw.height, warnings: encoded.warnings, extension: heifOptions.extension || 'heic' }
    } else if (mime === 'image/bmp' || mime === 'image/x-icon') result = await encodeAdditional(raw, mime)
    else if (['image/qoi','image/x-portable-pixmap','image/x-portable-bitmap','image/x-portable-graymap','image/x-portable-arbitrarymap','image/farbfeld','image/x-tga'].includes(mime)) result = await encodePortable(raw, mime)
    else result = await encodeNative(raw, mime, quality, backgroundColor)
    stage('encode','end',mime)
    stage('validate','start',mime)
    if (!result.buffer || !result.buffer.byteLength || result.width < 1 || result.height < 1) throw new Error('encode-failed')
    stage('validate','end',mime)
    self.postMessage({ id, ...result, engine:rawPixels ? 'native decode + worker encode' : 'worker' }, result.previewBuffer ? [result.buffer, result.previewBuffer] : [result.buffer])
  } catch (error) {
    const code = typeof error?.message === 'string' && /^[a-z][a-z0-9-]+$/.test(error.message) ? error.message : activeStage === 'decode' ? 'decode-failed' : 'encode-failed'
    self.postMessage({ id, error: code, stage:activeStage, adapter:activeAdapter, message: error?.cause?.message || error?.message || code, stack:String(error?.cause?.stack || error?.stack || '').split('\n').slice(0,8).join('\n') })
  }
}

self.postMessage({ type:'ready' })
