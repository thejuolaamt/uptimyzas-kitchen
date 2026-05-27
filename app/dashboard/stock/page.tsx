// app/dashboard/stock/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getSession } from '@/lib/auth'

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
  const [loading, setLoading] = useState(true)
  const [stockItems, setStockItems] = useState<StockItem[]>([])
  const [activeShift, setActiveShift] = useState<any>(null)
  const [session, setSession] = useState<any>(null)
  const [thresholds, setThresholds] = useState({ high: 30, low: 10 })

  useEffect(() => {
    const userSession = getSession()
    if (!userSession) {
      router.push('/auth/login')
    } else {
      setSession(userSession)
      fetchThresholds()
      checkActiveShift()
    }
  }, [router])

  const fetchThresholds = async () => {
    const { data, error } = await supabase
      .from('settings')
      .select('key, value')
    
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
      alert('No active shift. Please open a shift first.')
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
    
    const { data, error } = await supabase
      .from('shift_stock')
      .select('*')
      .eq('shift_date', today)
      .eq('shift_id', shiftId)
      .order('item_name')

    if (error) {
      console.error('Error fetching stock:', error)
    } else {
      setStockItems(data || [])
    }
  }

  const subscribeToStockUpdates = (shiftId: string) => {
    const today = new Date().toISOString().split('T')[0]
    
    const subscription = supabase
      .channel('stock_updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'shift_stock',
          filter: `shift_date=eq.${today}`
        },
        (payload) => {
          setStockItems(prevItems =>
            prevItems.map(item =>
              item.id === payload.new.id
                ? { ...item, ...payload.new }
                : item
            )
          )
        }
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }

  const getStockStatus = (remaining: number, opening: number) => {
    if (opening === 0) return { color: 'text-danger', bg: 'bg-danger/10', label: 'No Stock' }
    const percentage = (remaining / opening) * 100
    if (percentage > thresholds.high) {
      return { color: 'text-success', bg: 'bg-success/10', label: 'Good' }
    }
    if (percentage >= thresholds.low && percentage <= thresholds.high) {
      return { color: 'text-warning', bg: 'bg-warning/10', label: 'Low' }
    }
    if (percentage < thresholds.low) {
      return { color: 'text-danger', bg: 'bg-danger/10', label: 'Critical' }
    }
    return { color: 'text-success', bg: 'bg-success/10', label: 'Good' }
  }

  const getProgressFill = (remaining: number, opening: number) => {
    if (opening === 0) return 'progress-fill-low'
    const percentage = (remaining / opening) * 100
    if (percentage > thresholds.high) return 'progress-fill-high'
    if (percentage >= thresholds.low) return 'progress-fill-medium'
    return 'progress-fill-low'
  }

  if (loading) return <div className="p-6">Loading...</div>

  return (
    <div className="min-h-screen bg-bg-subtle">
      <div className="p-4">
        <div className="card mb-4 bg-primary text-white border-none">
          <h2 className="font-bold text-lg">{activeShift?.shifts?.name} Shift</h2>
          <p className="text-sm opacity-90">{new Date().toLocaleDateString()}</p>
          <p className="text-xs opacity-75 mt-1">🔄 Live stock updates - Realtime enabled</p>
        </div>

        <div className="space-y-3">
          <h3 className="font-bold text-text-primary text-lg">Current Stock Levels</h3>
          
          {stockItems.length === 0 ? (
            <div className="card text-center py-8">
              <p className="text-text-muted">No stock data available for this shift</p>
            </div>
          ) : (
            stockItems.map((item) => {
              const status = getStockStatus(item.remaining_qty, item.opening_qty)
              const progressFill = getProgressFill(item.remaining_qty, item.opening_qty)
              const percentage = item.opening_qty === 0 ? 0 : (item.remaining_qty / item.opening_qty) * 100
              
              return (
                <div key={item.id} className="card">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h4 className="font-bold text-text-primary text-lg">{item.item_name}</h4>
                    </div>
                    <div className={`${status.bg} ${status.color} px-3 py-1 rounded-full text-xs font-semibold`}>
                      {status.label}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-2 mb-3 text-center">
                    <div>
                      <p className="text-text-secondary text-xs">Opening</p>
                      <p className="font-mono font-bold text-text-primary">{item.opening_qty}</p>
                    </div>
                    <div>
                      <p className="text-text-secondary text-xs">Sold</p>
                      <p className="font-mono font-bold text-text-primary">{item.sold_qty}</p>
                    </div>
                    <div>
                      <p className="text-text-secondary text-xs">Remaining</p>
                      <p className={`font-mono font-bold text-xl ${status.color}`}>
                        {item.remaining_qty}
                      </p>
                    </div>
                  </div>
                  
                  <div className="progress-bar">
                    <div 
                      className={`progress-fill ${progressFill}`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              )
            })
          )}
        </div>

        <div className="text-center mt-6">
          <p className="text-text-muted text-xs">
            🔄 Auto-updates enabled - stock refreshes in real-time when orders are placed
          </p>
        </div>
      </div>
    </div>
  )
}