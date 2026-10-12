/** Encode a real 24-bit BMP without relying on a browser codec. */
export function encodeBmp(image) {
  const { data, width, height } = image
  const rowBytes = Math.ceil(width * 3 / 4) * 4
  const pixelsSize = rowBytes * height
  const bytes = new Uint8Array(54 + pixelsSize)
  const view = new DataView(bytes.buffer)
  bytes[0] = 0x42
  bytes[1] = 0x4d
  view.setUint32(2, bytes.length, true)
  view.setUint32(10, 54, true)
  view.setUint32(14, 40, true)
  view.setInt32(18, width, true)
  view.setInt32(22, height, true)
  view.setUint16(26, 1, true)
  view.setUint16(28, 24, true)
  view.setUint32(34, pixelsSize, true)
  for (let y = 0; y < height; y += 1) {
    const row = 54 + (height - 1 - y) * rowBytes
    for (let x = 0; x < width; x += 1) {
      const input = (y * width + x) * 4
      const output = row + x * 3
      const alpha = data[input + 3] / 255
      bytes[output] = Math.round(data[input + 2] * alpha + 255 * (1 - alpha))
      bytes[output + 1] = Math.round(data[input + 1] * alpha + 255 * (1 - alpha))
      bytes[output + 2] = Math.round(data[input] * alpha + 255 * (1 - alpha))
    }
  }
  return new Blob([bytes], { type: 'image/bmp' })
}

/** Encode a PNG-backed ICO. Images larger than 256px are reduced to icon bounds. */
export async function encodeIco(image) {
  const scale = Math.min(1, 256 / image.width, 256 / image.height)
  const width = Math.max(1, Math.round(image.width * scale))
  const height = Math.max(1, Math.round(image.height * scale))
  const source = new OffscreenCanvas(image.width, image.height)
  source.getContext('2d').putImageData(new ImageData(image.data, image.width, image.height), 0, 0)
  const canvas = new OffscreenCanvas(width, height)
  canvas.getContext('2d').drawImage(source, 0, 0, width, height)
  const png = await canvas.convertToBlob({ type: 'image/png' })
  if (!png.size) throw new Error('encode-failed')
  const pngBytes = new Uint8Array(await png.arrayBuffer())
  const output = new Uint8Array(22 + pngBytes.length)
  const view = new DataView(output.buffer)
  view.setUint16(2, 1, true)
  view.setUint16(4, 1, true)
  output[6] = width === 256 ? 0 : width
  output[7] = height === 256 ? 0 : height
  view.setUint16(10, 1, true)
  view.setUint16(12, 32, true)
  view.setUint32(14, pngBytes.length, true)
  view.setUint32(18, 22, true)
  output.set(pngBytes, 22)
  return { blob: new Blob([output], { type: 'image/x-icon' }), width, height }
}

export function hasBmpSignature(bytes) {
  return bytes[0] === 0x42 && bytes[1] === 0x4d
}

export function hasIcoSignature(bytes) {
  return bytes[0] === 0 && bytes[1] === 0 && bytes[2] === 1 && bytes[3] === 0
}
