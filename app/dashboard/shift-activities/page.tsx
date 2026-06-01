'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getSession } from '@/lib/auth'
import { useToast } from '@/lib/toast'
import { Clock, ShoppingBag, Receipt, LogOut, Users } from 'lucide-react'

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

const ACTION_CONFIG: Record<string, {
  label: string
  icon: any
  color: string
  bg: string
}> = {
  OPEN_SHIFT:  { label: 'Opened Shift',  icon: Clock,       color: 'text-[#2E7D32]', bg: 'bg-[#2E7D32]/10' },
  TAKE_ORDER:  { label: 'Took Order',    icon: ShoppingBag, color: 'text-[#1565C0]', bg: 'bg-[#1565C0]/10' },
  ADD_EXPENSE: { label: 'Added Expense', icon: Receipt,     color: 'text-[#E65100]', bg: 'bg-[#E65100]/10' },
  CLOSE_SHIFT: { label: 'Closed Shift',  icon: LogOut,      color: 'text-danger',    bg: 'bg-danger/10'     },
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
      return
    }
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
      toast('No active shift', 'warning')
      router.push('/dashboard')
      return
    }
    setActiveShift(data)
    fetchActivities(data.shift_id)
    setLoading(false)
  }

  const fetchActivities = async (shiftId: string) => {
    const today = new Date().toISOString().split('T')[0]
    const { data } = await supabase
      .from('shift_activities')
      .select('*')
      .eq('shift_date', today)
      .eq('shift_id', shiftId)
      .order('created_at', { ascending: false })

    if (!data) return
    setActivities(data)

    const staffMap = new Map<string, StaffSummary>()
    data.forEach(a => {
      if (!staffMap.has(a.staff_name)) {
        staffMap.set(a.staff_name, {
          name: a.staff_name,
          role: a.staff_role,
          opened_shift: false,
          took_orders: 0,
          added_expenses: 0,
          closed_shift: false,
          total_actions: 0,
        })
      }
      const staff = staffMap.get(a.staff_name)!
      staff.total_actions++
      if (a.action_type === 'OPEN_SHIFT')  staff.opened_shift = true
      if (a.action_type === 'TAKE_ORDER')  staff.took_orders++
      if (a.action_type === 'ADD_EXPENSE') staff.added_expenses++
      if (a.action_type === 'CLOSE_SHIFT') staff.closed_shift = true
    })
    setStaffSummary(Array.from(staffMap.values()))
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
        <div className="bg-primary rounded-[18px] p-5 text-white">
          <p className="t-small text-white/60 uppercase tracking-widest mb-1">Shift Activity</p>
          <p className="t-h1 text-white">{activeShift?.shifts?.name}</p>
          <p className="t-small text-white/50 mt-1">
            {new Date().toLocaleDateString('en-NG', {
              weekday: 'short', month: 'short', day: 'numeric'
            })}
          </p>

          {/* Quick stats */}
          <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-white/20">
            {[
              { label: 'Staff', value: staffSummary.length },
              { label: 'Orders', value: activities.filter(a => a.action_type === 'TAKE_ORDER').length },
              { label: 'Expenses', value: activities.filter(a => a.action_type === 'ADD_EXPENSE').length },
            ].map(({ label, value }) => (
              <div key={label} className="text-center">
                <p className="t-h2 text-white">{value}</p>
                <p className="t-small text-white/50">{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Staff on duty */}
        <div>
          <p className="t-h3 text-text-primary mb-3">Staff on Duty</p>
          {staffSummary.length === 0 ? (
            <div className="card text-center py-8">
              <Users size={28} className="mx-auto text-text-muted mb-2" />
              <p className="t-body text-text-muted">No staff activity yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {staffSummary.map((staff, idx) => (
                <div key={idx} className="card">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <p className="t-body text-text-primary font-medium">{staff.name}</p>
                      <p className="t-small text-text-secondary capitalize">{staff.role}</p>
                    </div>
                    <span className="t-small text-text-muted bg-bg-subtle px-2 py-1 rounded-full">
                      {staff.total_actions} actions
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {staff.opened_shift && (
                      <span className="t-small bg-[#2E7D32]/10 text-[#2E7D32] px-2.5 py-1 rounded-full">
                        Opened
                      </span>
                    )}
                    {staff.took_orders > 0 && (
                      <span className="t-small bg-[#1565C0]/10 text-[#1565C0] px-2.5 py-1 rounded-full">
                        {staff.took_orders} Orders
                      </span>
                    )}
                    {staff.added_expenses > 0 && (
                      <span className="t-small bg-[#E65100]/10 text-[#E65100] px-2.5 py-1 rounded-full">
                        {staff.added_expenses} Expenses
                      </span>
                    )}
                    {staff.closed_shift && (
                      <span className="t-small bg-danger/10 text-danger px-2.5 py-1 rounded-full">
                        Closed
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
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
              {activities.map((activity) => {
                const config = ACTION_CONFIG[activity.action_type] || {
                  label: activity.action_type,
                  icon: Users,
                  color: 'text-text-muted',
                  bg: 'bg-bg-subtle',
                }
                const Icon = config.icon
                return (
                  <div key={activity.id} className="card flex items-start gap-3">
                    <div className={`${config.bg} w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0`}>
                      <Icon size={16} className={config.color} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start gap-2">
                        <div className="min-w-0">
                          <p className="t-body text-text-primary font-medium truncate">
                            {activity.staff_name}
                          </p>
                          <p className="t-small text-text-secondary">{config.label}</p>
                          {activity.action_details?.total != null && (
                            <p className="t-small text-text-muted mt-0.5">
                              ₦{activity.action_details.total.toLocaleString()}
                              {activity.action_details.items != null && ` · ${activity.action_details.items} item(s)`}
                            </p>
                          )}
                          {activity.action_details?.description && (
                            <p className="t-small text-text-muted mt-0.5 truncate">
                              {activity.action_details.description} · ₦{activity.action_details.amount?.toLocaleString()}
                            </p>
                          )}
                        </div>
                        <p className="t-small text-text-muted flex-shrink-0">
                          {new Date(activity.created_at).toLocaleTimeString('en-NG', {
                            hour: '2-digit', minute: '2-digit'
                          })}
                        </p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}