'use client'

import { useRouter } from 'next/navigation'

export default function PendingPage() {
  const router = useRouter()

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-subtle">
      <div className="card max-w-md w-full text-center">
        <div className="w-16 h-16 bg-warning/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-3xl">⏳</span>
        </div>
        <h1 className="text-2xl font-bold text-text-primary mb-2">Account Pending Approval</h1>
        <p className="text-text-secondary mb-6">
          Your account has been created and is waiting for admin approval.
          You will receive access once an admin approves your account.
        </p>
        <button
          onClick={() => router.push('/auth/login')}
          className="btn-primary w-full"
        >
          Back to Login
        </button>
      </div>
    </div>
  )
}