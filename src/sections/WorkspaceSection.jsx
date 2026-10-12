import { useEffect, useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { ArrowDownToLine, ArrowRight, CircleHelp, CircleX, FileImage, RotateCcw } from 'lucide-react'
import { outputFormats } from '../engine/registry.js'
import { useStore } from '../store/useStore.js'
import { zipSync } from 'fflate'

const defaultHeifOptions = { quality: 90, lossless: false, bitDepth: 8, chroma: '420', preset: 'medium', stripGps: true }

export function WorkspaceSection({ onConvert, onError, preparingHeif = false, paused = false, onPause, onCancel, verifiedEncoders = new Set(), capabilitiesReady = false }) {
  const { files, output, setOutput, running, removeFile, updateFile } = useStore()
  const [best, setBest] = useState(false)
  const [compareId, setCompareId] = useState(null)
  const listRef = useRef(null)
  const virtualizer = useVirtualizer({ count: files.length, getScrollElement: () => listRef.current, estimateSize: () => 73, overscan: 6 })
  const enabledOutputs = outputFormats.filter(item => verifiedEncoders.has(item.id))

  const download = file => {
    if (!file.output || !(file.outputUrl || file.preview)) return
    const link = document.createElement('a')
    link.href = file.outputUrl || file.preview
    link.download = file.outputName
    link.click()
  }
  const downloadAll = () => files.filter(file => file.status === 'done').forEach(download)
  const downloadZip = async () => {
    try {
      const completed = files.filter(file => file.status === 'done' && file.output)
      const entries = await Promise.all(completed.map(async file => [file.outputName, new Uint8Array(await file.output.arrayBuffer())]))
      const archive = zipSync(Object.fromEntries(entries))
      const url = URL.createObjectURL(new Blob([archive], { type: 'application/zip' }))
      const link = document.createElement('a')
      link.href = url
      link.download = 'umbra-images.zip'
      link.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch { onError('zip-failed') }
  }
  const saveToFolder = async () => {
    try {
      const folder = await window.showDirectoryPicker()
      for (const file of files.filter(item => item.status === 'done' && item.output)) {
        const handle = await folder.getFileHandle(file.outputName, { create: true })
        const writable = await handle.createWritable()
        await writable.write(file.output)
        await writable.close()
      }
    } catch (error) { if (error?.name !== 'AbortError') onError('permission-denied') }
  }

  return <div className="workspace-section" id="workspace">
    <div className="converter-card">
      <div className="converter-card-head"><div><h2>Image converter</h2><p>Convert one image or a batch. Your files stay on this device.</p></div></div>
      <div className="convert-controls">
        <label className="field-label">Format<select aria-label="Format" disabled={!capabilitiesReady || !enabledOutputs.length} value={verifiedEncoders.has(output) ? output : ''} onChange={event => setOutput(event.target.value)}>{!capabilitiesReady && <option value="">Checking formats…</option>}{enabledOutputs.map(item => <option value={item.id} key={item.id}>{item.label}</option>)}</select></label>
        <button className="button-primary convert-button" onClick={() => onConvert({ ...defaultHeifOptions, best })} disabled={!capabilitiesReady || !files.length || running}>{running ? <><span className="small-spinner"/> {preparingHeif ? 'Preparing HEIC engine…' : 'Converting locally'}</> : <>Convert {files.length || ''} image{files.length === 1 ? '' : 's'} <ArrowRight size={16}/></>}</button>
      </div>
      <div className="option-rows"><label><input type="checkbox" checked={best} onChange={event => setBest(event.target.checked)}/><span><b>Improve quality</b><small>Uses maximum quality for lossy formats; lossless formats keep full pixel data.</small></span></label></div>
    </div>
    <div className="queue-heading"><strong>{files.length} {files.length === 1 ? 'image' : 'images'}</strong><span>{running ? `${files.filter(file => file.status === 'done').length} of ${files.length} complete` : 'Files remain in memory for this session'}</span>{running && <><button className="quiet-button" onClick={onPause}>{paused ? 'Resume' : 'Pause'}</button><button className="quiet-button" onClick={onCancel}>Cancel</button></>}{files.some(file => file.status === 'done') && <><button className="quiet-button" onClick={downloadAll}><ArrowDownToLine size={14}/> Download all</button><button className="quiet-button" onClick={downloadZip}>Download ZIP</button>{'showDirectoryPicker' in window && <button className="quiet-button" onClick={saveToFolder}>Save to folder</button>}</>}</div>
    {files.length === 0 ? <div className="queue-empty"><FileImage size={22}/><span>Converted images will appear here.</span></div> : <div className="queue-list" ref={listRef} style={{ height: Math.min(470, files.length * 73) }}><div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>{virtualizer.getVirtualItems().map(row => { const file = files[row.index]; return <article className="file-card" key={file.id} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: row.size, transform: `translateY(${row.start}px)` }}><div className={`file-thumb ${file.status}`}>{(file.preview || file.inputPreview) ? <img src={file.preview || file.inputPreview} alt=""/> : <FileImage size={19}/>}</div><div className="file-description"><strong title={file.name}>{file.name}</strong><span>{file.detectedFormat || 'Image'} · {(file.size / 1024 / 1024).toFixed(2)} MB {file.output ? `→ ${(file.output.size / 1024 / 1024).toFixed(2)} MB${file.size ? ` (${Math.round((1 - file.output.size / file.size) * 100)}% saved)` : ''}` : ''}{file.width ? ` · ${file.width} × ${file.height}` : ''}{file.engine ? ` · ${file.engine}` : ''}</span>{file.status === 'failed' && <small className="file-error-reason">{file.errorDetails?.message || 'Conversion failed. Open details for the technical error.'}</small>}</div><div className={`file-status ${file.status}`}>{file.status === 'done' ? 'Done' : file.status === 'failed' ? 'Failed' : file.status === 'converting' ? 'Converting' : 'Queued'}{file.status === 'converting' && <span className="progress-ring"/>}</div>{file.status === 'done' ? <><button className="quiet-button compare-button" onClick={() => setCompareId(file.id)}>Compare</button><button className="icon-button" aria-label={`Download ${file.name}`} onClick={() => download(file)}><ArrowDownToLine size={16}/></button></> : file.status === 'failed' ? <><button className="quiet-button retry-button" onClick={() => onConvert({ ...defaultHeifOptions, best })}><RotateCcw size={14}/>Retry</button><button className="icon-button" aria-label={`View technical details for ${file.name}`} onClick={() => onError(file.error, { cause:file.errorDetails?.message, technical:file.errorDetails })}><CircleHelp size={16}/></button></> : null}<button className="icon-button remove-button" aria-label={`Remove ${file.name}`} onClick={() => removeFile(file.id)}><CircleX size={17}/></button></article> })}</div></div>}
    {compareId && <CompareOverlay file={files.find(file => file.id === compareId)} onClose={() => setCompareId(null)}/>}
  </div>
}

function CompareOverlay({ file, onClose }) {
  const [source, setSource] = useState('')
  useEffect(() => { if (!file) return; const url = URL.createObjectURL(file.file); setSource(url); return () => URL.revokeObjectURL(url) }, [file])
  if (!file) return null
  return <div className="compare-scrim" role="presentation" onMouseDown={event => event.target === event.currentTarget && onClose()}><section className="compare-dialog" role="dialog" aria-modal="true" aria-label="Before and after image comparison"><div className="compare-head"><strong>{file.name}</strong><button className="quiet-button" onClick={onClose}>Close</button></div><div className="compare-images"><figure><img src={source} alt="Original image"/><figcaption>Original</figcaption></figure><figure><img src={file.preview || file.outputUrl} alt="Converted image"/><figcaption>Converted · {file.width} × {file.height}</figcaption></figure></div></section></div>
}

export default WorkspaceSection
