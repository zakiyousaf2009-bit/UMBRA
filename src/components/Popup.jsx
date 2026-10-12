import { useEffect, useRef } from 'react'
import { AlertOctagon, Check, CircleAlert, CircleHelp, Info, ShieldAlert, X } from 'lucide-react'
import { errorCatalog } from '../errors/catalog.js'
import { useStore } from '../store/useStore.js'

const icons = { critical: ShieldAlert, error: CircleAlert, warning: CircleHelp, info: Info, success: Check, confirm: AlertOctagon }

export function Popup({ onConfirmClear, onRetry }) {
  const { popup, dismiss } = useStore()
  const primary = useRef(null)
  const active = useRef(null)
  const item = popup?.code ? { ...(errorCatalog[popup.code] || {}), ...popup } : popup

  useEffect(() => {
    if (!popup) return undefined
    const oldFocus = document.activeElement
    const background = [...document.querySelectorAll('.site-nav, .app-shell > main, .site-footer, .drawer-panel')]
    background.forEach(node => { node.inert = true })
    primary.current?.focus()
    const keydown = event => {
      if (event.key === 'Escape' && item?.severity !== 'critical') dismiss()
      if (event.key !== 'Tab') return
      const nodes = active.current?.querySelectorAll('button:not(:disabled),a[href],input:not(:disabled)')
      if (!nodes?.length) return
      const first = nodes[0], last = nodes[nodes.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    window.addEventListener('keydown', keydown)
    return () => { window.removeEventListener('keydown', keydown); background.forEach(node => { node.inert = false }); oldFocus?.focus?.() }
  }, [popup, dismiss, item?.severity])

  if (!popup || !item) return null
  const Icon = icons[item.severity] || Info
  const critical = item.severity === 'critical'

  return <div className="popup-backdrop" onMouseDown={event=>event.target===event.currentTarget&&!critical&&dismiss()}>
    <section ref={active} className={`popup-card popup-${item.severity}`} role={['critical','error','confirm'].includes(item.severity)?'alertdialog':'dialog'} aria-modal="true" aria-labelledby="popup-title" aria-describedby="popup-message">
      <button className="icon-button popup-close" onClick={dismiss} aria-label="Close notification" disabled={critical}><X size={17}/></button>
      <span className="popup-symbol"><Icon size={19} strokeWidth={1.75}/></span>
      <div className="eyebrow">{item.id || 'UMBRA'} · {item.severity?.toUpperCase() || 'NOTICE'}</div>
      <h2 id="popup-title">{item.title || 'UMBRA notice'}</h2>
      <p id="popup-message">{item.message || item.what || 'The local image task finished.'}</p>
      {item.cause&&<div className="popup-detail"><b>Why it happened</b><span>{item.cause}</span></div>}
      {item.fix&&<div className="popup-detail"><b>How to fix it</b><span>{item.fix}</span></div>}
      {item.technical && <details className="popup-technical">
        <summary>Technical details</summary>
        <dl>
          <dt>Stage</dt><dd>{item.technical.stage}</dd>
          <dt>Adapter</dt><dd>{item.technical.adapter}</dd>
          <dt>Error</dt><dd>{item.technical.message}</dd>
          {item.technical.workerUrl && <><dt>Worker URL</dt><dd>{item.technical.workerUrl}</dd></>}
          {item.technical.filename && <><dt>Filename</dt><dd>{item.technical.filename}</dd></>}
          {item.technical.line !== undefined && <><dt>Line / col</dt><dd>{item.technical.line} / {item.technical.column}</dd></>}
        </dl>
        {item.technical.stack && <pre>{item.technical.stack}</pre>}
        {item.technical.primaryError && <>
          <strong>Primary engine attempt</strong>
          <dl>
            <dt>Stage</dt><dd>{item.technical.primaryError.stage}</dd>
            <dt>Adapter</dt><dd>{item.technical.primaryError.adapter}</dd>
            <dt>Error</dt><dd>{item.technical.primaryError.message}</dd>
          </dl>
          {item.technical.primaryError.stack && <pre>{String(item.technical.primaryError.stack).split('\n').slice(0,8).join('\n')}</pre>}
        </>}
      </details>}
      {popup.code&&<code className="error-code">{item.id}</code>}
      <div className="popup-actions">{popup.kind==='confirm-clear'?<><button className="button-secondary" onClick={dismiss}>Keep files</button><button ref={primary} className="button-danger" onClick={onConfirmClear}>Clear session</button></>:<>{item.retry&&<button className="button-secondary" onClick={()=>{dismiss();onRetry?.()}}>Retry conversion</button>}<button ref={primary} className="button-primary" onClick={dismiss}>{critical?'Acknowledge':'Close'}</button></>}</div>
    </section>
  </div>
}

export default Popup
