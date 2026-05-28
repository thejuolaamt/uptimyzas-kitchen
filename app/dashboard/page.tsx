'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getSession } from '@/lib/auth'
import { useToast } from '@/lib/toast'

type Shift = {
  id: string
  name: string
  start_time: string
  end_time: string
}

type MenuItem = {
  id: string
  name: string
  unit: string
}

type StockEntry = {
  [itemId: string]: string
}

export default function StaffDashboard() {
  const router = useRouter()
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState<any>(null)
  const [availableShifts, setAvailableShifts] = useState<Shift[]>([])
  const [activeShift, setActiveShift] = useState<any>(null)
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])

  // Open shift modal state
  const [showStockModal, setShowStockModal] = useState(false)
  const [selectedShiftId, setSelectedShiftId] = useState<string | null>(null)
  const [stockEntries, setStockEntries] = useState<StockEntry>({})
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const userSession = getSession()
    if (!userSession) {
      router.push('/auth/login')
    } else {
      setSession(userSession)
      checkActiveShift()
      fetchAvailableShifts()
      fetchMenuItems()
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

    if (data && !error) setActiveShift(data)
    setLoading(false)
  }

  const fetchAvailableShifts = async () => {
    const { data, error } = await supabase
      .from('shifts')
      .select('*')
      .order('start_time', { ascending: true })

    if (!error && data) setAvailableShifts(data)
  }

  const fetchMenuItems = async () => {
    const { data, error } = await supabase
      .from('menu_items')
      .select('*')
      .eq('available', true)

    if (!error && data) setMenuItems(data)
  }

  const handleOpenShiftClick = async (shiftId: string) => {
    const today = new Date().toISOString().split('T')[0]

    const { data: existingSession } = await supabase
      .from('shift_sessions')
      .select('*')
      .eq('shift_date', today)
      .eq('shift_id', shiftId)
      .single()

    if (existingSession) {
      toast('This shift is already open or closed for today', 'warning')
      return
    }

    const initial: StockEntry = {}
    menuItems.forEach(item => { initial[item.id] = '0' })
    setStockEntries(initial)
    setSelectedShiftId(shiftId)
    setShowStockModal(true)
  }

  const handleConfirmOpenShift = async () => {
    if (!selectedShiftId) return
    setSubmitting(true)

    const today = new Date().toISOString().split('T')[0]

    const { data: sessionData, error: sessionError } = await supabase
      .from('shift_sessions')
      .insert({
        shift_date: today,
        shift_id: selectedShiftId,
        status: 'open',
        opener_staff_id: session.id,
        opened_at: new Date().toISOString()
      })
      .select()
      .single()

    if (sessionError) {
      toast('Error opening shift: ' + sessionError.message, 'error')
      setSubmitting(false)
      return
    }

    await supabase.from('shift_activities').insert({
      shift_date: today,
      shift_id: selectedShiftId,
      staff_id: session.id,
      staff_name: `${session.first_name} ${session.surname}`,
      staff_role: session.role,
      action_type: 'OPEN_SHIFT',
      action_details: { opened_at: new Date().toISOString() }
    })

    const stockRows = menuItems.map(item => ({
      shift_date: today,
      shift_id: selectedShiftId,
      item_id: item.id,
      item_name: item.name,
      opening_qty: parseInt(stockEntries[item.id]) || 0,
      sold_qty: 0,
      remaining_qty: parseInt(stockEntries[item.id]) || 0,
      opener_staff_id: session.id
    }))

    await supabase.from('shift_stock').insert(stockRows)

    setShowStockModal(false)
    setSelectedShiftId(null)
    setActiveShift(sessionData)
    setSubmitting(false)
    toast('Shift opened successfully!', 'success')
  }

  const selectedShift = availableShifts.find(s => s.id === selectedShiftId)

  if (loading) {
    return (
      <div className="min-h-screen bg-bg-subtle flex items-center justify-center">
        <div className="w-7 h-7 border-[3px] border-border border-t-primary rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-bg-subtle">
      <div className="p-4 pb-24">

        {/* Header */}
        <div className="mb-6">
          <h1 className="t-h1 text-text-primary">Welcome, {session?.first_name}</h1>
          <p className="t-body text-text-secondary mt-1">
            {new Date().toLocaleDateString('en-NG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>

        {/* Active shift */}
        {activeShift ? (
          <div className="card mb-6 border-l-4 border-l-[#2E7D32]">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 rounded-full bg-[#2E7D32]" />
              <p className="t-label text-[#2E7D32] uppercase tracking-widest">Shift Active</p>
            </div>
            <p className="t-h2 text-text-primary mt-2">{activeShift.shifts?.name}</p>
            <p className="t-small text-text-secondary mt-1">
              Opened at {new Date(activeShift.opened_at).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' })}
            </p>
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => router.push('/dashboard/orders')}
                className="btn-primary flex-1"
              >
                Take Orders
              </button>
              <button
                onClick={() => router.push('/dashboard/close-shift')}
                className="btn-secondary flex-1"
              >
                Close Shift
              </button>
            </div>
          </div>
        ) : (
          <div>
            <h2 className="t-h2 text-text-primary mb-4">Available Shifts</h2>
            <div className="grid gap-3">
              {availableShifts.length === 0 ? (
                <div className="card text-center py-10">
                  <p className="t-body text-text-muted">No shifts configured.</p>
                  <p className="t-small text-text-muted mt-1">Contact your admin.</p>
                </div>
              ) : (
                availableShifts.map((shift) => (
                  <div key={shift.id} className="card flex justify-between items-center">
                    <div>
                      <p className="t-h3 text-text-primary">{shift.name}</p>
                      <p className="t-small text-text-secondary mt-1">
                        {shift.start_time.slice(0, 5)} — {shift.end_time.slice(0, 5)}
                      </p>
                    </div>
                    <button
                      onClick={() => handleOpenShiftClick(shift.id)}
                      className="btn-primary"
                    >
                      Open Shift
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Opening Stock Modal */}
      {showStockModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40">
          <div className="bg-white w-full max-w-md rounded-t-[20px] max-h-[85vh] flex flex-col">

            <div className="px-5 pt-5 pb-4 border-b border-border flex-shrink-0">
              <div className="w-10 h-1 rounded-full bg-border mx-auto mb-4" />
              <h2 className="t-h2 text-text-primary">Opening Stock</h2>
              <p className="t-small text-text-secondary mt-1">
                {selectedShift?.name} · Enter quantities for each item
              </p>
            </div>

            <div className="overflow-y-auto flex-1 px-5 py-4 space-y-3">
              {menuItems.map(item => (
                <div key={item.id} className="flex items-center justify-between gap-4">
                  <div className="flex-1">
                    <p className="t-body text-text-primary">{item.name}</p>
                    <p className="t-small text-text-muted">{item.unit}</p>
                  </div>
                  <input
                    type="number"
                    min="0"
                    value={stockEntries[item.id] ?? '0'}
                    onChange={(e) =>
                      setStockEntries(prev => ({ ...prev, [item.id]: e.target.value }))
                    }
                    className="input-base w-24 text-center"
                  />
                </div>
              ))}
            </div>

            <div className="px-5 py-4 border-t border-border flex gap-3 flex-shrink-0">
              <button
                onClick={() => { setShowStockModal(false); setSelectedShiftId(null) }}
                className="btn-secondary flex-1"
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmOpenShift}
                className="btn-primary flex-1"
                disabled={submitting}
              >
                {submitting ? 'Opening...' : 'Confirm & Open'}
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  )
}