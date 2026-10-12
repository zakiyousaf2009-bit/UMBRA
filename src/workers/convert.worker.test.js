import { afterEach, describe, expect, it, vi } from 'vitest'

describe('conversion worker startup', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('imports in a worker-like global and announces readiness without loading codecs', async () => {
    const postMessage = vi.fn()
    vi.stubGlobal('self', { postMessage, location: { origin: 'http://localhost:5173' } })

    await import('./convert.worker.js?startup-test')

    expect(globalThis.self.onmessage).toBeTypeOf('function')
    expect(postMessage).toHaveBeenCalledWith({ type: 'ready' })
  })
})
