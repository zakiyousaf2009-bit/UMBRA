import { describe, expect, it } from 'vitest'
import { createFilename, sanitizeFilename } from './filename.js'

describe('filename templates', () => {
  it('fills supported tokens and keeps Unicode names', () => {
    expect(createFilename('{name}_{index}_{width}x{height}.{format}', { name:'猫 🐈', index:2, width:640, height:480, format:'webp' })).toBe('猫 🐈_2_640x480.webp')
  })

  it('replaces illegal path and filename characters', () => {
    expect(sanitizeFilename('../holiday:*.jpg')).toBe('..-holiday--.jpg')
  })

  it('adds an automatic suffix for duplicate outputs', () => {
    const used = new Set()
    expect(createFilename('{name}.{format}', { name:'photo', format:'jpg' }, used)).toBe('photo.jpg')
    expect(createFilename('{name}.{format}', { name:'photo', format:'jpg' }, used)).toBe('photo (2).jpg')
  })
})
