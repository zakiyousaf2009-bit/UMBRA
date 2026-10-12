import { beforeEach, describe, expect, it } from 'vitest'
import { useStore } from './useStore.js'

describe('popup priority queue', () => {
  beforeEach(() => useStore.setState({ popup:null, popupQueue:[] }))

  it('shows the highest priority notification first', () => {
    useStore.getState().notify({ severity:'info', code:'first-info', title:'Info' })
    useStore.getState().notify({ severity:'warning', code:'then-warning', title:'Warning' })
    useStore.getState().notify({ severity:'critical', code:'last-critical', title:'Critical' })
    expect(useStore.getState().popup.code).toBe('last-critical')
  })

  it('deduplicates queued errors with the same code', () => {
    useStore.getState().notify({ severity:'error', code:'same-error', title:'Error' })
    useStore.getState().notify({ severity:'error', code:'same-error', title:'Error' })
    expect(useStore.getState().popupQueue).toHaveLength(0)
  })
})
