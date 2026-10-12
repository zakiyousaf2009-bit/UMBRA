import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'

export function Logo({ variant = 'full', animated = false, converting = false, className = '' }) {
  const markRef = useRef(null)
  const hasWordmark = variant !== 'mark'

  useEffect(() => {
    if (!animated || !markRef.current) return
    const context = gsap.context(() => {
      gsap.to(markRef.current, { rotation: 360, duration: 22, ease: 'none', repeat: -1, transformOrigin: '50% 50%' })
    }, markRef)
    return () => context.revert()
  }, [animated])

  useEffect(() => {
    if (!markRef.current) return
    const rim = markRef.current.querySelector('[data-eclipse]')
    if (!rim) return
    const context = gsap.context(() => {
      gsap.to(rim, { x: converting ? -7 : 0, duration: .65, ease: 'power2.inOut', overwrite: true })
    }, markRef)
    return () => context.revert()
  }, [converting])

  return <span className={`umbra-logo ${animated ? 'is-animated' : ''} ${className}`} aria-label={hasWordmark ? 'UMBRA' : undefined}>
    <svg ref={markRef} className="umbra-mark" viewBox="0 0 48 48" role="img" aria-label={hasWordmark ? undefined : 'UMBRA eclipse mark'}>
      <defs><linearGradient id="umbra-rim" x1="7" y1="5" x2="39" y2="42"><stop stopColor="#3B82F6"/><stop offset="1" stopColor="#14B8A6"/></linearGradient></defs>
      <circle cx="22" cy="24" r="16" fill="#17151f" stroke="url(#umbra-rim)" strokeWidth="1.5"/>
      <circle data-eclipse cx="29" cy="20" r="15" fill="#050506"/>
      <path d="M9.5 31a16 16 0 0 0 26.7-3.6" stroke="url(#umbra-rim)" strokeWidth="1.1" strokeLinecap="round"/>
    </svg>
    {hasWordmark && <span className="umbra-wordmark">UMBRA</span>}
  </span>
}

export default Logo
