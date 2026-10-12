import { describe, expect, it } from 'vitest'
import { errorCatalog, errorEntries } from './catalog.js'

describe('UMBRA error catalog', () => {
  it('has a readable UMB code, title, message and fix for every entry', () => {
    expect(errorEntries.length).toBeGreaterThan(20)
    for (const item of errorEntries) {
      expect(item.id).toMatch(/^UMB-\d{4}$/)
      expect(item.title).toBeTruthy()
      expect(item.message).toBeTruthy()
      expect(item.fix).toBeTruthy()
    }
  })

  it('contains no duplicate UMB error identifiers', () => {
    expect(new Set(errorEntries.map(item=>item.id)).size).toBe(errorEntries.length)
  })

  it('offers retry for a failed local HEIF engine load', () => {
    expect(errorCatalog['heif-encode-unavailable']).toMatchObject({ id:'UMB-1029', severity:'error', retry:true })
  })

  it('offers retry when the worker and native fallback both fail', () => {
    expect(errorCatalog['worker-crashed']).toMatchObject({ id:'UMB-1010', severity:'error', retry:true })
  })
})
