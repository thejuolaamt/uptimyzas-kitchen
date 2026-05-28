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
      <div className="text-white text-center px-6">
        <h1 className="t-brand text-white">Uptimyzas Kitchen</h1>
        <p className="t-small mt-2 tracking-widest uppercase text-white/60">Restaurant Management System</p>
        <div className="mt-8 w-7 h-7 border-[3px] border-white/30 border-t-white rounded-full animate-spin mx-auto"></div>
      </div>
    </div>
  )
}