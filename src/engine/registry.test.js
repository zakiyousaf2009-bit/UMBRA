import { describe, expect, it } from 'vitest'
import { formatRegistry, outputFormats } from './registry.js'
import { canEncodeFormat, encoderAdapters } from './adapterRegistry.js'

describe('registry capabilities follow registered adapters', () => {
  it.each(['heic', 'heif', 'hif'])('%s has a working encoder adapter', extension => {
    const format = formatRegistry.find(item => item.id === extension)
    expect(canEncodeFormat(extension)).toBe(true)
    expect(encoderAdapters.some(adapter => adapter.workerModule === './heifEncoder.js')).toBe(true)
    expect(format.encode).toBe(true)
    expect(format.capability).toContain('Encode')
  })

  it('marks sequences, AVC and JPEG 2000 brands with their actual limits', () => {
    expect(formatRegistry.find(item => item.id === 'heics').alternative).toContain('primary still')
    expect(formatRegistry.find(item => item.id === 'avci').decode).toBe(false)
    expect(formatRegistry.find(item => item.id === 'avci').alternative).toContain('AVC decoder')
    expect(formatRegistry.find(item => item.id === 'hej2').alternative).toContain('JPEG 2000 decoder')
  })

  it('exposes HEIC, HEIF and HIF in enabled output commands', () => {
    for (const extension of ['heic','heif','hif']) expect(outputFormats.find(item => item.extension === extension)?.available).toBe(true)
  })

  it.each(['qoi','ppm'])('registers the local %s decoder and encoder', extension => {
    const format = formatRegistry.find(item => item.id === extension)
    expect(canEncodeFormat(extension)).toBe(true)
    expect(format.decode).toBe(true)
    expect(format.encode).toBe(true)
    expect(format.capability).toContain('Decode + Encode')
  })

  it.each(['pbm','pgm','pam','ff','farbfeld','tga'])('registers local %s input and output support', extension => {
    const format = formatRegistry.find(item => item.id === extension)
    expect(canEncodeFormat(extension)).toBe(true)
    expect(format.decode).toBe(true)
    expect(format.encode).toBe(true)
    expect(format.capability).toContain('Decode + Encode')
    expect(outputFormats.some(item => item.extension === (extension === 'farbfeld' ? 'ff' : extension))).toBe(true)
  })
})
