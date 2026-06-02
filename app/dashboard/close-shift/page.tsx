'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getSession } from '@/lib/auth'
import { useToast } from '@/lib/toast'
import { AlertTriangle } from 'lucide-react'

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
  const [submitting, setSubmitting] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const activeShiftRef = useRef<any>(null)
  const [activeShift, setActiveShift] = useState<any>(null)

  useEffect(() => {
    const userSession = getSession()
    if (!userSession) {
      router.push('/auth/login')
      return
    }
    setSession(userSession)
    checkActiveShift()
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
      return
    }

    activeShiftRef.current = data
    setActiveShift(data)
    await fetchStockData(data.shift_id)
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
      setStockItems(data.map(item => ({
        ...item,
        expected_remaining: item.remaining_qty,
        actual_remaining: item.remaining_qty,
        variance: 0,
      })))
    }
  }

  const updateActualStock = (itemId: string, value: string) => {
    const actual = parseInt(value) || 0
    setStockItems(prev => prev.map(item => {
      if (item.id !== itemId) return item
      return {
        ...item,
        actual_remaining: actual,
        variance: actual - item.expected_remaining,
      }
    }))
  }

  const handleCloseShift = async () => {
    setShowConfirm(false)
    setSubmitting(true)

    const shift = activeShiftRef.current
    if (!shift) {
      toast('Shift data not found. Please reload.', 'error')
      setSubmitting(false)
      return
    }

    const userSession = getSession()
    if (!userSession) {
      toast('Session expired. Please log in again.', 'error')
      router.push('/auth/login')
      return
    }

    const today = new Date().toISOString().split('T')[0]

    // Step 1 — batch insert close records
    const closeRecords = stockItems.map(item => ({
      shift_date: today,
      shift_id: shift.shift_id,
      closer_staff_id: userSession.id,
      item_id: item.item_id,
      opening_qty: item.opening_qty,
      sold_qty: item.sold_qty,
      actual_remaining: item.actual_remaining,
      variance: item.variance,
    }))

    if (closeRecords.length > 0) {
      const { error: closeError } = await supabase
        .from('shift_close')
        .insert(closeRecords)

      if (closeError) {
        toast('Error saving stock count: ' + closeError.message, 'error')
        setSubmitting(false)
        return
      }
    }

    // Step 2 — fetch orders and expenses in parallel
    const [ordersRes, expensesRes] = await Promise.all([
      supabase
        .from('orders')
        .select('total, payment_method, cash_amount, transfer_amount')
        .eq('shift_date', today)
        .eq('shift_id', shift.shift_id),
      supabase
        .from('expenses')
        .select('amount, payment_method')
        .eq('shift_date', today)
        .eq('shift_id', shift.shift_id),
    ])

    const orders   = ordersRes.data   || []
    const expenses = expensesRes.data || []

    const totalRevenue     = orders.reduce((s, o) => s + (o.total || 0), 0)
    const cashRevenue      = orders.reduce((s, o) => s + (o.cash_amount || 0), 0)
    const transferRevenue  = orders.reduce((s, o) => s + (o.transfer_amount || 0), 0)
    const totalExpenses    = expenses.reduce((s, e) => s + (e.amount || 0), 0)
    const cashExpenses     = expenses.filter(e => e.payment_method === 'cash').reduce((s, e) => s + e.amount, 0)
    const transferExpenses = expenses.filter(e => e.payment_method === 'transfer').reduce((s, e) => s + e.amount, 0)

    // Step 3 — log activity
    await supabase.from('shift_activities').insert({
      shift_date: today,
      shift_id: shift.shift_id,
      staff_id: userSession.id,
      staff_name: `${userSession.first_name} ${userSession.surname}`,
      staff_role: userSession.role,
      action_type: 'CLOSE_SHIFT',
      action_details: { closed_at: new Date().toISOString() },
    })

    // Step 4 — update shift session status — this is the critical step
    const { error: sessionError } = await supabase
      .from('shift_sessions')
      .update({
        status: 'closed',
        closer_staff_id: userSession.id,
        closed_at: new Date().toISOString(),
      })
      .eq('id', shift.id)

    if (sessionError) {
      toast('Error closing shift session: ' + sessionError.message, 'error')
      setSubmitting(false)
      return
    }

    // Step 5 — verify update worked
    const { data: verifyData } = await supabase
      .from('shift_sessions')
      .select('status')
      .eq('id', shift.id)
      .single()

    if (verifyData?.status !== 'closed') {
      toast('Shift status did not update. Please try again.', 'error')
      setSubmitting(false)
      return
    }

    // Step 6 — save summary and navigate
    const summary = {
      shiftName: shift.shifts?.name,
      shiftDate: today,
      openedAt: shift.opened_at,
      closedAt: new Date().toISOString(),
      totalRevenue,
      cashRevenue,
      transferRevenue,
      totalExpenses,
      cashExpenses,
      transferExpenses,
      netRevenue: totalRevenue - totalExpenses,
      orderCount: orders.length,
      stockItems: stockItems.map(item => ({
        name:     item.item_name,
        opening:  item.opening_qty,
        sold:     item.sold_qty,
        expected: item.expected_remaining,
        actual:   item.actual_remaining,
        variance: item.variance,
      })),
    }

    localStorage.setItem('shift_summary', JSON.stringify(summary))
    toast('Shift closed successfully', 'success')
    router.push('/dashboard/shift-summary')
    setSubmitting(false)
  }

  const totals = stockItems.reduce(
    (acc, item) => ({
      expected: acc.expected + item.expected_remaining,
      actual:   acc.actual   + item.actual_remaining,
      variance: acc.variance + item.variance,
    }),
    { expected: 0, actual: 0, variance: 0 }
  )

  const hasShortages = stockItems.some(i => i.variance < 0)

  if (loading) {
    return (
      <div className="min-h-screen bg-bg-subtle flex items-center justify-center">
        <div className="w-7 h-7 border-[3px] border-border border-t-primary rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-bg-subtle pb-32">
      <div className="p-4 space-y-4 max-w-2xl mx-auto">

        {/* Header */}
        <div className="bg-primary rounded-[18px] p-5 text-white">
          <p className="t-small text-white/60 uppercase tracking-widest mb-1">Closing</p>
          <p className="t-h1 text-white">{activeShift?.shifts?.name} Shift</p>
          <p className="t-small text-white/50 mt-1">
            {new Date().toLocaleDateString('en-NG', {
              weekday: 'short', month: 'short', day: 'numeric'
            })}
          </p>
          <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-white/20">
            {[
              { label: 'Expected', value: totals.expected },
              { label: 'Actual',   value: totals.actual   },
              {
                label: 'Variance',
                value: totals.variance > 0
                  ? `+${totals.variance}`
                  : `${totals.variance}`,
              },
            ].map(({ label, value }) => (
              <div key={label} className="text-center">
                <p className="t-h2 text-white">{value}</p>
                <p className="t-small text-white/50">{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Shortage warning */}
        {hasShortages && (
          <div className="flex items-start gap-3 bg-danger/10 border border-danger/20 rounded-[14px] p-4">
            <AlertTriangle size={18} className="text-danger flex-shrink-0 mt-0.5" />
            <p className="t-small text-danger leading-relaxed">
              Some items have shortages. Please verify your counts before closing.
            </p>
          </div>
        )}

        {/* Stock count */}
        <div>
          <p className="t-h3 text-text-primary mb-1">Physical Stock Count</p>
          <p className="t-small text-text-secondary mb-4">
            Enter the actual quantity of each item on hand
          </p>

          <div className="space-y-3">
            {stockItems.map((item) => (
              <div key={item.id} className="card">
                <div className="flex justify-between items-center mb-3">
                  <p className="t-h3 text-text-primary">{item.item_name}</p>
                  <p className="t-small text-text-muted">{item.unit}</p>
                </div>

                <div className="grid grid-cols-3 gap-2 mb-3">
                  {[
                    { label: 'Opening',  value: item.opening_qty        },
                    { label: 'Sold',     value: item.sold_qty           },
                    { label: 'Expected', value: item.expected_remaining },
                  ].map(({ label, value }) => (
                    <div key={label} className="bg-bg-subtle rounded-[10px] py-2.5 text-center">
                      <p className="t-small text-text-muted mb-0.5">{label}</p>
                      <p className="t-mono font-semibold text-text-primary">{value}</p>
                    </div>
                  ))}
                </div>

                <div>
                  <label className="block t-label text-text-primary mb-2">Actual Count</label>
                  <input
                    type="number"
                    value={item.actual_remaining}
                    onChange={(e) => updateActualStock(item.id, e.target.value)}
                    className="input-base"
                    inputMode="numeric"
                    min="0"
                  />
                  {item.variance !== 0 && (
                    <p className={`t-small mt-1.5 font-medium ${
                      item.variance > 0 ? 'text-[#2E7D32]' : 'text-danger'
                    }`}>
                      {item.variance > 0
                        ? `+${item.variance} surplus`
                        : `${item.variance} shortage`}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Sticky close button */}
      <div className="fixed bottom-[68px] left-0 right-0 px-4 z-20 pb-2">
        <div className="max-w-2xl mx-auto">
          <button
            onClick={() => setShowConfirm(true)}
            disabled={submitting}
            className="btn-primary w-full shadow-lg"
          >
            {submitting ? 'Closing Shift...' : 'Close Shift & Generate Report'}
          </button>
        </div>
      </div>

      {/* Confirm modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40">
          <div className="bg-white w-full max-w-md rounded-t-[24px] p-5">
            <div className="w-10 h-1 rounded-full bg-border mx-auto mb-5" />
            <p className="t-h2 text-text-primary">Close this shift?</p>
            <p className="t-body text-text-secondary mt-2 leading-relaxed">
              This will lock all orders and generate the final report. This cannot be undone.
            </p>
            {hasShortages && (
              <div className="flex items-start gap-2 bg-danger/10 rounded-[10px] p-3 mt-3">
                <AlertTriangle size={16} className="text-danger flex-shrink-0 mt-0.5" />
                <p className="t-small text-danger">
                  You have stock shortages. Are you sure you want to proceed?
                </p>
              </div>
            )}
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