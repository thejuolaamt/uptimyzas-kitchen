'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getSession } from '@/lib/auth'
import { useToast } from '@/lib/toast'
import { Save } from 'lucide-react'

export default function SettingsPage() {
  const router = useRouter()
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [thresholds, setThresholds] = useState({ high: '30', low: '10' })

  useEffect(() => {
    const session = getSession()
    if (!session) {
      router.push('/auth/login')
    } else if (session.role !== 'admin') {
      router.push('/dashboard')
    } else {
      fetchSettings()
    }
  }, [router])

  const fetchSettings = async () => {
    const { data, error } = await supabase.from('settings').select('key, value')
    if (!error && data) {
      const high = data.find(s => s.key === 'stock_threshold_high')?.value || '30'
      const low = data.find(s => s.key === 'stock_threshold_low')?.value || '10'
      setThresholds({ high, low })
    }
    setLoading(false)
  }

  const saveSettings = async () => {
    setSaving(true)

    await supabase.from('settings')
      .update({ value: thresholds.high, updated_at: new Date().toISOString() })
      .eq('key', 'stock_threshold_high')

    await supabase.from('settings')
      .update({ value: thresholds.low, updated_at: new Date().toISOString() })
      .eq('key', 'stock_threshold_low')

    toast('Settings saved successfully', 'success')
    setSaving(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-bg-subtle flex items-center justify-center">
        <div className="w-7 h-7 border-[3px] border-border border-t-primary rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="t-h1 text-text-primary mb-6">System Settings</h1>

      <div className="card">
        <p className="t-h3 text-text-primary mb-1">Stock Thresholds</p>
        <p className="t-body text-text-secondary mb-6">Define when stock levels trigger warnings</p>

        <div className="space-y-4">
          <div>
            <label className="block t-label text-text-primary mb-1">High Threshold (%)</label>
            <input
              type="number"
              value={thresholds.high}
              onChange={(e) => setThresholds({ ...thresholds, high: e.target.value })}
              className="input-base"
              min="0"
              max="100"
            />
            <p className="t-small text-text-muted mt-1">
              Stock above this % shows as <span className="text-[#2E7D32]">Good (Green)</span>
            </p>
          </div>

          <div>
            <label className="block t-label text-text-primary mb-1">Low Threshold (%)</label>
            <input
              type="number"
              value={thresholds.low}
              onChange={(e) => setThresholds({ ...thresholds, low: e.target.value })}
              className="input-base"
              min="0"
              max="100"
            />
            <p className="t-small text-text-muted mt-1">
              Stock between Low and High shows as <span className="text-[#E65100]">Low (Orange)</span>
            </p>
          </div>

          <div className="bg-bg-subtle rounded-[10px] p-4">
            <p className="t-small text-text-secondary">
              <span className="t-label text-text-primary">Current rules</span><br />
              · Above {thresholds.high}% → <span className="text-[#2E7D32]">Good (Green)</span><br />
              · {thresholds.low}%–{thresholds.high}% → <span className="text-[#E65100]">Low (Orange)</span><br />
              · Below {thresholds.low}% → <span className="text-danger">Critical (Red)</span>
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
    </div>
  )
}