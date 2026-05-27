'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getSession } from '@/lib/auth'

type Shift = {
  id: string
  name: string
  start_time: string
  end_time: string
}

export default function StaffDashboard() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState<any>(null)
  const [availableShifts, setAvailableShifts] = useState<Shift[]>([])
  const [activeShift, setActiveShift] = useState<any>(null)
  const [menuItems, setMenuItems] = useState<any[]>([])

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

    if (data && !error) {
      setActiveShift(data)
    }
    setLoading(false)
  }

  const fetchAvailableShifts = async () => {
    const { data, error } = await supabase
      .from('shifts')
      .select('*')
      .order('start_time', { ascending: true })

    if (!error && data) {
      setAvailableShifts(data)
    }
  }

  const fetchMenuItems = async () => {
    const { data, error } = await supabase
      .from('menu_items')
      .select('*')
      .eq('available', true)

    if (!error && data) {
      setMenuItems(data)
    }
  }

  const openShift = async (shiftId: string) => {
    const today = new Date().toISOString().split('T')[0]
    
    // Check if shift is already open today
    const { data: existingSession } = await supabase
      .from('shift_sessions')
      .select('*')
      .eq('shift_date', today)
      .eq('shift_id', shiftId)
      .single()

    if (existingSession) {
      alert('This shift is already open or closed for today')
      return
    }

    // Get all menu items for stock count
    const { data: menuItems, error: menuError } = await supabase
      .from('menu_items')
      .select('*')
      .eq('available', true)

    if (menuError) {
      alert('Error loading menu items')
      return
    }

    // Create shift session
    const { data: sessionData, error: sessionError } = await supabase
      .from('shift_sessions')
      .insert({
        shift_date: today,
        shift_id: shiftId,
        status: 'open',
        opener_staff_id: session.id,
        opened_at: new Date().toISOString()
      })
      .select()
      .single()

    if (sessionError) {
      alert('Error opening shift: ' + sessionError.message)
      return
    }

    // Log shift opened activity
    await supabase.from('shift_activities').insert({
      shift_date: today,
      shift_id: shiftId,
      staff_id: session.id,
      staff_name: `${session.first_name} ${session.surname}`,
      staff_role: session.role,
      action_type: 'OPEN_SHIFT',
      action_details: { opened_at: new Date().toISOString() }
    });

    // Create stock records for each menu item
    for (const item of menuItems) {
      const qty = prompt(`Enter opening stock for ${item.name} (${item.unit}):`, '0')
      
      if (qty !== null) {
        await supabase.from('shift_stock').insert({
          shift_date: today,
          shift_id: shiftId,
          item_id: item.id,
          item_name: item.name,
          opening_qty: parseInt(qty) || 0,
          sold_qty: 0,
          remaining_qty: parseInt(qty) || 0,
          opener_staff_id: session.id
        })
      }
    }

    setActiveShift(sessionData)
    alert('Shift opened successfully!')
  }

  if (loading) return <div className="p-6">Loading...</div>

  return (
    <div className="min-h-screen bg-bg-subtle">
      <div className="p-4">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-text-primary">
            Welcome, {session?.first_name} {session?.surname}
          </h1>
          <p className="text-text-secondary">{new Date().toLocaleDateString()}</p>
        </div>

        {activeShift ? (
          <div className="card mb-6 bg-success/10 border-success">
            <h2 className="text-lg font-bold text-success">✅ Shift Active</h2>
            <p className="text-text-primary mt-1">
              You are currently working the <strong>{activeShift.shifts?.name}</strong> shift
            </p>
            <p className="text-text-secondary text-sm mt-1">
              Opened at: {new Date(activeShift.opened_at).toLocaleTimeString()}
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
            <h2 className="text-lg font-bold text-text-primary mb-4">Available Shifts</h2>
            <div className="grid gap-4">
              {availableShifts.length === 0 ? (
                <div className="card text-center py-8">
                  <p className="text-text-muted">No shifts configured. Contact admin.</p>
                </div>
              ) : (
                availableShifts.map((shift) => (
                  <div key={shift.id} className="card flex justify-between items-center">
                    <div>
                      <h3 className="font-bold text-text-primary">{shift.name}</h3>
                      <p className="text-text-secondary text-sm">
                        {shift.start_time.slice(0,5)} - {shift.end_time.slice(0,5)}
                      </p>
                    </div>
                    <button 
                      onClick={() => openShift(shift.id)}
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
    </div>
  )
}