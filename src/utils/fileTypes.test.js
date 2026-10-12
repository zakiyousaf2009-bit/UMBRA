import { describe, expect, it } from 'vitest'
import { isSvgImage } from './fileTypes.js'

describe('image type checks accept queued File records', () => {
  it('reads MIME type from the File nested in a queue record', () => {
    const queueItem = { file: new File(['<svg/>'], 'drawing.svg', { type: 'image/svg+xml' }) }
    expect(isSvgImage(queueItem)).toBe(true)
  })

  it('does not treat ordinary queued JPEGs as SVG', () => {
    const queueItem = { file: new File(['jpeg'], 'photo.jpg', { type: 'image/jpeg' }) }
    expect(isSvgImage(queueItem, 'jpg')).toBe(false)
  })

  it('recognizes SVG extensions when the browser supplies no MIME type', () => {
    const queueItem = { file: new File(['svg'], 'drawing.svg', { type: '' }) }
    expect(isSvgImage(queueItem, 'svg')).toBe(true)
  })
})
