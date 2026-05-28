'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getSession } from '@/lib/auth'
import { useToast } from '@/lib/toast'
import { Users, Clock, ShoppingBag, Receipt, LogOut } from 'lucide-react'

type Activity = {
  id: string
  staff_name: string
  staff_role: string
  action_type: string
  action_details: any
  created_at: string
}

type StaffSummary = {
  name: string
  role: string
  opened_shift: boolean
  took_orders: number
  added_expenses: number
  closed_shift: boolean
  total_actions: number
}

export default function ShiftActivitiesPage() {
  const router = useRouter()
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [activities, setActivities] = useState<Activity[]>([])
  const [activeShift, setActiveShift] = useState<any>(null)
  const [staffSummary, setStaffSummary] = useState<StaffSummary[]>([])

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
      toast('No active shift', 'warning')
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

      const staffMap = new Map<string, StaffSummary>()
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
        const staff = staffMap.get(activity.staff_name)!
        staff.total_actions++
        switch (activity.action_type) {
          case 'OPEN_SHIFT':  staff.opened_shift = true; break
          case 'TAKE_ORDER':  staff.took_orders++;       break
          case 'ADD_EXPENSE': staff.added_expenses++;    break
          case 'CLOSE_SHIFT': staff.closed_shift = true; break
        }
      })
      setStaffSummary(Array.from(staffMap.values()))
    }
  }

  const getActionIcon = (actionType: string) => {
    switch (actionType) {
      case 'OPEN_SHIFT':  return <Clock size={15} className="text-[#2E7D32]" />
      case 'TAKE_ORDER':  return <ShoppingBag size={15} className="text-[#1565C0]" />
      case 'ADD_EXPENSE': return <Receipt size={15} className="text-[#E65100]" />
      case 'CLOSE_SHIFT': return <LogOut size={15} className="text-danger" />
      default:            return <Users size={15} className="text-text-muted" />
    }
  }

  const getActionLabel = (actionType: string) => {
    switch (actionType) {
      case 'OPEN_SHIFT':  return 'Opened Shift'
      case 'TAKE_ORDER':  return 'Took Order'
      case 'ADD_EXPENSE': return 'Added Expense'
      case 'CLOSE_SHIFT': return 'Closed Shift'
      default:            return actionType
    }
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
          <p className="t-h2 text-text-primary">Shift Activity</p>
          <p className="t-body text-text-secondary mt-1">{activeShift?.shifts?.name} Shift</p>
          <p className="t-small text-text-muted mt-0.5">
            {new Date().toLocaleDateString('en-NG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>

        {/* Staff on duty */}
        <div>
          <p className="t-h3 text-text-primary mb-3">Staff on Duty</p>
          <div className="grid gap-3">
            {staffSummary.length === 0 ? (
              <div className="card text-center py-8">
                <p className="t-body text-text-muted">No staff activity yet</p>
              </div>
            ) : (
              staffSummary.map((staff, idx) => (
                <div key={idx} className="card">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <p className="t-body text-text-primary font-medium">{staff.name}</p>
                      <p className="t-small text-text-secondary capitalize">{staff.role}</p>
                    </div>
                    <p className="t-small text-text-muted">{staff.total_actions} actions</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {staff.opened_shift && (
                      <span className="t-small bg-[#2E7D32]/10 text-[#2E7D32] px-2 py-1 rounded-full">
                        Opened Shift
                      </span>
                    )}
                    {staff.took_orders > 0 && (
                      <span className="t-small bg-[#1565C0]/10 text-[#1565C0] px-2 py-1 rounded-full">
                        {staff.took_orders} Orders
                      </span>
                    )}
                    {staff.added_expenses > 0 && (
                      <span className="t-small bg-[#E65100]/10 text-[#E65100] px-2 py-1 rounded-full">
                        {staff.added_expenses} Expenses
                      </span>
                    )}
                    {staff.closed_shift && (
                      <span className="t-small bg-danger/10 text-danger px-2 py-1 rounded-full">
                        Closed Shift
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Activity timeline */}
        <div>
          <p className="t-h3 text-text-primary mb-3">Timeline</p>
          {activities.length === 0 ? (
            <div className="card text-center py-10">
              <p className="t-body text-text-muted">No activities logged yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {activities.map((activity) => (
                <div key={activity.id} className="card">
                  <div className="flex items-start gap-3">
                    <div className="mt-1 flex-shrink-0">
                      {getActionIcon(activity.action_type)}
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="t-body text-text-primary font-medium">{activity.staff_name}</p>
                          <p className="t-small text-text-secondary">{getActionLabel(activity.action_type)}</p>
                          {activity.action_details?.order_id && (
                            <p className="t-small text-text-muted mt-1">
                              Order #{activity.action_details.order_id.slice(-6)} · ₦{activity.action_details.total?.toLocaleString()}
                            </p>
                          )}
                          {activity.action_details?.description && (
                            <p className="t-small text-text-muted mt-1">
                              {activity.action_details.description} · ₦{activity.action_details.amount?.toLocaleString()}
                            </p>
                          )}
                        </div>
                        <p className="t-small text-text-muted flex-shrink-0 ml-2">
                          {new Date(activity.created_at).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}