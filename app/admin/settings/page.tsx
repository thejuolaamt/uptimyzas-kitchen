// app/admin/settings/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getSession } from '@/lib/auth'
import { Save } from 'lucide-react'

export default function SettingsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [thresholds, setThresholds] = useState({
    high: '30',
    low: '10'
  })

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
    const { data, error } = await supabase
      .from('settings')
      .select('key, value')
    
    if (!error && data) {
      const high = data.find(s => s.key === 'stock_threshold_high')?.value || '30'
      const low = data.find(s => s.key === 'stock_threshold_low')?.value || '10'
      setThresholds({ high, low })
    }
    setLoading(false)
  }

  const saveSettings = async () => {
    setSaving(true)
    
    // Update high threshold
    await supabase
      .from('settings')
      .update({ value: thresholds.high, updated_at: new Date().toISOString() })
      .eq('key', 'stock_threshold_high')
    
    // Update low threshold
    await supabase
      .from('settings')
      .update({ value: thresholds.low, updated_at: new Date().toISOString() })
      .eq('key', 'stock_threshold_low')
    
    alert('Settings saved successfully')
    setSaving(false)
  }

  if (loading) return <div className="p-6">Loading...</div>

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-text-primary mb-6">System Settings</h1>
      
      <div className="card">
        <h2 className="font-bold text-text-primary mb-4">Stock Thresholds</h2>
        <p className="text-text-secondary text-sm mb-6">
          Define when stock levels trigger warnings
        </p>
        
        <div className="space-y-4">
          <div>
            <label className="block text-text-primary font-medium mb-2">
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
            <p className="text-text-muted text-xs mt-1">
              Stock above this percentage shows as <span className="text-success">Good (Green)</span>
            </p>
          </div>
          
          <div>
            <label className="block text-text-primary font-medium mb-2">
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
            <p className="text-text-muted text-xs mt-1">
              Stock between Low and High shows as <span className="text-warning">Low (Orange)</span>
            </p>
          </div>
          
          <div className="bg-bg-subtle p-4 rounded-default mt-4">
            <p className="text-text-secondary text-sm">
              <strong className="text-text-primary">Current rules:</strong><br/>
              • Above {thresholds.high}% → <span className="text-success">Good (Green)</span><br/>
              • {thresholds.low}% - {thresholds.high}% → <span className="text-warning">Low (Orange)</span><br/>
              • Below {thresholds.low}% → <span className="text-danger">Critical (Red)</span>
            </p>
          </div>
          
          <button onClick={saveSettings} disabled={saving} className="btn-primary w-full flex items-center justify-center gap-2">
            <Save size={18} />
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  )
}