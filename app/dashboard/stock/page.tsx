'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getSession } from '@/lib/auth'
import { useToast } from '@/lib/toast'
import { Activity } from 'lucide-react'

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
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())
  
  // Use a ref to track if we've already set up the subscription
  const subscriptionSetupDone = useRef<boolean>(false)

  useEffect(() => {
    const userSession = getSession()
    if (!userSession) {
      router.push('/auth/login')
      return
    }
    fetchThresholds()
    checkActiveShift()

    // Cleanup on unmount
    return () => {
      subscriptionSetupDone.current = false
    }
  }, [])

  const fetchThresholds = async () => {
    const { data } = await supabase.from('settings').select('key, value')
    if (data) {
      const high = parseInt(data.find(s => s.key === 'stock_threshold_high')?.value || '30')
      const low  = parseInt(data.find(s => s.key === 'stock_threshold_low')?.value  || '10')
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
      .maybeSingle()

    if (!data || error) {
      toast('No active shift. Please open a shift first.', 'warning')
      router.push('/dashboard')
      return
    }

    setActiveShift(data)
    await fetchStockData(data.shift_id)
    setupRealtimeSubscription(data.shift_id)
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

    if (data) {
      setStockItems(data)
      setLastUpdated(new Date())
    }
  }

  const setupRealtimeSubscription = (shiftId: string) => {
    // Prevent multiple setups
    if (subscriptionSetupDone.current) {
      console.log('Subscription already set up, skipping')
      return
    }

    const today = new Date().toISOString().split('T')[0]
    console.log(`Setting up realtime subscription for shift: ${shiftId}`)

    // Create a unique channel name
    const channelName = `stock-${shiftId}-${Date.now()}`
    
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'shift_stock',
        },
        (payload) => {
          // Update stock items when a change occurs
          if (payload.new.shift_id === shiftId && payload.new.shift_date === today) {
            setStockItems(prev =>
              prev.map(item =>
                item.id === payload.new.id ? { ...item, ...payload.new } : item
              )
            )
            setLastUpdated(new Date())
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('✅ Successfully subscribed to stock updates')
          subscriptionSetupDone.current = true
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ Channel error, will retry in 5 seconds')
          subscriptionSetupDone.current = false
          setTimeout(() => {
            setupRealtimeSubscription(shiftId)
          }, 5000)
        }
      })

    // Store channel for cleanup
    ;(window as any).__stockChannel = channel
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      const channel = (window as any).__stockChannel
      if (channel) {
        console.log('Cleaning up subscription')
        supabase.removeChannel(channel)
        ;(window as any).__stockChannel = null
        subscriptionSetupDone.current = false
      }
    }
  }, [])

  const getStockStatus = (remaining: number, opening: number) => {
    if (opening === 0) return {
      color: 'text-danger',
      bg: 'bg-danger/10',
      label: 'No Stock',
      fill: 'progress-fill-low',
      pct: 0,
    }
    const pct = (remaining / opening) * 100
    if (pct > thresholds.high) return {
      color: 'text-[#2E7D32]',
      bg: 'bg-[#2E7D32]/10',
      label: 'Good',
      fill: 'progress-fill-high',
      pct,
    }
    if (pct >= thresholds.low) return {
      color: 'text-[#E65100]',
      bg: 'bg-[#E65100]/10',
      label: 'Low',
      fill: 'progress-fill-medium',
      pct,
    }
    return {
      color: 'text-danger',
      bg: 'bg-danger/10',
      label: 'Critical',
      fill: 'progress-fill-low',
      pct,
    }
  }

  // Summary counts
  const goodCount     = stockItems.filter(i => getStockStatus(i.remaining_qty, i.opening_qty).label === 'Good').length
  const lowCount      = stockItems.filter(i => getStockStatus(i.remaining_qty, i.opening_qty).label === 'Low').length
  const criticalCount = stockItems.filter(i => ['Critical', 'No Stock'].includes(getStockStatus(i.remaining_qty, i.opening_qty).label)).length

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

        {/* Shift info + live badge */}
        <div className="bg-primary rounded-[18px] p-5 text-white">
          <div className="flex justify-between items-start">
            <div>
              <p className="t-small text-white/60 uppercase tracking-widest mb-1">Active Shift</p>
              <p className="t-h1 text-white">{activeShift?.shifts?.name}</p>
              <p className="t-small text-white/60 mt-1">
                {new Date().toLocaleDateString('en-NG', {
                  weekday: 'short', month: 'short', day: 'numeric'
                })}
              </p>
            </div>
            <div className="flex items-center gap-1.5 bg-white/15 px-3 py-1.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              <span className="t-small text-white">Live</span>
            </div>
          </div>

          {/* Summary row */}
          <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-white/20">
            {[
              { label: 'Good',     value: goodCount,     color: 'text-white' },
              { label: 'Low',      value: lowCount,      color: 'text-white/70' },
              { label: 'Critical', value: criticalCount, color: 'text-white/70' },
            ].map(({ label, value, color }) => (
              <div key={label} className="text-center">
                <p className={`t-h2 ${color}`}>{value}</p>
                <p className="t-small text-white/50">{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Last updated */}
        <div className="flex items-center gap-2 px-1">
          <Activity size={13} className="text-text-muted" />
          <p className="t-small text-text-muted">
            Updated {lastUpdated.toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>

        {/* Stock items */}
        {stockItems.length === 0 ? (
          <div className="card text-center py-12">
            <p className="t-body text-text-muted">No stock data for this shift</p>
            <p className="t-small text-text-muted mt-1">Stock is set when a shift is opened</p>
          </div>
        ) : (
          <div className="space-y-3">
            {stockItems.map((item) => {
              const status = getStockStatus(item.remaining_qty, item.opening_qty)
              return (
                <div key={item.id} className="card">
                  {/* Item header */}
                  <div className="flex justify-between items-center mb-3">
                    <p className="t-h3 text-text-primary">{item.item_name}</p>
                    <span className={`${status.bg} ${status.color} t-small font-medium px-2.5 py-1 rounded-full`}>
                      {status.label}
                    </span>
                  </div>

                  {/* Stats row */}
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    {[
                      { label: 'Opening',   value: item.opening_qty,   highlight: false },
                      { label: 'Sold',      value: item.sold_qty,      highlight: false },
                      { label: 'Remaining', value: item.remaining_qty, highlight: true  },
                    ].map(({ label, value, highlight }) => (
                      <div key={label} className="bg-bg-subtle rounded-[10px] py-2.5 text-center">
                        <p className="t-small text-text-muted mb-0.5">{label}</p>
                        <p className={`t-mono font-semibold ${highlight ? status.color : 'text-text-primary'}`}>
                          {value}
                        </p>
                      </div>
                    ))}
                  </div>

                  {/* Progress bar */}
                  <div className="progress-bar">
                    <div
                      className={`progress-fill ${status.fill}`}
                      style={{ width: `${Math.min(status.pct, 100)}%` }}
                    />
                  </div>

                  {/* Percentage label */}
                  <p className="t-small text-text-muted text-right mt-1">
                    {Math.round(status.pct)}% remaining
                  </p>
                </div>
              )
            })}
          </div>
        )}

      </div>
    </div>
  )
}