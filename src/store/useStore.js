import { create } from 'zustand'

const severityRank = { critical: 0, error: 1, confirm: 2, warning: 3, info: 4, success: 5 }

export const useStore = create((set, get) => ({
  files: [],
  output: 'image/webp',
  quality: 0.9,
  running: false,
  popup: null,
  popupQueue: [],
  addFiles: incoming => set(state => ({
    files: [...state.files, ...incoming.map((file, index) => ({
      id: `${Date.now()}-${index}-${Math.random()}`,
      file,
      name: file.name,
      size: file.size,
      status: 'queued',
      output: null,
      inputPreview: URL.createObjectURL(file),
      preview: null,
      outputUrl: null,
      error: null,
    }))],
  })),
  updateFile: (id, patch) => set(state => ({ files: state.files.map(file => file.id === id ? { ...file, ...patch } : file) })),
  setOutput: output => set({ output }),
  setQuality: quality => set({ quality }),
  setRunning: running => set({ running }),
  removeFile: id => set(state => {
    const removed = state.files.find(file => file.id === id)
    if (removed?.inputPreview) URL.revokeObjectURL(removed.inputPreview)
    if (removed?.preview) URL.revokeObjectURL(removed.preview)
    if (removed?.outputUrl && removed.outputUrl !== removed.preview) URL.revokeObjectURL(removed.outputUrl)
    return { files: state.files.filter(file => file.id !== id) }
  }),
  panic: () => {
    get().files.forEach(file => { if (file.inputPreview) URL.revokeObjectURL(file.inputPreview); if (file.preview) URL.revokeObjectURL(file.preview); if (file.outputUrl && file.outputUrl !== file.preview) URL.revokeObjectURL(file.outputUrl) })
    set({ files: [], running: false, popup: null, popupQueue: [], output: 'image/webp', quality: .9 })
  },
  notify: notification => set(state => {
    const item = { ...notification, at: new Date().toLocaleTimeString() }
    const same = item.code && [state.popup, ...state.popupQueue].find(existing => existing?.code === item.code)
    if (same) return state
    const queue = [state.popup, ...state.popupQueue, item].filter(Boolean).sort((a, b) => (severityRank[a.severity] ?? severityRank.info) - (severityRank[b.severity] ?? severityRank.info))
    const [popup, ...popupQueue] = queue
    return { popup, popupQueue }
  }),
  dismiss: () => set(state => ({ popup: state.popupQueue[0] || null, popupQueue: state.popupQueue.slice(1) })),
}))
