'use client'

import { useEffect, useState } from 'react'

export default function PWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [showInstall, setShowInstall] = useState(false)

  useEffect(() => {
    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then(registration => {
          console.log('ServiceWorker registered:', registration)
        })
        .catch(error => {
          console.log('ServiceWorker registration failed:', error)
        })
    }

    // Listen for beforeinstallprompt event
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setShowInstall(true)
    })
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return
    
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    console.log(`User response: ${outcome}`)
    setDeferredPrompt(null)
    setShowInstall(false)
  }

  if (!showInstall) return null

  return (
    <div className="fixed bottom-20 left-4 right-4 z-50">
      <div className="bg-white rounded-lg shadow-lg p-4 border border-border flex items-center justify-between">
        <div>
          <p className="font-semibold text-text-primary">Install App</p>
          <p className="text-text-secondary text-sm">Install for faster access</p>
        </div>
        <button onClick={handleInstall} className="btn-primary py-2 px-4">
          Install
        </button>
      </div>
    </div>
  )
}