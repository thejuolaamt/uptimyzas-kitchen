// lib/auth.ts
import { supabase } from './supabase'
import bcrypt from 'bcryptjs'

export type UserSession = {
  id: string
  email: string
  first_name: string
  surname: string
  role: string
  status: string
}

export async function signIn(email: string, password: string): Promise<{ success: boolean; error?: string; session?: UserSession }> {
  try {
    console.log('Signing in with email:', email)
    
    // Find user by email
    const { data: users, error } = await supabase
      .from('users')
      .select('id, email, password_hash, first_name, surname, role, status')
      .eq('email', email.toLowerCase())
      .limit(1)

    if (error) {
      console.error('Supabase error:', error)
      throw error
    }
    
    console.log('User found:', users ? users.length : 0)
    
    if (!users || users.length === 0) {
      return { success: false, error: 'Invalid email or password' }
    }

    const user = users[0]
    console.log('User status:', user.status)
    console.log('Stored hash:', user.password_hash)
    console.log('Entered password:', password)

    // Check status
    if (user.status === 'pending') {
      return { success: false, error: 'Your account is pending approval' }
    }
    if (user.status === 'declined') {
      return { success: false, error: 'Your account was declined' }
    }
    if (user.status !== 'active') {
      return { success: false, error: 'Account not active' }
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash)
    console.log('Password valid:', isValidPassword)
    
    if (!isValidPassword) {
      return { success: false, error: 'Invalid email or password' }
    }
    
    const session: UserSession = {
      id: user.id,
      email: user.email,
      first_name: user.first_name,
      surname: user.surname,
      role: user.role,
      status: user.status,
    }

    // Save to localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('uk_session', JSON.stringify(session))
    }

    return { success: true, session }
  } catch (error) {
    console.error('Sign in error:', error)
    return { success: false, error: 'Something went wrong' }
  }
}

export function getSession(): UserSession | null {
  if (typeof window === 'undefined') return null
  const sessionStr = localStorage.getItem('uk_session')
  if (!sessionStr) return null
  try {
    return JSON.parse(sessionStr)
  } catch {
    return null
  }
}

export function clearSession(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('uk_session')
  }
}

export function isAuthenticated(): boolean {
  return getSession() !== null
}