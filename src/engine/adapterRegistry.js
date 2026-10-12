const encodableExtensions = new Set(['heic', 'heif', 'hif'])
const rasterExtensions = new Set(['jpg', 'jpeg', 'png', 'webp', 'avif', 'bmp', 'ico', 'qoi', 'ppm', 'pbm', 'pgm', 'pam', 'ff', 'farbfeld', 'tga'])

export const encoderAdapters = [
  {
    id: 'verified-raster',
    extensions: rasterExtensions,
    canEncode(extension) { return rasterExtensions.has(String(extension).replace(/^\./, '').toLowerCase()) },
    workerModule: './workers/convert.worker.js',
  },
  {
    id: 'hevc-heif',
    extensions: encodableExtensions,
    canEncode(extension) { return encodableExtensions.has(String(extension).replace(/^\./, '').toLowerCase()) },
    workerModule: './heifEncoder.js',
  },
]

export function canEncodeFormat(extension) {
  return encoderAdapters.some(adapter => adapter.canEncode(extension))
}
