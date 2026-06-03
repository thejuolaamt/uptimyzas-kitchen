// lib/useScrollContainer.ts
'use client'

import { useEffect, useRef, useCallback } from 'react'

interface UseScrollContainerOptions {
  /** Enable pull-to-refresh prevention (default: true) */
  preventPullToRefresh?: boolean
  /** Callback when user pulls down from top */
  onPullToRefresh?: () => void
  /** Threshold in pixels to trigger pull-to-refresh (default: 80) */
  pullThreshold?: number
}

export function useScrollContainer(options: UseScrollContainerOptions = {}) {
  const {
    preventPullToRefresh = true,
    onPullToRefresh,
    pullThreshold = 80
  } = options

  const containerRef = useRef<HTMLDivElement>(null)
  const startYRef = useRef<number>(0)
  const isPullingRef = useRef<boolean>(false)
  const pullDistanceRef = useRef<number>(0)
  const refreshingRef = useRef<boolean>(false)

  const handleTouchStart = useCallback((e: TouchEvent) => {
    const container = containerRef.current
    if (!container) return

    // Only track if at the top of the container
    if (container.scrollTop === 0) {
      startYRef.current = e.touches[0].clientY
      isPullingRef.current = true
      pullDistanceRef.current = 0
    }
  }, [])

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (!preventPullToRefresh || !isPullingRef.current || refreshingRef.current) return

      const currentY = e.touches[0].clientY
      const deltaY = currentY - startYRef.current

      // Only prevent if pulling down
      if (deltaY > 0) {
        e.preventDefault()
        pullDistanceRef.current = deltaY

        // Optional: visual feedback for pull distance
        if (containerRef.current) {
          const pullPercent = Math.min(deltaY / pullThreshold, 1)
          containerRef.current.style.transform = `translateY(${deltaY * 0.3}px)`
          containerRef.current.style.transition = 'none'
        }
      }
    },
    [preventPullToRefresh, pullThreshold]
  )

  const handleTouchEnd = useCallback(async () => {
    const container = containerRef.current
    if (!container) return

    // Reset transform
    container.style.transform = ''
    container.style.transition = 'transform 0.2s ease'

    // Check if pull threshold was met
    if (isPullingRef.current && pullDistanceRef.current >= pullThreshold && onPullToRefresh) {
      refreshingRef.current = true
      
      // Add refreshing visual state
      if (container) {
        container.style.transform = `translateY(${pullThreshold * 0.3}px)`
      }
      
      try {
        await onPullToRefresh()
      } finally {
        refreshingRef.current = false
        if (container) {
          container.style.transform = ''
        }
      }
    }

    isPullingRef.current = false
    pullDistanceRef.current = 0
  }, [onPullToRefresh, pullThreshold])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    if (preventPullToRefresh) {
      container.addEventListener('touchstart', handleTouchStart, { passive: false })
      container.addEventListener('touchmove', handleTouchMove, { passive: false })
      container.addEventListener('touchend', handleTouchEnd)
    }

    return () => {
      if (preventPullToRefresh) {
        container.removeEventListener('touchstart', handleTouchStart)
        container.removeEventListener('touchmove', handleTouchMove)
        container.removeEventListener('touchend', handleTouchEnd)
      }
    }
  }, [preventPullToRefresh, handleTouchStart, handleTouchMove, handleTouchEnd])

  // Reset transform on scroll
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handleScroll = () => {
      if (container.scrollTop === 0) {
        container.style.transform = ''
      }
    }

    container.addEventListener('scroll', handleScroll)
    return () => container.removeEventListener('scroll', handleScroll)
  }, [])

  return containerRef
}

// Simplified version without pull-to-refresh callback
export function useSimpleScrollContainer() {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let startY = 0
    let isAtTop = false

    const handleTouchStart = (e: TouchEvent) => {
      startY = e.touches[0].clientY
      isAtTop = container.scrollTop === 0
    }

    const handleTouchMove = (e: TouchEvent) => {
      if (isAtTop) {
        const currentY = e.touches[0].clientY
        const deltaY = currentY - startY
        
        // If pulling down while at top, prevent default (blocks pull-to-refresh)
        if (deltaY > 0) {
          e.preventDefault()
        }
      }
    }

    container.addEventListener('touchstart', handleTouchStart, { passive: false })
    container.addEventListener('touchmove', handleTouchMove, { passive: false })

    return () => {
      container.removeEventListener('touchstart', handleTouchStart)
      container.removeEventListener('touchmove', handleTouchMove)
    }
  }, [])

  return containerRef
}