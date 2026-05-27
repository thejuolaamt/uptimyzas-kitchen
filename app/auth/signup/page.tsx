// app/auth/signup/page.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function SignupPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  
  const [formData, setFormData] = useState({
    firstName: '',
    surname: '',
    email: '',
    phone: '',
    additionalPhone: '',
    isStudent: false,
    password: '',
    confirmPassword: '',
    state: '',
    city: '',
    address: '',
  })

  const updateField = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleStep1Submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match')
      return
    }
    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }
    setError('')
    setStep(2)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      // Check if this is the first user
      const { count, error: countError } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })

      if (countError) {
        setError('Database error: ' + countError.message)
        setLoading(false)
        return
      }

      const isFirstUser = count === 0
      const userRole = isFirstUser ? 'admin' : 'staff'
      const userStatus = isFirstUser ? 'active' : 'pending'

      // For now, store plain password (we'll hash in the backend later)
      // In production, you'd use a Supabase function to hash
      const { data, error: insertError } = await supabase
        .from('users')
        .insert({
          email: formData.email.toLowerCase(),
          password_hash: formData.password, // TEMP: will be hashed, just for testing
          first_name: formData.firstName,
          surname: formData.surname,
          phone: formData.phone,
          additional_phone: formData.additionalPhone || null,
          is_student: formData.isStudent,
          state: formData.state || null,
          city: formData.city || null,
          address: formData.address || null,
          role: userRole,
          status: userStatus,
          approved_at: isFirstUser ? new Date().toISOString() : null
        })
        .select()

      if (insertError) {
        if (insertError.code === '23505') {
          setError('Email already exists. Please use a different email.')
        } else {
          setError('Failed to create account: ' + insertError.message)
        }
        setLoading(false)
        return
      }

      if (isFirstUser && data && data[0]) {
        // Auto login for first user
        const session = {
          id: data[0].id,
          email: data[0].email,
          first_name: data[0].first_name,
          surname: data[0].surname,
          role: 'admin',
          status: 'active'
        }
        localStorage.setItem('uk_session', JSON.stringify(session))
        router.push('/admin')
      } else {
        router.push('/auth/pending')
      }
    } catch (err: any) {
      console.error('Signup error:', err)
      setError(err?.message || 'Something went wrong. Please try again.')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-subtle py-8">
      <div className="card max-w-md w-full mx-4">
        <div className="text-center mb-6">
          <h1 className="font-display font-bold text-3xl text-primary">Uptimyzas</h1>
          <p className="text-text-secondary mt-2">Create your account</p>
          <div className="flex justify-center gap-2 mt-4">
            <div className={`w-2 h-2 rounded-full ${step === 1 ? 'bg-primary' : 'bg-border'}`} />
            <div className={`w-2 h-2 rounded-full ${step === 2 ? 'bg-primary' : 'bg-border'}`} />
          </div>
        </div>

        {error && (
          <div className="bg-danger/10 border border-danger rounded-default p-3 mb-4">
            <p className="text-danger text-sm">{error}</p>
          </div>
        )}

        {step === 1 && (
          <form onSubmit={handleStep1Submit} className="space-y-4">
            <div>
              <label className="block text-text-primary font-medium mb-1">First Name *</label>
              <input
                type="text"
                value={formData.firstName}
                onChange={(e) => updateField('firstName', e.target.value)}
                className="input-base"
                required
              />
            </div>

            <div>
              <label className="block text-text-primary font-medium mb-1">Surname *</label>
              <input
                type="text"
                value={formData.surname}
                onChange={(e) => updateField('surname', e.target.value)}
                className="input-base"
                required
              />
            </div>

            <div>
              <label className="block text-text-primary font-medium mb-1">Email *</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => updateField('email', e.target.value)}
                className="input-base"
                required
              />
            </div>

            <div>
              <label className="block text-text-primary font-medium mb-1">Phone *</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => updateField('phone', e.target.value)}
                className="input-base"
                required
              />
            </div>

            <div>
              <label className="block text-text-primary font-medium mb-1">Additional Phone</label>
              <input
                type="tel"
                value={formData.additionalPhone}
                onChange={(e) => updateField('additionalPhone', e.target.value)}
                className="input-base"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isStudent"
                checked={formData.isStudent}
                onChange={(e) => updateField('isStudent', e.target.checked)}
                className="w-4 h-4"
              />
              <label htmlFor="isStudent" className="text-text-primary">Are you a student?</label>
            </div>

            <div>
              <label className="block text-text-primary font-medium mb-1">Password *</label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => updateField('password', e.target.value)}
                className="input-base"
                required
              />
            </div>

            <div>
              <label className="block text-text-primary font-medium mb-1">Confirm Password *</label>
              <input
                type="password"
                value={formData.confirmPassword}
                onChange={(e) => updateField('confirmPassword', e.target.value)}
                className="input-base"
                required
              />
            </div>

            <button type="submit" className="btn-primary w-full">
              Next
            </button>
          </form>
        )}

        {step === 2 && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-text-primary font-medium mb-1">State</label>
              <input
                type="text"
                value={formData.state}
                onChange={(e) => updateField('state', e.target.value)}
                className="input-base"
              />
            </div>

            <div>
              <label className="block text-text-primary font-medium mb-1">City</label>
              <input
                type="text"
                value={formData.city}
                onChange={(e) => updateField('city', e.target.value)}
                className="input-base"
              />
            </div>

            <div>
              <label className="block text-text-primary font-medium mb-1">Address</label>
              <textarea
                value={formData.address}
                onChange={(e) => updateField('address', e.target.value)}
                className="input-base min-h-[80px]"
              />
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? 'Creating account...' : 'Sign Up'}
            </button>
            
            <button
              type="button"
              onClick={() => setStep(1)}
              className="btn-secondary w-full"
            >
              Back
            </button>
          </form>
        )}

        <p className="text-center text-text-secondary text-sm mt-6">
          Already have an account?{' '}
          <button onClick={() => router.push('/auth/login')} className="text-primary font-semibold">
            Sign in
          </button>
        </p>
      </div>
    </div>
  )
}