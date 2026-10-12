import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { gsap } from 'gsap'
import { Flip } from 'gsap/Flip'
import { Logo } from './brand/Logo.jsx'
import Drawer from './drawers/Drawer.jsx'
import Popup from './components/Popup.jsx'
import HomeSection from './sections/HomeSection.jsx'
import WorkspaceSection from './sections/WorkspaceSection.jsx'
import { detectFormat } from './engine/detect.js'
import { outputFormats } from './engine/registry.js'
import { runNativeCapabilitySelfTest } from './engine/capabilitySelfTest.js'
import { errorCatalog } from './errors/catalog.js'
import { createFilename } from './utils/filename.js'
import { isSvgImage } from './utils/fileTypes.js'
import { useStore } from './store/useStore.js'

gsap.registerPlugin(Flip)
const drawerHashes = new Set(['privacy-policy','licenses','help','dev-popups'])

export default function App() {
  const appRef = useRef(null)
  const { files, addFiles, updateFile, setRunning, notify } = useStore()
  const [drawer, setDrawer] = useState(null)
  const [dragging, setDragging] = useState(false)
  const [offlineReady, setOfflineReady] = useState(false)
  const [installPrompt, setInstallPrompt] = useState(null)
  const [preparingHeif, setPreparingHeif] = useState(false)
  const [verifiedEncoders, setVerifiedEncoders] = useState(()=>new Set(outputFormats.filter(item=>['image/heic','image/heif','image/hif'].includes(item.id)&&item.available).map(item=>item.id)))
  const [capabilitiesReady, setCapabilitiesReady] = useState(false)
  const isConverting = useRef(false)
  const conversionControl = useRef({ paused:false, cancelled:false })
  const [paused, setPaused] = useState(false)
  const downloadsExist = files.some(file => file.status === 'done')

  const tell = useCallback((code, extra = {}) => {
    const item = errorCatalog[code]
    notify({ code, ...(item || {}), ...extra })
  }, [notify])

  const openDrawer = useCallback(name => {
    setDrawer(name)
    if (window.location.hash.slice(1) !== name) window.history.pushState(null, '', `#${name}`)
  }, [])

  useEffect(() => {
    let active = true
    Promise.all([runWorkerStartupCheck(), runNativeCapabilitySelfTest(), runUtilityDiagnostics()]).then(([workerResult, {encoders, diagnostics:nativeResults}, utilityResults])=>{
      if (!active) return
      const lazyResults = [
        {component:'libheif-js decoder',ok:null,detail:'Deferred by design; loaded only when a HEIF input is converted.'},
        {component:'bundled HEVC encoder',ok:null,detail:'Deferred by design; loaded only when HEIC/HEIF/HIF output is selected.'},
        {component:'ImageMagick WASM',ok:null,detail:'Not bundled or registered in this build.'},
      ]
      const report = [workerResult, ...nativeResults, ...utilityResults, ...lazyResults]
      report.filter(result=>result.ok===false).forEach(result=>console.warn(`[UMBRA diagnostics] ${result.component}: ${result.detail}`))
      const nativeOnly = new Set(['image/jpeg','image/png','image/webp','image/avif'])
      const heifOutputs = workerResult.ok
        ? outputFormats.filter(item=>['image/heic','image/heif','image/hif'].includes(item.id)&&item.available).map(item=>item.id)
        : []
      const availableEncoders = workerResult.ok ? new Set([...encoders,...heifOutputs]) : new Set([...encoders].filter(mime=>nativeOnly.has(mime)))
      setVerifiedEncoders(availableEncoders)
      const current=useStore.getState().output
      if (!availableEncoders.has(current)) {
        const fallback=['image/webp','image/jpeg','image/png'].find(mime=>availableEncoders.has(mime))
        if (fallback) useStore.getState().setOutput(fallback)
      }
      setCapabilitiesReady(true)
    }).catch(error=>{
      if (!active) return
      console.warn('[UMBRA diagnostics] startup check failed',error)
      setCapabilitiesReady(true)
    })
    return ()=>{active=false}
  }, [])
  const closeDrawer = useCallback(() => {
    setDrawer(null)
    if (drawerHashes.has(window.location.hash.slice(1))) window.history.replaceState(null, '', '#convert')
  }, [])

  const jumpTo = useCallback(id => {
    if (drawerHashes.has(id)) { openDrawer(id); return }
    window.history.pushState(null, '', '#convert')
    document.getElementById('convert')?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })
  }, [openDrawer])

  const addImages = useCallback(list => {
    const incoming = Array.from(list || []).filter(file => file instanceof File)
    if (!incoming.length) return
    const state = Flip.getState('.file-card')
    addFiles(incoming)
    const added=useStore.getState().files.slice(-incoming.length)
    added.forEach(async item=>{try{const detected=await detectFormat(item.file);updateFile(item.id,{detectedFormat:(detected.format||detected.ext||'image').toUpperCase()})}catch{}})
    requestAnimationFrame(() => requestAnimationFrame(() => Flip.from(state, { duration: .38, ease: 'power2.out', absolute: true, prune: true })))
    setTimeout(() => jumpTo('convert'), 40)
  }, [addFiles, jumpTo, updateFile])

  const convertAll = useCallback(async (heifOptions = {}) => {
    if (isConverting.current || !files.some(file => file.status !== 'done')) return
    isConverting.current = true
    conversionControl.current = { paused:false, cancelled:false }
    setPaused(false)
    setRunning(true)
    for (const file of files) {
      while (conversionControl.current.paused && !conversionControl.current.cancelled) await new Promise(resolve=>setTimeout(resolve,100))
      if (conversionControl.current.cancelled) break
      if (file.status === 'done') continue
      updateFile(file.id, { status: 'converting' })
      let stage = 'probe'
      try {
        if (import.meta.env.DEV) console.debug(`[UMBRA ${file.id}]`, 'probe start', { name:file.name, hasNestedFile:file.file instanceof File })
        if (!file.size) throw new Error('zero-byte')
        const detected = await detectFormat(file.file)
        if (import.meta.env.DEV) console.debug(`[UMBRA ${file.id}]`, 'probe end', { format:detected.format, mime:detected.mime, mismatch:detected.mismatch })
        if (detected.mismatch) tell('wrong-extension', { title: `${file.name} looks like ${detected.format.toUpperCase()}` })
        if (detected.unknown && detected.container === 'heif') throw new Error('heif-unsupported-brand')
        if (detected.unknown && ['heic','heif','hif','heics','heifs','avci','avcs','hej2'].includes(detected.extension)) throw new Error('heif-corrupt')
        const isHeif = detected.container === 'heif'
        if (!isHeif && isSvgImage(file, detected.ext)) throw new Error('unsupported-format')
        updateFile(file.id,{ detectedFormat:(detected.format||detected.ext||'image').toUpperCase() })
        const targetMime = useStore.getState().output
        if (!targetMime) throw new Error('unsupported-format')
        const targetFormat = outputFormats.find(item => item.id === targetMime)
        stage = 'worker decode / encode'
        const result = await runConversionWorker(file.file,{ id:file.id, mime:targetMime, sourceMime:detected.mime || file.file.type || '', sourceFormat:detected.ext || detected.extension, quality:heifOptions.best ? .97 : useStore.getState().quality, backgroundColor:heifOptions.backgroundColor, container:isHeif?'heif':'native', heifOptions: { ...heifOptions, quality:heifOptions.best?100:heifOptions.quality, preset:heifOptions.best?'slow':heifOptions.preset, extension:targetFormat?.extension || (isHeif ? 'heic' : 'jpg') } },setPreparingHeif)
        setPreparingHeif(false)
        stage = 'result handling'
        const blob = new Blob([result.buffer], { type:result.mime })
        const outputUrl = URL.createObjectURL(blob)
        const preview = result.previewBuffer ? URL.createObjectURL(new Blob([result.previewBuffer], { type:'image/png' })) : outputUrl
        const extension = { 'image/jpeg':'jpg', 'image/png':'png', 'image/webp':'webp', 'image/avif':'avif', 'image/bmp':'bmp', 'image/x-icon':'ico', 'image/qoi':'qoi', 'image/x-portable-pixmap':'ppm', 'image/x-portable-bitmap':'pbm', 'image/x-portable-graymap':'pgm', 'image/x-portable-arbitrarymap':'pam', 'image/farbfeld':'ff', 'image/x-tga':'tga', 'image/heic':result.extension || 'heic' }[result.mime] || 'png'
        const fileDate = new Date(file.file.lastModified || Date.now())
        const outputName = createFilename('{name}.{format}', { name:file.name.replace(/\.[^.]+$/, ''), format:extension, width:result.width, height:result.height, date:fileDate.toLocaleDateString('en-CA'), time:fileDate.toLocaleTimeString('en-GB').replace(/:/g,'-') }, new Set(useStore.getState().files.filter(item=>item.outputName).map(item=>item.outputName)))
        updateFile(file.id, { status:'done', output:blob, preview, outputUrl, width:result.width, height:result.height, outputName, engine:result.engine || (result.mime.startsWith('image/heic') ? 'HEVC WASM' : 'browser worker') })
        if (result.warnings?.length) tell('heif-metadata-warning', { message:result.warnings.join(' ') })
      } catch (error) {
        setPreparingHeif(false)
        const code = errorCatalog[error?.code || error?.message] ? (error.code || error.message) : 'decode-failed'
        if (import.meta.env.DEV) console.error(`[UMBRA ${file.id}] conversion failed`, { stage:error?.stage || stage, code, adapter:error?.adapter, name:error?.name, message:error?.detail || error?.message || String(error), stack:error?.workerStack || error?.stack })
        const errorDetails = { code, stage:error?.stage || stage, adapter:error?.adapter || 'browser-native / worker pipeline', message:error?.detail || error?.message || String(error), stack:String(error?.workerStack || error?.stack || '').split('\n').slice(0, 8).join('\n'), primaryError:error?.primaryError, workerUrl:error?.workerUrl, filename:error?.filename, line:error?.line, column:error?.column }
        updateFile(file.id, { status:'failed', error:code, errorDetails })
        tell(code, { affectedFiles:[file.name], cause:errorDetails.message, technical:errorDetails })
      }
    }
    setRunning(false)
    setPaused(false)
    isConverting.current = false
    if (files.length && !conversionControl.current.cancelled) tell('batch-finished', { severity:'success', title:'Local conversion complete', message:'Review your converted files in the workspace.' })
  }, [files, setRunning, tell, updateFile])

  const togglePause = useCallback(() => { conversionControl.current.paused = !conversionControl.current.paused; setPaused(conversionControl.current.paused) }, [])
  const cancelConversion = useCallback(() => { conversionControl.current.cancelled = true; conversionControl.current.paused = false; setPaused(false) }, [])

  const requestClear = useCallback(() => notify({ severity:'confirm', kind:'confirm-clear', title:'Clear this session?', message:'This removes every queued image, preview and converted result from this tab.' }), [notify])
  const confirmClear = useCallback(() => { cancelConversion(); useStore.getState().panic(); closeDrawer() }, [cancelConversion, closeDrawer])
  const showError = useCallback((code, extra = {}) => tell(code || 'decode-failed', extra), [tell])
  useEffect(() => {
    const context = gsap.context(() => {
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      if (!reduced) {
        gsap.from('.drop-zone, .converter-card', { y:12, opacity:0, duration:.42, stagger:.08, ease:'power2.out' })
      }
    }, appRef)
    const visibility = () => document.hidden ? gsap.globalTimeline.pause() : gsap.globalTimeline.resume()
    document.addEventListener('visibilitychange', visibility)
    return () => { document.removeEventListener('visibilitychange', visibility); context.revert() }
  }, [])

  useEffect(() => {
    const onHash = () => {
      const hash = window.location.hash.slice(1)
      if (drawerHashes.has(hash) && (hash !== 'dev-popups' || import.meta.env.DEV)) setDrawer(hash)
      else if (hash === 'convert') {
        setDrawer(null)
        requestAnimationFrame(() => document.getElementById('convert')?.scrollIntoView({ behavior:'instant' }))
      }
    }
    const onOffline = () => tell('network-offline')
    const onNetworkAttempt = () => tell('network-attempt-blocked')
    const onInstall = event => { event.preventDefault(); setInstallPrompt(event); tell('install-pwa') }
    const onBeforeUnload = event => { if (downloadsExist) { event.preventDefault(); event.returnValue = '' } }
    onHash()
    window.addEventListener('hashchange', onHash)
    window.addEventListener('offline', onOffline)
    window.addEventListener('umbra:network-blocked', onNetworkAttempt)
    window.addEventListener('beforeinstallprompt', onInstall)
    window.addEventListener('beforeunload', onBeforeUnload)
    if ('serviceWorker' in navigator) navigator.serviceWorker.ready.then(() => setOfflineReady(true)).catch(() => {})
    return () => {
      window.removeEventListener('hashchange', onHash)
      window.removeEventListener('offline', onOffline)
      window.removeEventListener('umbra:network-blocked', onNetworkAttempt)
      window.removeEventListener('beforeinstallprompt', onInstall)
      window.removeEventListener('beforeunload', onBeforeUnload)
    }
  }, [downloadsExist, tell])

  useEffect(() => {
    const keydown = event => {
      const command = event.metaKey || event.ctrlKey
      if (command && event.key.toLowerCase() === 'o') { event.preventDefault(); document.querySelector('#image-picker')?.click() }
      if (command && event.shiftKey && event.key === 'Delete') { event.preventDefault(); requestClear() }
    }
    window.addEventListener('keydown', keydown)
    return () => window.removeEventListener('keydown', keydown)
  }, [requestClear])

  useEffect(() => {
    const paste = event => { const files = Array.from(event.clipboardData?.files || []); if (files.length) addImages(files) }
    window.addEventListener('paste', paste)
    return () => window.removeEventListener('paste', paste)
  }, [addImages])

  return <div ref={appRef} className={`app-shell ${dragging?'dragging':''}`} onDragOver={event=>{if(event.dataTransfer.types.includes('Files')){event.preventDefault();setDragging(true)}}} onDragLeave={event=>{if(!event.currentTarget.contains(event.relatedTarget))setDragging(false)}} onDrop={async event=>{event.preventDefault();setDragging(false);addImages(await filesFromDrop(event.dataTransfer))}}>
    {dragging&&<div className="global-drop-hint"><span><ArrowRight size={17}/> Drop to add images to your local queue</span></div>}
    <header className="site-nav"><a href="#convert" className="logo-link" onClick={event=>{event.preventDefault();jumpTo('convert')}}><Logo/></a><div className="nav-actions"><span className="offline-pill"><i className="live-dot"/>Private · local only</span></div></header>
    <main>
      <section className="converter-section" id="convert"><div className="converter-intro"><h1>Convert images.<br/><span>Keep them private.</span></h1><p>Local image conversion. No uploads. No file history.</p></div><HomeSection onFiles={addImages}/><WorkspaceSection onConvert={convertAll} onError={showError} preparingHeif={preparingHeif} paused={paused} onPause={togglePause} onCancel={cancelConversion} verifiedEncoders={verifiedEncoders} capabilitiesReady={capabilitiesReady}/></section>
    </main>
    <footer className="site-footer"><a href="#convert" className="footer-brand" onClick={event=>{event.preventDefault();jumpTo('convert')}}><Logo/></a><p>Convert anything. Leave no trace.</p><div className="footer-links"><button onClick={()=>openDrawer('privacy-policy')}>Privacy</button><button onClick={()=>openDrawer('licenses')}>Licenses</button><button onClick={()=>openDrawer('help')}>Help</button></div><div className="footer-base"><span><i className="live-dot"/> {offlineReady?'Offline ready':'Works offline after first visit'}</span><small>UMBRA · 0.2.0</small><small className="designer-credit">Designed and developed by Zaki Yousaf</small></div></footer>
    {drawer&&<Drawer name={drawer} onClose={closeDrawer} onNotify={tell}/>}
    <Popup onConfirmClear={confirmClear} onRetry={convertAll}/>
    {installPrompt&&<button className="install-prompt" onClick={()=>{installPrompt.prompt();setInstallPrompt(null)}}>Install UMBRA</button>}
  </div>
}

async function filesFromDrop(transfer) {
  const entries=Array.from(transfer.items||[]).map(item=>item.webkitGetAsEntry?.()).filter(Boolean)
  if (!entries.length) return transfer.files
  const walk=async entry=>{
    if(entry.isFile)return new Promise(resolve=>entry.file(file=>resolve([file]),()=>resolve([])))
    if(!entry.isDirectory)return []
    const reader=entry.createReader(),found=[]
    while(true){const batch=await new Promise(resolve=>reader.readEntries(resolve,()=>resolve([])));if(!batch.length)break;for(const child of batch)found.push(...await walk(child))}
    return found
  }
  return (await Promise.all(entries.map(walk))).flat()
}

async function runConversionWorker(file, options, onPreparing) {
  let usePageDecode = false
  const job = options.id || 'unknown'
  const trace = (...values) => { if (import.meta.env.DEV) console.debug(`[UMBRA ${job}]`, ...values) }
  const workerUrl = new URL('./workers/convert.worker.js', import.meta.url).href
  for (let attempt=0;attempt<2;attempt++) {
    let worker
    try {
      const workerStarted = performance.now()
      worker=new Worker(new URL('./workers/convert.worker.js',import.meta.url),{type:'module'})
      trace('worker start', { attempt:attempt + 1, url:workerUrl })
      return await new Promise((resolve,reject)=>{
        let ready = false
        const readyTimer = setTimeout(() => {
          const error = new Error(`Worker did not send its ready handshake within 3000 ms: ${workerUrl}`)
          error.code = 'worker-crashed'; error.stage = 'worker startup'; error.adapter = 'module worker'; error.workerUrl = workerUrl
          trace('worker ready timeout', { url:workerUrl, timeoutMs:3000 })
          worker.terminate(); reject(error)
        }, 3000)
        const fail = error => { clearTimeout(readyTimer); worker.terminate(); reject(error) }
        worker.onmessage=event=>{
          if (event.data?.type === 'ready') {
            if (ready) return
            ready = true
            clearTimeout(readyTimer)
            trace('worker ready', { url:workerUrl, elapsedMs:Math.round(performance.now() - workerStarted) })
            Promise.all([file.arrayBuffer(),usePageDecode ? decodeFilePixels(file) : Promise.resolve(null)]).then(([buffer,pixels])=>{
              const message = { ...options, buffer, ...(pixels ? { rawPixels:pixels.data.buffer, rawWidth:pixels.width, rawHeight:pixels.height } : {}) }
              worker.postMessage(message,pixels ? [buffer,pixels.data.buffer] : [buffer])
            }).catch(error=>{error.stage='worker input preparation';trace('input preparation failed',{name:error.name,message:error.message,stack:error.stack});fail(error)})
            return
          }
          if (!ready) return
          if (event.data.status === 'stage') {
            trace(event.data.stage, event.data.phase, { adapter:event.data.adapter, elapsedMs:Math.round(performance.now() - workerStarted) })
            return
          }
          if(event.data.status==='preparing-heif'){onPreparing(true);return}
          clearTimeout(readyTimer)
          worker.terminate()
          if (event.data.error) {
            const error = new Error(event.data.error)
            error.detail = event.data.message
            error.stage = event.data.stage
            error.adapter = event.data.adapter
            error.workerStack = event.data.stack
            trace('worker error', { code:error.message, stage:error.stage, adapter:error.adapter, message:error.detail, stack:error.workerStack })
            reject(error)
          } else { trace('worker success', { engine:usePageDecode ? 'page decode + worker encode' : 'worker', elapsedMs:Math.round(performance.now() - workerStarted) }); resolve(event.data) }
        }
        worker.onerror=event=>{
          const error=new Error(event.message || 'Worker script failed to load.')
          error.code='worker-crashed'; error.stage='worker startup/runtime'; error.adapter='module worker'; error.filename=event.filename || ''; error.line=event.lineno || 0; error.column=event.colno || 0; error.workerStack=event.error?.stack || ''; error.workerUrl=workerUrl; error.workerReady=ready
          error.detail = `${error.message} (worker URL: ${workerUrl}; filename: ${error.filename || 'not provided'}; line: ${error.line}; column: ${error.column})`
          trace('worker runtime error', { message:event.message, filename:event.filename, line:event.lineno, column:event.colno, url:workerUrl, stack:error.workerStack })
          fail(error)
        }
        worker.onmessageerror=event=>{const error=new Error('Worker message could not be deserialized.');error.code='worker-message-error';error.stage='worker messaging';error.adapter='module worker';error.workerUrl=workerUrl;error.workerReady=ready;error.detail=`${error.message} URL: ${workerUrl}`;trace('worker message error',{url:workerUrl,data:event.data});fail(error)}
      })
    } catch(error) {
      worker?.terminate()
      trace('job rejected', { code:error.code || error.message, stage:error.stage, message:error.detail || error.message, stack:error.workerStack || error.stack })
      if (error.message === 'decode-failed' && options.container !== 'heif' && !usePageDecode && attempt === 0) {
        trace('retry with page-native decoder')
        usePageDecode = true
        continue
      }
      if ((error.code || error.message) === 'worker-crashed' && error.workerReady && attempt === 0) continue
      try {
        const fallback = await runNativeFallback(file, options)
        trace('native fallback success', { engine:fallback.engine, mime:fallback.mime, width:fallback.width, height:fallback.height })
        return fallback
      } catch (fallbackError) {
        fallbackError.primaryError = { code:error.code || error.message, stage:error.stage, adapter:error.adapter, message:error.detail || error.message, stack:error.workerStack || error.stack, workerUrl:error.workerUrl, filename:error.filename, line:error.line, column:error.column }
        if (['worker-crashed','worker-message-error','worker-ready-timeout'].includes(error.code)) fallbackError.code = 'worker-crashed'
        trace('native fallback failed', { code:fallbackError.code, stage:fallbackError.stage, adapter:fallbackError.adapter, message:fallbackError.message, primaryError:fallbackError.primaryError })
        throw fallbackError
      }
    } finally { onPreparing(false) }
  }
}

async function runNativeFallback(file, options) {
  const supported = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif'])
  if (!supported.has(options.mime)) throw Object.assign(new Error(`The browser fallback cannot encode ${options.mime || 'this format'}.`), { code:'encode-failed', stage:'native fallback', adapter:'HTMLCanvasElement' })
  let bitmap
  try { bitmap = await loadBrowserImage(file) }
  catch (cause) { throw Object.assign(new Error('The browser could not decode this image in the fallback engine.'), { code:'decode-failed', stage:'native fallback decode', adapter:'createImageBitmap', cause }) }
  try {
    const width = bitmap.naturalWidth || bitmap.width
    const height = bitmap.naturalHeight || bitmap.height
    if (!width || !height || width * height > 100_000_000) throw Object.assign(new Error('The image is empty or exceeds the 100 megapixel memory limit.'), { code:'file-too-large', stage:'native fallback decode', adapter:'createImageBitmap' })
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d', { alpha:options.mime !== 'image/jpeg' })
    if (!context) throw Object.assign(new Error('A 2D canvas could not be created.'), { code:'encode-failed', stage:'native fallback encode', adapter:'HTMLCanvasElement' })
    if (options.mime === 'image/jpeg') {
      context.fillStyle = options.backgroundColor || '#ffffff'
      context.fillRect(0, 0, width, height)
    }
    context.drawImage(bitmap, 0, 0)
    const quality = Math.max(0, Math.min(1, Number(options.quality ?? .9)))
    const blob = await new Promise((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('Canvas did not produce an output blob.')), options.mime, quality))
    if (!blob.size || blob.type !== options.mime) throw Object.assign(new Error(`Browser encoder returned ${blob.type || 'an empty result'} instead of ${options.mime}.`), { code:'encode-failed', stage:'native fallback encode', adapter:'HTMLCanvasElement' })
    const validation = await createImageBitmap(blob)
    const valid = validation.width === width && validation.height === height
    validation.close()
    if (!valid) throw Object.assign(new Error('The browser output failed its dimension check.'), { code:'encode-failed', stage:'native fallback validate', adapter:'createImageBitmap' })
    return { buffer:await blob.arrayBuffer(), mime:blob.type, width, height, engine:'native fallback' }
  } finally { bitmap.close?.(); if (bitmap instanceof HTMLImageElement && bitmap.src.startsWith('blob:')) URL.revokeObjectURL(bitmap.src) }
}

function runWorkerStartupCheck() {
  const workerUrl = new URL('./workers/convert.worker.js', import.meta.url).href
  const started = performance.now()
  return new Promise(resolve => {
    let worker
    let settled = false
    const finish = result => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      worker?.terminate()
      resolve({ component:'Worker startup', durationMs:Math.round(performance.now()-started), ...result })
    }
    const timer = setTimeout(()=>finish({ok:false,detail:`No ready message within 3000 ms. URL: ${workerUrl}`}),3000)
    try {
      worker = new Worker(new URL('./workers/convert.worker.js', import.meta.url), { type:'module' })
      worker.onmessage = event => { if (event.data?.type === 'ready') finish({ok:true,detail:`Ready handshake received. URL: ${workerUrl}`}) }
      worker.onerror = event => finish({ok:false,detail:`${event.message || 'Worker failed to load'}; URL: ${workerUrl}; filename: ${event.filename || 'not provided'}; line: ${event.lineno || 0}; column: ${event.colno || 0}; stack: ${event.error?.stack || 'not provided'}`})
      worker.onmessageerror = () => finish({ok:false,detail:`Worker startup message could not be decoded. URL: ${workerUrl}`})
    } catch (error) { finish({ok:false,detail:`${error?.stack || error?.message || String(error)}; URL: ${workerUrl}`}) }
  })
}

async function runUtilityDiagnostics() {
  try {
    const { zipSync } = await import('fflate')
    const bytes = zipSync({ 'umbra-diagnostic.txt':new TextEncoder().encode('ok') })
    return [{component:'ZIP creation',ok:bytes.length>0,detail:bytes.length>0?`Created a ${bytes.length}-byte in-memory ZIP.`:'ZIP encoder returned an empty result.'}]
  } catch (error) { return [{component:'ZIP creation',ok:false,detail:error?.stack||error?.message||String(error)}] }
}

async function loadBrowserImage(file) {
  try { return await createImageBitmap(file) }
  catch {
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.src = url
    try { await image.decode(); return image }
    catch (cause) { URL.revokeObjectURL(url); throw cause }
  }
}

async function decodeFilePixels(file) {
  let bitmap, objectUrl
  try {
    try { bitmap = await createImageBitmap(file) }
    catch {
      objectUrl = URL.createObjectURL(file)
      const image = new Image()
      image.src = objectUrl
      await image.decode()
      bitmap = image
    }
    const width = bitmap.naturalWidth || bitmap.width
    const height = bitmap.naturalHeight || bitmap.height
    if (!width || !height || width * height > 100_000_000) throw new Error('file-too-large')
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d', { willReadFrequently:true })
    if (!context) throw new Error('decode-failed')
    context.drawImage(bitmap,0,0)
    const pixels = context.getImageData(0,0,width,height)
    return { data:pixels.data, width, height }
  } catch (error) {
    if (error.message === 'file-too-large') throw error
    throw new Error('decode-failed')
  } finally {
    bitmap?.close?.()
    if (objectUrl) URL.revokeObjectURL(objectUrl)
  }
}

