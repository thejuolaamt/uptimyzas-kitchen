'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getSession } from '@/lib/auth'
import { useToast } from '@/lib/toast'

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
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState<any>(null)
  const [stockItems, setStockItems] = useState<StockItem[]>([])
  const [activeShift, setActiveShift] = useState<any>(null)
  const [submitting, setSubmitting] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

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
      toast('No active shift to close', 'warning')
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
      setStockItems(data.map(item => ({
        ...item,
        expected_remaining: item.remaining_qty,
        actual_remaining: item.remaining_qty,
        variance: 0
      })))
    }
  }

  const updateActualStock = (itemId: string, actualQty: number) => {
    setStockItems(prev =>
      prev.map(item =>
        item.id === itemId
          ? { ...item, actual_remaining: actualQty, variance: actualQty - item.expected_remaining }
          : item
      )
    )
  }

  const calculateTotals = () => {
    return stockItems.reduce((acc, item) => ({
      totalExpected: acc.totalExpected + item.expected_remaining,
      totalActual: acc.totalActual + item.actual_remaining,
      totalVariance: acc.totalVariance + item.variance,
    }), { totalExpected: 0, totalActual: 0, totalVariance: 0 })
  }

  const handleCloseShift = async () => {
    setShowConfirm(false)
    setSubmitting(true)
    const today = new Date().toISOString().split('T')[0]

    // Save close records in batch
    const closeRecords = stockItems.map(item => ({
      shift_date: today,
      shift_id: activeShift.shift_id,
      closer_staff_id: session.id,
      item_id: item.item_id,
      opening_qty: item.opening_qty,
      sold_qty: item.sold_qty,
      actual_remaining: item.actual_remaining,
      variance: item.variance
    }))

    const { error: closeError } = await supabase
      .from('shift_close')
      .insert(closeRecords)

    if (closeError) {
      toast('Error closing shift: ' + closeError.message, 'error')
      setSubmitting(false)
      return
    }

    const { data: orders } = await supabase
      .from('orders')
      .select('total, payment_method, cash_amount, transfer_amount')
      .eq('shift_date', today)
      .eq('shift_id', activeShift.shift_id)

    const totalRevenue = orders?.reduce((sum, o) => sum + o.total, 0) || 0
    const cashRevenue = orders?.reduce((sum, o) => sum + (o.cash_amount || 0), 0) || 0
    const transferRevenue = orders?.reduce((sum, o) => sum + (o.transfer_amount || 0), 0) || 0

    const { data: expenses } = await supabase
      .from('expenses')
      .select('amount, payment_method')
      .eq('shift_date', today)
      .eq('shift_id', activeShift.shift_id)

    const totalExpenses = expenses?.reduce((sum, e) => sum + e.amount, 0) || 0
    const cashExpenses = expenses?.reduce((sum, e) => sum + (e.payment_method === 'cash' ? e.amount : 0), 0) || 0
    const transferExpenses = expenses?.reduce((sum, e) => sum + (e.payment_method === 'transfer' ? e.amount : 0), 0) || 0

    await supabase.from('shift_activities').insert({
      shift_date: today,
      shift_id: activeShift.shift_id,
      staff_id: session.id,
      staff_name: `${session.first_name} ${session.surname}`,
      staff_role: session.role,
      action_type: 'CLOSE_SHIFT',
      action_details: { closed_at: new Date().toISOString() }
    })

    const { error: sessionError } = await supabase
      .from('shift_sessions')
      .update({
        status: 'closed',
        closer_staff_id: session.id,
        closed_at: new Date().toISOString()
      })
      .eq('id', activeShift.id)

    if (sessionError) {
      toast('Error updating shift status: ' + sessionError.message, 'error')
      setSubmitting(false)
      return
    }

    localStorage.setItem('shift_summary', JSON.stringify({
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
    }))

    router.push('/dashboard/shift-summary')
    setSubmitting(false)
  }

  const { totalExpected, totalActual, totalVariance } = calculateTotals()

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

        {/* Header card */}
        <div className="card border-l-4 border-l-primary">
          <p className="t-h2 text-text-primary">Close Shift</p>
          <p className="t-body text-text-secondary mt-1">{activeShift?.shifts?.name} Shift</p>
          <p className="t-small text-text-muted mt-0.5">{new Date().toLocaleDateString('en-NG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>

        {/* Stock count */}
        <div className="card">
          <p className="t-h3 text-text-primary mb-1">Count Actual Stock</p>
          <p className="t-small text-text-secondary mb-4">Enter the physical count of each item</p>

          <div className="space-y-4">
            {stockItems.map((item) => (
              <div key={item.id} className="border-b border-border pb-4">
                <div className="flex justify-between items-center mb-3">
                  <p className="t-body text-text-primary font-medium">{item.item_name}</p>
                  <p className="t-small text-text-muted">{item.unit}</p>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center mb-3">
                  <div className="bg-bg-subtle rounded-[8px] p-2">
                    <p className="t-small text-text-muted">Opening</p>
                    <p className="t-mono font-medium text-text-primary">{item.opening_qty}</p>
                  </div>
                  <div className="bg-bg-subtle rounded-[8px] p-2">
                    <p className="t-small text-text-muted">Sold</p>
                    <p className="t-mono font-medium text-text-primary">{item.sold_qty}</p>
                  </div>
                  <div className="bg-bg-subtle rounded-[8px] p-2">
                    <p className="t-small text-text-muted">Expected</p>
                    <p className="t-mono font-medium text-text-primary">{item.expected_remaining}</p>
                  </div>
                </div>

                <div>
                  <label className="block t-label text-text-primary mb-1">Actual Count</label>
                  <input
                    type="number"
                    value={item.actual_remaining}
                    onChange={(e) => updateActualStock(item.id, parseInt(e.target.value) || 0)}
                    className="input-base"
                    min="0"
                  />
                  {item.variance !== 0 && (
                    <p className={`t-small mt-1 ${item.variance > 0 ? 'text-[#2E7D32]' : 'text-danger'}`}>
                      {item.variance > 0 ? `+${item.variance} surplus` : `${item.variance} shortage`}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Summary */}
        <div className="card">
          <p className="t-h3 text-text-primary mb-3">Summary</p>
          <div className="space-y-2">
            <div className="flex justify-between">
              <p className="t-body text-text-secondary">Total Expected</p>
              <p className="t-mono text-text-primary">{totalExpected}</p>
            </div>
            <div className="flex justify-between">
              <p className="t-body text-text-secondary">Total Actual</p>
              <p className="t-mono text-text-primary">{totalActual}</p>
            </div>
            <div className="flex justify-between border-t border-border pt-2 mt-2">
              <p className="t-body text-text-primary font-medium">Total Variance</p>
              <p className={`t-mono font-medium ${totalVariance > 0 ? 'text-[#2E7D32]' : totalVariance < 0 ? 'text-danger' : 'text-text-primary'}`}>
                {totalVariance > 0 ? `+${totalVariance}` : totalVariance}
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={() => setShowConfirm(true)}
          disabled={submitting}
          className="btn-primary w-full"
        >
          {submitting ? 'Closing Shift...' : 'Close Shift & Generate Report'}
        </button>

      </div>

      {/* Confirm modal — replaces browser confirm() */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40">
          <div className="bg-white w-full max-w-md rounded-t-[20px] p-5">
            <div className="w-10 h-1 rounded-full bg-border mx-auto mb-5" />
            <p className="t-h2 text-text-primary">Close this shift?</p>
            <p className="t-body text-text-secondary mt-2">
              This will lock all orders and generate the final shift report. This cannot be undone.
            </p>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowConfirm(false)}
                className="btn-secondary flex-1"
              >
                Cancel
              </button>
              <button
                onClick={handleCloseShift}
                className="btn-primary flex-1"
              >
                Yes, Close Shift
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}