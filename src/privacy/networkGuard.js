let installed = false

function isLocalAddress(input) {
  try {
    const url = new URL(typeof input === 'string' ? input : input.url, window.location.href)
    const current = new URL(window.location.href)
    const protocol = value => value === 'wss:' ? 'https:' : value === 'ws:' ? 'http:' : value
    return url.hostname === current.hostname && url.port === current.port && protocol(url.protocol) === protocol(current.protocol)
  } catch {
    return false
  }
}

function block(input) {
  window.dispatchEvent(new CustomEvent('umbra:network-blocked', { detail: { origin: (() => { try { return new URL(input, location.href).origin } catch { return 'unknown' } })() } }))
}

export function installNetworkGuard() {
  if (installed || typeof window === 'undefined') return
  installed = true

  const nativeFetch = window.fetch.bind(window)
  window.fetch = (input, init) => {
    if (!isLocalAddress(input)) {
      block(typeof input === 'string' ? input : input.url)
      return Promise.reject(new TypeError('UMBRA blocked an external network request.'))
    }
    return nativeFetch(input, init)
  }

  const nativeOpen = XMLHttpRequest.prototype.open
  XMLHttpRequest.prototype.open = function open(method, url, ...rest) {
    this.__umbraBlocked = !isLocalAddress(url)
    this.__umbraUrl = url
    if (this.__umbraBlocked) return
    return nativeOpen.call(this, method, url, ...rest)
  }
  const nativeSend = XMLHttpRequest.prototype.send
  XMLHttpRequest.prototype.send = function send(...args) {
    if (this.__umbraBlocked) {
      block(this.__umbraUrl)
      throw new DOMException('UMBRA blocked an external network request.', 'NetworkError')
    }
    return nativeSend.apply(this, args)
  }

  const NativeWebSocket = window.WebSocket
  window.WebSocket = new Proxy(NativeWebSocket, {
    construct(Target, args) {
      if (!isLocalAddress(args[0])) {
        block(args[0])
        throw new DOMException('UMBRA blocked an external socket.', 'NetworkError')
      }
      return Reflect.construct(Target, args)
    },
  })

  if (navigator.sendBeacon) {
    const nativeBeacon = navigator.sendBeacon.bind(navigator)
    navigator.sendBeacon = (url, data) => {
      if (!isLocalAddress(url)) {
        block(url)
        return false
      }
      return nativeBeacon(url, data)
    }
  }
}
