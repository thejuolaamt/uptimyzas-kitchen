'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getSession } from '@/lib/auth'
import { useToast } from '@/lib/toast'

type StockItem = {
  id: string
  item_name: string
  opening_qty: number
  sold_qty: number
  remaining_qty: number
  unit: string
}

export default function StockBoard() {
  const router = useRouter()
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [stockItems, setStockItems] = useState<StockItem[]>([])
  const [activeShift, setActiveShift] = useState<any>(null)
  const [thresholds, setThresholds] = useState({ high: 30, low: 10 })

  useEffect(() => {
    const userSession = getSession()
    if (!userSession) {
      router.push('/auth/login')
    } else {
      fetchThresholds()
      checkActiveShift()
    }
  }, [router])

  const fetchThresholds = async () => {
    const { data, error } = await supabase.from('settings').select('key, value')
    if (!error && data) {
      const high = parseInt(data.find(s => s.key === 'stock_threshold_high')?.value || '30')
      const low = parseInt(data.find(s => s.key === 'stock_threshold_low')?.value || '10')
      setThresholds({ high, low })
    }
  }

  const checkActiveShift = async () => {
    const today = new Date().toISOString().split('T')[0]
    const { data, error } = await supabase
      .from('shift_sessions')
      .select('*, shifts(*)')
      .eq('shift_date', today)
      .eq('status', 'open')
      .single()

    if (!data || error) {
      toast('No active shift. Please open a shift first.', 'warning')
      router.push('/dashboard')
    } else {
      setActiveShift(data)
      fetchStockData(data.shift_id)
      subscribeToStockUpdates(data.shift_id)
    }
    setLoading(false)
  }

  const fetchStockData = async (shiftId: string) => {
    const today = new Date().toISOString().split('T')[0]
    const { data } = await supabase
      .from('shift_stock')
      .select('*')
      .eq('shift_date', today)
      .eq('shift_id', shiftId)
      .order('item_name')

    if (data) setStockItems(data)
  }

  const subscribeToStockUpdates = (shiftId: string) => {
    const today = new Date().toISOString().split('T')[0]
    const subscription = supabase
      .channel('stock_updates')
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'shift_stock',
        filter: `shift_date=eq.${today}`
      }, (payload) => {
        setStockItems(prev =>
          prev.map(item => item.id === payload.new.id ? { ...item, ...payload.new } : item)
        )
      })
      .subscribe()

    return () => { subscription.unsubscribe() }
  }

  const getStockStatus = (remaining: number, opening: number) => {
    if (opening === 0) return { color: 'text-danger', bg: 'bg-danger/10', label: 'No Stock', fill: 'progress-fill-low' }
    const pct = (remaining / opening) * 100
    if (pct > thresholds.high) return { color: 'text-[#2E7D32]', bg: 'bg-[#2E7D32]/10', label: 'Good', fill: 'progress-fill-high' }
    if (pct >= thresholds.low) return { color: 'text-[#E65100]', bg: 'bg-[#E65100]/10', label: 'Low', fill: 'progress-fill-medium' }
    return { color: 'text-danger', bg: 'bg-danger/10', label: 'Critical', fill: 'progress-fill-low' }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-bg-subtle flex items-center justify-center">
        <div className="w-7 h-7 border-[3px] border-border border-t-primary rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-bg-subtle pb-24">
      <div className="p-4 space-y-4">

        {/* Header */}
        <div className="card border-l-4 border-l-primary">
          <p className="t-h2 text-text-primary">{activeShift?.shifts?.name} Shift</p>
          <p className="t-small text-text-secondary mt-1">
            {new Date().toLocaleDateString('en-NG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
          <div className="flex items-center gap-1.5 mt-2">
            <div className="w-1.5 h-1.5 rounded-full bg-[#2E7D32] animate-pulse" />
            <p className="t-small text-[#2E7D32]">Live updates enabled</p>
          </div>
        </div>

        {/* Stock items */}
        <p className="t-h3 text-text-primary">Current Stock Levels</p>

        {stockItems.length === 0 ? (
          <div className="card text-center py-10">
            <p className="t-body text-text-muted">No stock data for this shift</p>
          </div>
        ) : (
          <div className="space-y-3">
            {stockItems.map((item) => {
              const status = getStockStatus(item.remaining_qty, item.opening_qty)
              const percentage = item.opening_qty === 0 ? 0 : (item.remaining_qty / item.opening_qty) * 100

              return (
                <div key={item.id} className="card">
                  <div className="flex justify-between items-start mb-3">
                    <p className="t-h3 text-text-primary">{item.item_name}</p>
                    <span className={`${status.bg} ${status.color} px-2 py-1 rounded-full t-small font-medium`}>
                      {status.label}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 mb-3 text-center">
                    {[['Opening', item.opening_qty], ['Sold', item.sold_qty], ['Remaining', item.remaining_qty]].map(([label, val]) => (
                      <div key={label} className="bg-bg-subtle rounded-[8px] p-2">
                        <p className="t-small text-text-muted">{label}</p>
                        <p className={`t-mono font-medium ${label === 'Remaining' ? status.color : 'text-text-primary'}`}>{val}</p>
                      </div>
                    ))}
                  </div>

                  <div className="progress-bar">
                    <div className={`progress-fill ${status.fill}`} style={{ width: `${percentage}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}