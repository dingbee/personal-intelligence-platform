let registrationStarted = false

export function registerServiceWorker() {
  if (registrationStarted || !('serviceWorker' in navigator)) return
  registrationStarted = true

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch((error) => {
      // PWA support is progressive enhancement; a registration failure must never
      // prevent the application itself from loading.
      console.warn('ARRIYIA service worker registration failed', error)
    })
  })
}
