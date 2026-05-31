'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getSession } from '@/lib/auth'
import { useToast } from '@/lib/toast'
import { Clock, ShoppingBag, ChevronRight } from 'lucide-react'

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
  const [assignedShifts, setAssignedShifts] = useState<Shift[]>([])
  const [activeShift, setActiveShift] = useState<any>(null)
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [timezone, setTimezone] = useState('Africa/Lagos')

  // Stock modal state
  const [showStockModal, setShowStockModal] = useState(false)
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null)
  const [stockEntries, setStockEntries] = useState<StockEntry>({})
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const userSession = getSession()
    if (!userSession) {
      router.push('/auth/login')
    } else {
      setSession(userSession)
    }
  }, [router])

  useEffect(() => {
    if (!session) return
    fetchAll()
  }, [session])

  const fetchAll = async () => {
    await Promise.all([
      checkActiveShift(),
      fetchAssignedShifts(),
      fetchMenuItems(),
      fetchTimezone(),
    ])
    setLoading(false)
  }

  const fetchTimezone = async () => {
    const { data } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'timezone')
      .single()
    if (data?.value) setTimezone(data.value)
  }

  const checkActiveShift = async () => {
    const today = new Date().toISOString().split('T')[0]
    const { data, error } = await supabase
      .from('shift_sessions')
      .select('*, shifts(*)')
      .eq('shift_date', today)
      .eq('status', 'open')
      .single()

    if (data && !error) setActiveShift(data)
  }

  const fetchAssignedShifts = async () => {
    // Get shifts assigned to this staff member only
    const { data, error } = await supabase
      .from('staff_shifts')
      .select('shift_id, shifts(*)')
      .eq('staff_id', session.id)

    if (!error && data) {
      const shifts = data
        .map((ss: any) => ss.shifts)
        .filter(Boolean)
        .sort((a: Shift, b: Shift) => a.start_time.localeCompare(b.start_time))
      setAssignedShifts(shifts)
    }
  }

  const fetchMenuItems = async () => {
    const { data } = await supabase
      .from('menu_items')
      .select('id, name, unit')
      .eq('available', true)
    if (data) setMenuItems(data)
  }

  const isWithinShiftWindow = (shift: Shift): boolean => {
    const now = new Date()
    const nowMinutes = now.getHours() * 60 + now.getMinutes()

    const [startH, startM] = shift.start_time.slice(0, 5).split(':').map(Number)
    const [endH, endM] = shift.end_time.slice(0, 5).split(':').map(Number)

    const startMinutes = startH * 60 + startM
    const endMinutes = endH * 60 + endM

    // Handle overnight shifts e.g. 10pm - 6am
    if (endMinutes < startMinutes) {
      return nowMinutes >= startMinutes || nowMinutes <= endMinutes
    }
    return nowMinutes >= startMinutes && nowMinutes <= endMinutes
  }

  const getShiftStatus = (shift: Shift): 'open-now' | 'upcoming' | 'ended' => {
    const now = new Date()
    const nowMinutes = now.getHours() * 60 + now.getMinutes()
    const [startH, startM] = shift.start_time.slice(0, 5).split(':').map(Number)
    const [endH, endM] = shift.end_time.slice(0, 5).split(':').map(Number)
    const startMinutes = startH * 60 + startM
    const endMinutes = endH * 60 + endM

    if (endMinutes < startMinutes) {
      if (nowMinutes >= startMinutes || nowMinutes <= endMinutes) return 'open-now'
      if (nowMinutes < startMinutes) return 'upcoming'
      return 'ended'
    }
    if (nowMinutes < startMinutes) return 'upcoming'
    if (nowMinutes > endMinutes) return 'ended'
    return 'open-now'
  }

  const handleOpenShiftClick = async (shift: Shift) => {
    // Time window check
    if (!isWithinShiftWindow(shift)) {
      const status = getShiftStatus(shift)
      if (status === 'upcoming') {
        toast(`${shift.name} shift hasn't started yet. It starts at ${shift.start_time.slice(0, 5)}`, 'warning')
      } else {
        toast(`${shift.name} shift has already ended at ${shift.end_time.slice(0, 5)}`, 'warning')
      }
      return
    }

    const today = new Date().toISOString().split('T')[0]
    const { data: existing } = await supabase
      .from('shift_sessions')
      .select('id')
      .eq('shift_date', today)
      .eq('shift_id', shift.id)
      .single()

    if (existing) {
      toast('This shift is already open for today', 'warning')
      return
    }

    const initial: StockEntry = {}
    menuItems.forEach(item => { initial[item.id] = '0' })
    setStockEntries(initial)
    setSelectedShift(shift)
    setShowStockModal(true)
  }

  const handleConfirmOpenShift = async () => {
    if (!selectedShift || !session) return
    setSubmitting(true)

    const today = new Date().toISOString().split('T')[0]

    const { data: sessionData, error: sessionError } = await supabase
      .from('shift_sessions')
      .insert({
        shift_date: today,
        shift_id: selectedShift.id,
        status: 'open',
        opener_staff_id: session.id,
        opened_at: new Date().toISOString(),
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
      shift_id: selectedShift.id,
      staff_id: session.id,
      staff_name: `${session.first_name} ${session.surname}`,
      staff_role: session.role,
      action_type: 'OPEN_SHIFT',
      action_details: { opened_at: new Date().toISOString() },
    })

    const stockRows = menuItems.map(item => ({
      shift_date: today,
      shift_id: selectedShift.id,
      item_id: item.id,
      item_name: item.name,
      opening_qty: parseInt(stockEntries[item.id]) || 0,
      sold_qty: 0,
      remaining_qty: parseInt(stockEntries[item.id]) || 0,
      opener_staff_id: session.id,
    }))

    await supabase.from('shift_stock').insert(stockRows)

    setActiveShift({ ...sessionData, shifts: selectedShift })
    setShowStockModal(false)
    setSelectedShift(null)
    setSubmitting(false)
    toast('Shift opened successfully!', 'success')
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
      <div className="p-4 pb-24 space-y-6">

        {/* Greeting */}
        <div className="pt-2">
          <h1 className="t-h1 text-text-primary">
            Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'},{' '}
            {session?.first_name} 👋
          </h1>
          <p className="t-body text-text-secondary mt-1">
            {new Date().toLocaleDateString('en-NG', {
              weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
            })}
          </p>
        </div>

        {/* Active shift */}
        {activeShift && (
          <div className="bg-primary rounded-[16px] p-5 text-white">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
              <p className="t-small uppercase tracking-widest text-white/70">Active Shift</p>
            </div>
            <p className="t-h1 text-white mt-1">{activeShift.shifts?.name}</p>
            <p className="t-small text-white/60 mt-0.5">
              Opened at {new Date(activeShift.opened_at).toLocaleTimeString('en-NG', {
                hour: '2-digit', minute: '2-digit'
              })}
            </p>
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => router.push('/dashboard/orders')}
                className="flex-1 flex items-center justify-center gap-2 bg-white text-primary py-3 rounded-[12px] t-label"
              >
                <ShoppingBag size={16} />
                Take Orders
              </button>
              <button
                onClick={() => router.push('/dashboard/close-shift')}
                className="flex-1 flex items-center justify-center gap-2 bg-white/20 text-white py-3 rounded-[12px] t-label"
              >
                Close Shift
              </button>
            </div>
          </div>
        )}

        {/* Assigned shifts */}
        {!activeShift && (
          <div>
            <p className="t-h3 text-text-primary mb-3">Your Shifts</p>

            {assignedShifts.length === 0 ? (
              <div className="bg-white rounded-[16px] p-6 text-center border border-border">
                <Clock size={32} className="mx-auto text-text-muted mb-2" />
                <p className="t-body text-text-muted">No shifts assigned yet</p>
                <p className="t-small text-text-muted mt-1">Contact your admin to get assigned</p>
              </div>
            ) : (
              <div className="space-y-3">
                {assignedShifts.map(shift => {
                  const status = getShiftStatus(shift)
                  return (
                    <div
                      key={shift.id}
                      className="bg-white rounded-[16px] p-4 border border-border"
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <p className="t-h2 text-text-primary">{shift.name}</p>
                          <p className="t-mono text-text-secondary mt-0.5">
                            {shift.start_time.slice(0, 5)} — {shift.end_time.slice(0, 5)}
                          </p>
                        </div>
                        <span className={`t-small px-2 py-1 rounded-full font-medium ${
                          status === 'open-now'
                            ? 'bg-[#2E7D32]/10 text-[#2E7D32]'
                            : status === 'upcoming'
                            ? 'bg-[#1565C0]/10 text-[#1565C0]'
                            : 'bg-border text-text-muted'
                        }`}>
                          {status === 'open-now' ? 'Now' : status === 'upcoming' ? 'Upcoming' : 'Ended'}
                        </span>
                      </div>

                      <button
                        onClick={() => handleOpenShiftClick(shift)}
                        disabled={status !== 'open-now'}
                        className={`w-full py-3 rounded-[12px] t-label flex items-center justify-center gap-2 transition-colors ${
                          status === 'open-now'
                            ? 'bg-primary text-white'
                            : 'bg-bg-subtle text-text-muted cursor-not-allowed'
                        }`}
                      >
                        {status === 'open-now' ? (
                          <>Open Shift <ChevronRight size={16} /></>
                        ) : status === 'upcoming' ? (
                          `Starts at ${shift.start_time.slice(0, 5)}`
                        ) : (
                          `Ended at ${shift.end_time.slice(0, 5)}`
                        )}
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

      </div>

      {/* Stock modal */}
      {showStockModal && selectedShift && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40">
          <div className="bg-white w-full max-w-md rounded-t-[20px] max-h-[85vh] flex flex-col">
            <div className="px-5 pt-5 pb-4 border-b border-border flex-shrink-0">
              <div className="w-10 h-1 rounded-full bg-border mx-auto mb-4" />
              <h2 className="t-h2 text-text-primary">Opening Stock</h2>
              <p className="t-small text-text-secondary mt-1">
                {selectedShift.name} · Enter quantities for each item
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
                onClick={() => { setShowStockModal(false); setSelectedShift(null) }}
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