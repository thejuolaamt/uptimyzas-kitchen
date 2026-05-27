'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getSession } from '@/lib/auth'

export default function HomePage() {
  const router = useRouter()

  useEffect(() => {
    const session = getSession()
    if (session) {
      if (session.role === 'admin') {
        router.push('/admin')
      } else {
        router.push('/dashboard')
      }
    } else {
      router.push('/auth/login')
    }
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-primary">
      <div className="text-white text-center">
        <h1 className="font-display font-bold text-5xl">UPTIMYZAS</h1>
        <p className="font-display text-2xl mt-1">Kitchen</p>
        <div className="mt-6 w-8 h-8 border-4 border-white/30 border-t-white rounded-full animate-spin mx-auto"></div>
        <p className="mt-4 text-white/80">Loading...</p>
      </div>
    </div>
  )
}