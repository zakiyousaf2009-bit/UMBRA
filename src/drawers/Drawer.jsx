import { useEffect, useMemo, useState } from 'react'
import { BookOpen, FileText, HelpCircle, Search, ShieldCheck, X } from 'lucide-react'
import { errorEntries } from '../errors/catalog.js'

const descriptions = {
  'privacy-policy': { icon: ShieldCheck, title: 'Privacy policy', intro: 'Conversion stays on this device. UMBRA does not upload files or keep a file history.', body: ['Selected file bytes and converted results remain in memory in this tab.', 'The app does not write image data, names, previews, results, or session history to browser storage.', 'Offline app assets are cached by the service worker. You can verify outbound requests in your browser Network panel.'] },
  licenses: { icon: BookOpen, title: 'Open-source licenses', intro: 'UMBRA bundles open-source software. Review license terms before redistributing a build.', body: ['libheif is LGPL-3.0 and libde265 is LGPL-3.0-or-later. Preserve their license notices and meet applicable source and relinking obligations.', 'The bundled HEIC encoder links x265, which is GPL-2.0. Publishing a site that ships x265 must comply with GPL-2.0 distribution requirements. Review the exact package contents and obligations before deployment.', 'HEVC patent licensing may also apply depending on jurisdiction, use and distribution. The x265 license does not grant patent-pool rights.', 'The icodec wrapper is MIT licensed. React, Vite, GSAP, Lucide, Sharp, and local font packages retain their upstream licenses. See package-lock.json and their package license files.'] },
  help: { icon: HelpCircle, title: 'Help & error codes', intro: 'Search UMBRA error codes for a plain explanation and next steps.', body: [] },
  'dev-popups': { icon: HelpCircle, title: 'Popup playground', intro: 'Development-only preview of the local notification catalog.', body: [] },
}

export function Drawer({ name, onClose, onNotify }) {
  const [query, setQuery] = useState('')
  const info = descriptions[name] || descriptions.help
  const Icon = info.icon
  const errorMatches = useMemo(() => errorEntries.filter(item => `${item.id} ${item.title} ${item.message}`.toLowerCase().includes(query.toLowerCase())), [query])

  useEffect(() => {
    const previous = document.activeElement
    const background = [...document.querySelectorAll('.site-nav, .app-shell > main, .site-footer')]
    background.forEach(node => { node.inert = true })
    document.querySelector('.drawer-close')?.focus()
    const handleKey = event => {
      if (event.key === 'Escape') onClose()
      if (event.key !== 'Tab') return
      const nodes = document.querySelector('.drawer-panel')?.querySelectorAll('button:not(:disabled),a[href],input:not(:disabled)')
      if (!nodes?.length) return
      const first = nodes[0], last = nodes[nodes.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    window.addEventListener('keydown', handleKey)
    return () => { window.removeEventListener('keydown', handleKey); background.forEach(node => { node.inert = false }); previous?.focus?.() }
  }, [onClose])

  return <div className="drawer-scrim" onMouseDown={event => event.target === event.currentTarget && onClose()}>
    <aside className="drawer-panel" role="dialog" aria-modal="true" aria-labelledby="drawer-title">
      <div className="drawer-top"><div className="drawer-heading"><span className="drawer-icon"><Icon size={19} strokeWidth={1.75}/></span><div><div className="eyebrow">UMBRA / LOCAL PANEL</div><h2 id="drawer-title">{info.title}</h2></div></div><button className="icon-button drawer-close" onClick={onClose} aria-label="Close panel"><X size={18} strokeWidth={1.75}/></button></div>
      <div className="drawer-content"><p className="drawer-intro">{info.intro}</p>
        {info.body.map(line => <p className="drawer-copy" key={line}>{line}</p>)}
        {name === 'help' && <><label className="drawer-search"><Search size={16}/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Search error code or message" autoFocus/></label><div className="error-results">{errorMatches.map(item=><article key={item.key}><div><b>{item.id}</b><strong>{item.title}</strong></div><p>{item.message}</p><small>{item.fix}</small></article>)}</div></>}
        {name === 'dev-popups' && import.meta.env.DEV && <div className="error-results">{errorEntries.map(item=><button className="playground-item" key={item.key} onClick={()=>onNotify(item.key)}><b>{item.id}</b><strong>{item.title}</strong><span>Trigger popup</span></button>)}</div>}
        {name === 'licenses' && <div className="license-note"><FileText size={16}/><span>Codec sources and notices: <code>node_modules/@pbk20191/icodec</code> and <code>node_modules/libheif-js</code>. UMBRA outputs are created locally.</span></div>}
      </div>
    </aside>
  </div>
}

export default Drawer
