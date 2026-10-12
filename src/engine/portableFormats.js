const MAX_PIXELS = 100_000_000

function checkDimensions(width, height) {
  if (!width || !height || width * height > MAX_PIXELS) throw new Error('file-too-large')
}

export function encodeQoi({ data, width, height }) {
  checkDimensions(width, height)
  const maximum = 14 + width * height * 5 + 8
  let output = new Uint8Array(Math.min(maximum, 65536))
  output.set([0x71, 0x6f, 0x69, 0x66])
  const view = new DataView(output.buffer)
  view.setUint32(4, width)
  view.setUint32(8, height)
  output[12] = 4
  output[13] = 0
  let cursor = 14

  const index = Array.from({ length: 64 }, () => [0, 0, 0, 0])
  let previous = [0, 0, 0, 255]
  let run = 0
  const write = (...bytes) => {
    if (cursor + bytes.length > output.length) {
      const grown = new Uint8Array(Math.min(maximum, Math.max(cursor + bytes.length, output.length * 2)))
      grown.set(output)
      output = grown
    }
    output.set(bytes, cursor)
    cursor += bytes.length
  }
  for (let pixel = 0; pixel < width * height; pixel += 1) {
    const offset = pixel * 4
    const current = [data[offset], data[offset + 1], data[offset + 2], data[offset + 3]]
    if (current.every((channel, i) => channel === previous[i])) {
      run += 1
      if (run === 62 || pixel === width * height - 1) { write(0xc0 | (run - 1)); run = 0 }
      continue
    }
    if (run) { write(0xc0 | (run - 1)); run = 0 }
    const hash = (current[0] * 3 + current[1] * 5 + current[2] * 7 + current[3] * 11) % 64
    if (index[hash].every((channel, i) => channel === current[i])) write(hash)
    else {
      index[hash] = current
      if (current[3] === previous[3]) {
        const dr = current[0] - previous[0], dg = current[1] - previous[1], db = current[2] - previous[2]
        const drdg = dr - dg, dbdg = db - dg
        if (dr >= -2 && dr <= 1 && dg >= -2 && dg <= 1 && db >= -2 && db <= 1) write(0x40 | ((dr + 2) << 4) | ((dg + 2) << 2) | (db + 2))
        else if (dg >= -32 && dg <= 31 && drdg >= -8 && drdg <= 7 && dbdg >= -8 && dbdg <= 7) write(0x80 | (dg + 32), ((drdg + 8) << 4) | (dbdg + 8))
        else write(0xfe, current[0], current[1], current[2])
      } else write(0xff, ...current)
    }
    previous = current
  }
  write(0, 0, 0, 0, 0, 0, 0, 1)
  return new Blob([output.subarray(0, cursor)], { type: 'image/qoi' })
}

export function decodeQoi(bytes) {
  if (String.fromCharCode(...bytes.subarray(0, 4)) !== 'qoif' || bytes.length < 22) throw new Error('decode-failed')
  if (![0, 1].includes(bytes[13]) || !bytes.subarray(-8).every((value, i) => value === (i === 7 ? 1 : 0))) throw new Error('decode-failed')
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const width = view.getUint32(4), height = view.getUint32(8), channels = bytes[12]
  checkDimensions(width, height)
  if (![3, 4].includes(channels)) throw new Error('decode-failed')
  const output = new Uint8ClampedArray(width * height * 4)
  const index = Array.from({ length: 64 }, () => [0, 0, 0, 0])
  let pixel = 0, cursor = 14, run = 0
  let previous = [0, 0, 0, 255]
  while (pixel < width * height) {
    if (run) run -= 1
    else {
      if (cursor >= bytes.length - 8) throw new Error('decode-failed')
      const tag = bytes[cursor++]
      if (tag === 0xfe) { if (cursor + 3 > bytes.length - 8) throw new Error('decode-failed'); previous = [bytes[cursor++], bytes[cursor++], bytes[cursor++], previous[3]] }
      else if (tag === 0xff) { if (cursor + 4 > bytes.length - 8) throw new Error('decode-failed'); previous = [bytes[cursor++], bytes[cursor++], bytes[cursor++], bytes[cursor++]] }
      else if ((tag & 0xc0) === 0) previous = index[tag]
      else if ((tag & 0xc0) === 0x40) previous = [previous[0] + ((tag >> 4 & 3) - 2), previous[1] + ((tag >> 2 & 3) - 2), previous[2] + ((tag & 3) - 2), previous[3]]
      else if ((tag & 0xc0) === 0x80) {
        if (cursor >= bytes.length - 8) throw new Error('decode-failed')
        const second = bytes[cursor++], dg = (tag & 0x3f) - 32
        previous = [previous[0] + dg + (second >> 4) - 8, previous[1] + dg, previous[2] + dg + (second & 0x0f) - 8, previous[3]]
      } else run = tag & 0x3f
      const hash = (previous[0] * 3 + previous[1] * 5 + previous[2] * 7 + previous[3] * 11) % 64
      index[hash] = previous
    }
    output.set(previous, pixel * 4)
    pixel += 1
  }
  return { data: output, width, height }
}

export function encodePpm({ data, width, height }) {
  checkDimensions(width, height)
  const header = new TextEncoder().encode(`P6\n${width} ${height}\n255\n`)
  const output = new Uint8Array(header.length + width * height * 3)
  output.set(header)
  for (let source = 0, target = header.length; source < data.length; source += 4) {
    const alpha = data[source + 3] / 255
    output[target++] = Math.round(data[source] * alpha + 255 * (1 - alpha))
    output[target++] = Math.round(data[source + 1] * alpha + 255 * (1 - alpha))
    output[target++] = Math.round(data[source + 2] * alpha + 255 * (1 - alpha))
  }
  return new Blob([output], { type: 'image/x-portable-pixmap' })
}

export function decodePpm(bytes) {
  if (bytes[0] !== 0x50 || bytes[1] !== 0x36) throw new Error('decode-failed')
  let cursor = 2
  const token = () => {
    while (cursor < bytes.length) {
      if ([9, 10, 13, 32].includes(bytes[cursor])) cursor += 1
      else if (bytes[cursor] === 0x23) { while (cursor < bytes.length && bytes[cursor] !== 10) cursor += 1 }
      else break
    }
    const start = cursor
    while (cursor < bytes.length && ![9, 10, 13, 32, 0x23].includes(bytes[cursor])) cursor += 1
    return new TextDecoder().decode(bytes.subarray(start, cursor))
  }
  const width = Number(token()), height = Number(token()), maximum = Number(token())
  checkDimensions(width, height)
  if (!Number.isInteger(maximum) || maximum < 1 || maximum > 255) throw new Error('decode-failed')
  if (bytes[cursor] === 13 && bytes[cursor + 1] === 10) cursor += 2
  else if ([9, 10, 13, 32].includes(bytes[cursor])) cursor += 1
  else throw new Error('decode-failed')
  const count = width * height * 3
  if (bytes.length - cursor < count) throw new Error('decode-failed')
  const data = new Uint8ClampedArray(width * height * 4)
  for (let source = cursor, target = 0; target < data.length; source += 3, target += 4) {
    data[target] = Math.round(bytes[source] * 255 / maximum)
    data[target + 1] = Math.round(bytes[source + 1] * 255 / maximum)
    data[target + 2] = Math.round(bytes[source + 2] * 255 / maximum)
    data[target + 3] = 255
  }
  return { data, width, height }
}
