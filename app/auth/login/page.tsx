// app/auth/login/page.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { signIn } from '@/lib/auth'
import Link from 'next/link'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const result = await signIn(email, password)
    
    if (result.success && result.session) {
      if (result.session.role === 'admin') {
        router.push('/admin')
      } else {
        router.push('/dashboard')
      }
    } else {
      setError(result.error || 'Login failed')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#8B0000]">
      <div className="bg-white rounded-[10px] p-8 max-w-md w-full mx-4 shadow-lg">
        <div className="text-center mb-8">
          <h1 className="font-display font-bold text-5xl text-[#8B0000]">UPTIMYZAS</h1>
          <p className="font-display font-bold text-2xl text-[#0D0D0D] mt-1">Kitchen</p>
          <p className="text-[#616161] mt-4">Sign in to your account</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[#0D0D0D] font-medium mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input-base"
              required
            />
          </div>

          <div>
            <label className="block text-[#0D0D0D] font-medium mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-base"
              required
            />
          </div>

          {error && (
            <div className="bg-[#C62828]/10 border border-[#C62828] rounded-[10px] p-3">
              <p className="text-[#C62828] text-sm">{error}</p>
            </div>
          )}

          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p className="text-center text-[#616161] text-sm mt-6">
          Don't have an account?{' '}
          <Link href="/auth/signup" className="text-[#8B0000] font-semibold hover:underline">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  )
}