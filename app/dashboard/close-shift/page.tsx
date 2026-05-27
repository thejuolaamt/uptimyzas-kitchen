'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getSession } from '@/lib/auth'

type StockItem = {
  id: string
  item_id: string
  item_name: string
  opening_qty: number
  sold_qty: number
  remaining_qty: number
  expected_remaining: number
  actual_remaining: number
  variance: number
  unit: string
}

export default function CloseShiftPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState<any>(null)
  const [stockItems, setStockItems] = useState<StockItem[]>([])
  const [activeShift, setActiveShift] = useState<any>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const userSession = getSession()
    if (!userSession) {
      router.push('/auth/login')
    } else {
      setSession(userSession)
      checkActiveShift()
    }
  }, [router])

  const checkActiveShift = async () => {
    const today = new Date().toISOString().split('T')[0]
    
    const { data, error } = await supabase
      .from('shift_sessions')
      .select('*, shifts(*)')
      .eq('shift_date', today)
      .eq('status', 'open')
      .single()

    if (!data || error) {
      alert('No active shift to close')
      router.push('/dashboard')
    } else {
      setActiveShift(data)
      fetchStockData(data.shift_id)
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

    if (!error && data) {
      const itemsWithExpected = data.map(item => ({
        ...item,
        expected_remaining: item.remaining_qty,
        actual_remaining: item.remaining_qty,
        variance: 0
      }))
      setStockItems(itemsWithExpected)
    }
  }

  const updateActualStock = (itemId: string, actualQty: number) => {
    setStockItems(prevItems =>
      prevItems.map(item => {
        if (item.id === itemId) {
          const variance = actualQty - item.expected_remaining
          return {
            ...item,
            actual_remaining: actualQty,
            variance: variance
          }
        }
        return item
      })
    )
  }

  const calculateTotals = () => {
    let totalExpected = 0
    let totalActual = 0
    let totalVariance = 0

    stockItems.forEach(item => {
      totalExpected += item.expected_remaining
      totalActual += item.actual_remaining
      totalVariance += item.variance
    })

    return { totalExpected, totalActual, totalVariance }
  }

  const handleCloseShift = async () => {
    if (!confirm('Close this shift? This will lock orders and generate final report.')) {
      return
    }

    setSubmitting(true)
    const today = new Date().toISOString().split('T')[0]

    for (const item of stockItems) {
      const { error } = await supabase
        .from('shift_close')
        .insert({
          shift_date: today,
          shift_id: activeShift.shift_id,
          closer_staff_id: session.id,
          item_id: item.item_id,
          opening_qty: item.opening_qty,
          sold_qty: item.sold_qty,
          actual_remaining: item.actual_remaining,
          variance: item.variance
        })

      if (error) {
        console.error('Error saving close record:', error)
        alert('Error closing shift: ' + error.message)
        setSubmitting(false)
        return
      }
    }

    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('total, payment_method, cash_amount, transfer_amount')
      .eq('shift_date', today)
      .eq('shift_id', activeShift.shift_id)

    if (ordersError) {
      console.error('Error fetching orders:', ordersError)
    }

    const totalRevenue = orders?.reduce((sum, order) => sum + order.total, 0) || 0
    const cashRevenue = orders?.reduce((sum, order) => sum + (order.cash_amount || 0), 0) || 0
    const transferRevenue = orders?.reduce((sum, order) => sum + (order.transfer_amount || 0), 0) || 0

    const { data: expenses, error: expensesError } = await supabase
      .from('expenses')
      .select('amount, payment_method')
      .eq('shift_date', today)
      .eq('shift_id', activeShift.shift_id)

    if (expensesError) {
      console.error('Error fetching expenses:', expensesError)
    }

    const totalExpenses = expenses?.reduce((sum, exp) => sum + exp.amount, 0) || 0
    const cashExpenses = expenses?.reduce((sum, exp) => sum + (exp.payment_method === 'cash' ? exp.amount : 0), 0) || 0
    const transferExpenses = expenses?.reduce((sum, exp) => sum + (exp.payment_method === 'transfer' ? exp.amount : 0), 0) || 0

    // Log shift closed activity
    await supabase.from('shift_activities').insert({
      shift_date: today,
      shift_id: activeShift.shift_id,
      staff_id: session.id,
      staff_name: `${session.first_name} ${session.surname}`,
      staff_role: session.role,
      action_type: 'CLOSE_SHIFT',
      action_details: { closed_at: new Date().toISOString() }
    });

    const { error: sessionError } = await supabase
      .from('shift_sessions')
      .update({
        status: 'closed',
        closer_staff_id: session.id,
        closed_at: new Date().toISOString()
      })
      .eq('id', activeShift.id)

    if (sessionError) {
      alert('Error updating shift status: ' + sessionError.message)
      setSubmitting(false)
      return
    }

    const summary = {
      shiftName: activeShift.shifts?.name,
      shiftDate: today,
      openedAt: activeShift.opened_at,
      closedAt: new Date().toISOString(),
      totalRevenue,
      cashRevenue,
      transferRevenue,
      totalExpenses,
      cashExpenses,
      transferExpenses,
      netRevenue: totalRevenue - totalExpenses,
      stockItems: stockItems.map(item => ({
        name: item.item_name,
        opening: item.opening_qty,
        sold: item.sold_qty,
        expected: item.expected_remaining,
        actual: item.actual_remaining,
        variance: item.variance
      }))
    }

    localStorage.setItem('shift_summary', JSON.stringify(summary))
    router.push('/dashboard/shift-summary')
    setSubmitting(false)
  }

  const { totalExpected, totalActual, totalVariance } = calculateTotals()

  if (loading) return <div className="p-6">Loading...</div>

  return (
    <div className="min-h-screen bg-bg-subtle pb-20">
      <div className="p-4">
        <div className="card mb-4 bg-primary text-white border-none">
          <h2 className="font-bold text-lg">Close Shift</h2>
          <p className="text-sm opacity-90">{activeShift?.shifts?.name} Shift</p>
          <p className="text-xs opacity-75 mt-1">{new Date().toLocaleDateString()}</p>
        </div>

        <div className="card mb-4">
          <h3 className="font-bold text-text-primary mb-3">Count Actual Stock</h3>
          <p className="text-text-secondary text-sm mb-4">
            Enter the physical count of each item
          </p>
          
          <div className="space-y-4">
            {stockItems.map((item) => (
              <div key={item.id} className="border-b border-border pb-3">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-semibold text-text-primary">{item.item_name}</span>
                  <span className="text-xs text-text-muted">{item.unit}</span>
                </div>
                
                <div className="grid grid-cols-3 gap-2 text-center text-xs mb-2">
                  <div>
                    <p className="text-text-muted">Opening</p>
                    <p className="font-mono font-bold">{item.opening_qty}</p>
                  </div>
                  <div>
                    <p className="text-text-muted">Sold</p>
                    <p className="font-mono font-bold">{item.sold_qty}</p>
                  </div>
                  <div>
                    <p className="text-text-muted">Expected</p>
                    <p className="font-mono font-bold">{item.expected_remaining}</p>
                  </div>
                </div>
                
                <div>
                  <label className="block text-text-primary text-sm mb-1">Actual Count</label>
                  <input
                    type="number"
                    value={item.actual_remaining}
                    onChange={(e) => updateActualStock(item.id, parseInt(e.target.value) || 0)}
                    className="input-base"
                    min="0"
                  />
                  {item.variance !== 0 && (
                    <p className={`text-xs mt-1 ${item.variance > 0 ? 'text-success' : 'text-danger'}`}>
                      {item.variance > 0 ? `+${item.variance} surplus` : `${item.variance} shortage`}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card mb-4">
          <h3 className="font-bold text-text-primary mb-3">Summary</h3>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-text-secondary">Total Expected Stock</span>
              <span className="font-mono font-bold">{totalExpected}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-secondary">Total Actual Stock</span>
              <span className="font-mono font-bold">{totalActual}</span>
            </div>
            <div className="flex justify-between border-t border-border pt-2 mt-2">
              <span className="font-semibold">Total Variance</span>
              <span className={`font-mono font-bold ${totalVariance > 0 ? 'text-success' : totalVariance < 0 ? 'text-danger' : ''}`}>
                {totalVariance > 0 ? `+${totalVariance}` : totalVariance}
              </span>
            </div>
          </div>
        </div>

        <button
          onClick={handleCloseShift}
          disabled={submitting}
          className="btn-primary w-full"
        >
          {submitting ? 'Closing Shift...' : 'Close Shift & Generate Report'}
        </button>
      </div>
    </div>
  )
}