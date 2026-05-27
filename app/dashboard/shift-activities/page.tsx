'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getSession } from '@/lib/auth'
import { Users, Clock, ShoppingBag, Receipt, LogOut } from 'lucide-react'

type Activity = {
  id: string
  staff_name: string
  staff_role: string
  action_type: string
  action_details: any
  created_at: string
}

export default function ShiftActivitiesPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [activities, setActivities] = useState<Activity[]>([])
  const [activeShift, setActiveShift] = useState<any>(null)
  const [staffSummary, setStaffSummary] = useState<any[]>([])

  useEffect(() => {
    const userSession = getSession()
    if (!userSession) {
      router.push('/auth/login')
    } else {
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
      alert('No active shift')
      router.push('/dashboard')
    } else {
      setActiveShift(data)
      fetchActivities(data.shift_id)
    }
    setLoading(false)
  }

  const fetchActivities = async (shiftId: string) => {
    const today = new Date().toISOString().split('T')[0]
    
    const { data, error } = await supabase
      .from('shift_activities')
      .select('*')
      .eq('shift_date', today)
      .eq('shift_id', shiftId)
      .order('created_at', { ascending: false })

    if (!error && data) {
      setActivities(data)
      
      const staffMap = new Map()
      data.forEach(activity => {
        if (!staffMap.has(activity.staff_name)) {
          staffMap.set(activity.staff_name, {
            name: activity.staff_name,
            role: activity.staff_role,
            opened_shift: false,
            took_orders: 0,
            added_expenses: 0,
            closed_shift: false,
            total_actions: 0
          })
        }
        
        const staff = staffMap.get(activity.staff_name)
        staff.total_actions++
        
        switch (activity.action_type) {
          case 'OPEN_SHIFT':
            staff.opened_shift = true
            break
          case 'TAKE_ORDER':
            staff.took_orders++
            break
          case 'ADD_EXPENSE':
            staff.added_expenses++
            break
          case 'CLOSE_SHIFT':
            staff.closed_shift = true
            break
        }
      })
      
      setStaffSummary(Array.from(staffMap.values()))
    }
  }

  const getActionIcon = (actionType: string) => {
    switch (actionType) {
      case 'OPEN_SHIFT':
        return <Clock size={16} className="text-success" />
      case 'TAKE_ORDER':
        return <ShoppingBag size={16} className="text-info" />
      case 'ADD_EXPENSE':
        return <Receipt size={16} className="text-warning" />
      case 'CLOSE_SHIFT':
        return <LogOut size={16} className="text-danger" />
      default:
        return <Users size={16} />
    }
  }

  const getActionLabel = (actionType: string) => {
    switch (actionType) {
      case 'OPEN_SHIFT':
        return 'Opened Shift'
      case 'TAKE_ORDER':
        return 'Took Order'
      case 'ADD_EXPENSE':
        return 'Added Expense'
      case 'CLOSE_SHIFT':
        return 'Closed Shift'
      default:
        return actionType
    }
  }

  if (loading) return <div className="p-6">Loading...</div>

  return (
    <div className="min-h-screen bg-bg-subtle">
      <div className="p-4">
        <div className="card mb-4 bg-primary text-white border-none">
          <h2 className="font-bold text-lg">Shift Staff Activity</h2>
          <p className="text-sm opacity-90">{activeShift?.shifts?.name} Shift</p>
          <p className="text-xs opacity-75 mt-1">{new Date().toLocaleDateString()}</p>
        </div>

        <div className="mb-6">
          <h3 className="font-bold text-text-primary mb-3">Staff on Duty</h3>
          <div className="grid gap-3">
            {staffSummary.map((staff, idx) => (
              <div key={idx} className="card">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h4 className="font-bold text-text-primary">{staff.name}</h4>
                    <p className="text-text-secondary text-xs capitalize">{staff.role}</p>
                  </div>
                  <span className="text-xs text-text-muted">{staff.total_actions} actions</span>
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {staff.opened_shift && (
                    <span className="text-xs bg-success/10 text-success px-2 py-1 rounded-full">Opened Shift</span>
                  )}
                  {staff.took_orders > 0 && (
                    <span className="text-xs bg-info/10 text-info px-2 py-1 rounded-full">{staff.took_orders} Orders</span>
                  )}
                  {staff.added_expenses > 0 && (
                    <span className="text-xs bg-warning/10 text-warning px-2 py-1 rounded-full">{staff.added_expenses} Expenses</span>
                  )}
                  {staff.closed_shift && (
                    <span className="text-xs bg-danger/10 text-danger px-2 py-1 rounded-full">Closed Shift</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h3 className="font-bold text-text-primary mb-3">Activity Timeline</h3>
          <div className="space-y-2">
            {activities.length === 0 ? (
              <div className="card text-center py-8">
                <p className="text-text-muted">No activities logged yet</p>
              </div>
            ) : (
              activities.map((activity) => (
                <div key={activity.id} className="card">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">
                      {getActionIcon(activity.action_type)}
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-semibold text-text-primary">
                            {activity.staff_name}
                          </p>
                          <p className="text-sm text-text-secondary">
                            {getActionLabel(activity.action_type)}
                          </p>
                          {activity.action_details?.order_id && (
                            <p className="text-xs text-text-muted mt-1">
                              Order: {activity.action_details.order_id.slice(-8)} | 
                              ₦{activity.action_details.total?.toLocaleString()}
                            </p>
                          )}
                          {activity.action_details?.description && (
                            <p className="text-xs text-text-muted mt-1">
                              {activity.action_details.description} - ₦{activity.action_details.amount?.toLocaleString()}
                            </p>
                          )}
                        </div>
                        <p className="text-xs text-text-muted">
                          {new Date(activity.created_at).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}