// app/admin/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getSession } from '@/lib/auth'

export default function AdminPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const session = getSession()
    if (!session) {
      router.push('/auth/login')
    } else if (session.role !== 'admin') {
      router.push('/dashboard')
    } else {
      setLoading(false)
    }
  }, [router])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-text-secondary">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-bg-subtle">
      <div className="p-6">
        <h1 className="text-2xl font-bold text-text-primary">Admin Dashboard</h1>
        <p className="text-text-secondary mt-2">Welcome to the admin panel</p>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
          <div className="card">
            <h3 className="font-semibold text-text-primary">Staff Management</h3>
            <p className="text-text-secondary text-sm mt-1">Approve pending staff accounts</p>
          </div>
          <div className="card">
            <h3 className="font-semibold text-text-primary">Menu Management</h3>
            <p className="text-text-secondary text-sm mt-1">Add/edit menu items</p>
          </div>
          <div className="card">
            <h3 className="font-semibold text-text-primary">Shift Management</h3>
            <p className="text-text-secondary text-sm mt-1">Create and assign shifts</p>
          </div>
        </div>
      </div>
    </div>
  )
}