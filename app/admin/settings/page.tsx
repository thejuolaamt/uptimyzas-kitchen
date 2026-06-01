'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getSession, clearSession } from '@/lib/auth'
import { useToast } from '@/lib/toast'
import { Save, LogOut, Shield, Bell } from 'lucide-react'

export default function SettingsPage() {
  const router = useRouter()
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [session, setSession] = useState<any>(null)
  const [thresholds, setThresholds] = useState({ high: '30', low: '10' })

  useEffect(() => {
    const userSession = getSession()
    if (!userSession) {
      router.push('/auth/login')
    } else if (userSession.role !== 'admin') {
      router.push('/dashboard')
    } else {
      setSession(userSession)
      fetchSettings()
    }
  }, [router])

  const fetchSettings = async () => {
    const { data, error } = await supabase
      .from('settings')
      .select('key, value')

    if (!error && data) {
      const high = data.find(s => s.key === 'stock_threshold_high')?.value || '30'
      const low  = data.find(s => s.key === 'stock_threshold_low')?.value  || '10'
      setThresholds({ high, low })
    }
    setLoading(false)
  }

  const saveSettings = async () => {
    setSaving(true)

    const [resHigh, resLow] = await Promise.all([
      supabase
        .from('settings')
        .update({ value: thresholds.high, updated_at: new Date().toISOString() })
        .eq('key', 'stock_threshold_high'),
      supabase
        .from('settings')
        .update({ value: thresholds.low, updated_at: new Date().toISOString() })
        .eq('key', 'stock_threshold_low'),
    ])

    if (resHigh.error || resLow.error) {
      toast('Error saving settings', 'error')
    } else {
      toast('Settings saved', 'success')
    }
    setSaving(false)
  }

  const handleLogout = () => {
    clearSession()
    router.push('/auth/login')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-bg-subtle flex items-center justify-center">
        <div className="w-7 h-7 border-[3px] border-border border-t-primary rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-bg-subtle">
      <div className="p-6 max-w-2xl mx-auto space-y-6">

        <h1 className="t-h1 text-text-primary">Settings</h1>

        {/* Account info */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <Shield size={16} className="text-text-muted" />
            <p className="t-h3 text-text-primary">Account</p>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between items-center py-2 border-b border-border">
              <p className="t-small text-text-muted">Name</p>
              <p className="t-body text-text-primary">
                {session?.first_name} {session?.surname}
              </p>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-border">
              <p className="t-small text-text-muted">Email</p>
              <p className="t-body text-text-primary">{session?.email}</p>
            </div>
            <div className="flex justify-between items-center py-2">
              <p className="t-small text-text-muted">Role</p>
              <span className="bg-primary/10 text-primary t-small px-2 py-1 rounded-full capitalize">
                {session?.role}
              </span>
            </div>
          </div>
        </div>

        {/* Stock thresholds */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <Bell size={16} className="text-text-muted" />
            <p className="t-h3 text-text-primary">Stock Thresholds</p>
          </div>
          <p className="t-body text-text-secondary mb-5">
            Define when stock levels trigger colour warnings
          </p>

          <div className="space-y-4">
            <div>
              <label className="block t-label text-text-primary mb-2">
                High Threshold (%)
              </label>
              <input
                type="number"
                value={thresholds.high}
                onChange={(e) => setThresholds({ ...thresholds, high: e.target.value })}
                className="input-base"
                min="0"
                max="100"
              />
              <p className="t-small text-text-muted mt-1.5">
                Above this → <span className="text-[#2E7D32]">Good (Green)</span>
              </p>
            </div>

            <div>
              <label className="block t-label text-text-primary mb-2">
                Low Threshold (%)
              </label>
              <input
                type="number"
                value={thresholds.low}
                onChange={(e) => setThresholds({ ...thresholds, low: e.target.value })}
                className="input-base"
                min="0"
                max="100"
              />
              <p className="t-small text-text-muted mt-1.5">
                Between Low and High → <span className="text-[#E65100]">Low (Orange)</span>
              </p>
            </div>

            <div className="bg-bg-subtle rounded-[10px] p-4">
              <p className="t-small text-text-secondary leading-relaxed">
                <span className="t-label text-text-primary">Current rules</span><br />
                · Above {thresholds.high}% →{' '}
                <span className="text-[#2E7D32]">Good</span><br />
                · {thresholds.low}%–{thresholds.high}% →{' '}
                <span className="text-[#E65100]">Low</span><br />
                · Below {thresholds.low}% →{' '}
                <span className="text-danger">Critical</span>
              </p>
            </div>

            <button
              onClick={saveSettings}
              disabled={saving}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              <Save size={16} />
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </div>

        {/* Logout */}
        <div className="card">
          <p className="t-h3 text-text-primary mb-1">Sign Out</p>
          <p className="t-body text-text-secondary mb-4">
            You will be signed out of your account on this device
          </p>
          <button
            onClick={() => setShowLogoutConfirm(true)}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-[10px] border border-danger/30 text-danger t-label hover:bg-danger/5 transition-colors"
          >
            <LogOut size={16} />
            Sign Out
          </button>
        </div>

      </div>

      {/* Logout confirm modal */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-end justify-center z-50">
          <div className="bg-white w-full max-w-md rounded-t-[20px] p-5">
            <div className="w-10 h-1 rounded-full bg-border mx-auto mb-5" />
            <p className="t-h2 text-text-primary">Sign out?</p>
            <p className="t-body text-text-secondary mt-2">
              You'll need to sign in again to access the app.
            </p>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="btn-secondary flex-1"
              >
                Cancel
              </button>
              <button
                onClick={handleLogout}
                className="btn-primary flex-1"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}