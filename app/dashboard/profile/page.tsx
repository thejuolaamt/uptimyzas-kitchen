'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getSession, clearSession } from '@/lib/auth'
import { User, Mail, Phone, MapPin, GraduationCap, Calendar, LogOut, Shield } from 'lucide-react'

type UserProfile = {
  id: string
  email: string
  first_name: string
  surname: string
  phone: string
  additional_phone: string | null
  role: string
  status: string
  is_student: boolean
  state: string | null
  city: string | null
  address: string | null
  created_at: string
  approved_at: string | null
}

export default function ProfilePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [stats, setStats] = useState({ totalOrders: 0, totalRevenue: 0, shiftsWorked: 0 })

  useEffect(() => {
    const userSession = getSession()
    if (!userSession) {
      router.push('/auth/login')
    } else {
      fetchProfile(userSession.id)
      fetchUserStats(userSession.id)
    }
  }, [router])

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase.from('users').select('*').eq('id', userId).single()
    if (data) setProfile(data)
    setLoading(false)
  }

  const fetchUserStats = async (userId: string) => {
    const { data: orders } = await supabase.from('orders').select('total').eq('staff_id', userId)
    const { data: activities } = await supabase.from('shift_activities').select('shift_date').eq('staff_id', userId)
    setStats({
      totalOrders: orders?.length || 0,
      totalRevenue: orders?.reduce((s, o) => s + o.total, 0) || 0,
      shiftsWorked: new Set(activities?.map(a => a.shift_date)).size
    })
  }

  const handleLogout = () => {
    clearSession()
    router.push('/auth/login')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-bg-subtle flex items-center justify-center">
        <div className="w-7 h-7 border-[3px] border-border border-t-primary rounded-full animate-spin" />
      </div>
    )
  }

  if (!profile) return null

  return (
    <div className="min-h-screen bg-bg-subtle pb-24">
      <div className="p-4 space-y-4">

        {/* Profile header */}
        <div className="bg-primary rounded-[10px] p-5 text-white text-center">
          <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3">
            <User size={32} className="text-white" />
          </div>
          <h1 className="t-h2 text-white">{profile.first_name} {profile.surname}</h1>
          <p className="t-small text-white/70 mt-0.5">{profile.email}</p>
          <div className="flex justify-center gap-2 mt-3">
            <span className={`px-3 py-1 rounded-full t-small font-medium ${
              profile.role === 'admin' ? 'bg-white/20 text-white' : 'bg-white/10 text-white/80'
            }`}>
              {profile.role === 'admin' ? 'Administrator' : 'Staff'}
            </span>
            <span className="bg-[#2E7D32]/30 text-white px-3 py-1 rounded-full t-small font-medium capitalize">
              {profile.status}
            </span>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Orders', value: stats.totalOrders, color: 'text-primary' },
            { label: 'Revenue', value: `₦${stats.totalRevenue.toLocaleString()}`, color: 'text-[#2E7D32]' },
            { label: 'Shifts', value: stats.shiftsWorked, color: 'text-[#1565C0]' },
          ].map(({ label, value, color }) => (
            <div key={label} className="card text-center">
              <p className="t-small text-text-muted">{label}</p>
              <p className={`t-h2 ${color} mt-1`}>{value}</p>
            </div>
          ))}
        </div>

        {/* Personal info */}
        <div className="card space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <User size={16} className="text-text-muted" />
            <p className="t-h3 text-text-primary">Personal Information</p>
          </div>
          {[
            { label: 'Full Name', value: `${profile.first_name} ${profile.surname}` },
            { label: 'Email', value: profile.email },
            { label: 'Phone', value: profile.phone },
            profile.additional_phone ? { label: 'Additional Phone', value: profile.additional_phone } : null,
            { label: 'Student', value: profile.is_student ? 'Yes' : 'No' },
          ].filter(Boolean).map((item: any) => (
            <div key={item.label} className="flex justify-between items-center py-2 border-b border-border last:border-0">
              <p className="t-small text-text-muted">{item.label}</p>
              <p className="t-body text-text-primary">{item.value}</p>
            </div>
          ))}
        </div>

        {/* Location */}
        {(profile.state || profile.city || profile.address) && (
          <div className="card space-y-2">
            <div className="flex items-center gap-2 mb-1">
              <MapPin size={16} className="text-text-muted" />
              <p className="t-h3 text-text-primary">Location</p>
            </div>
            {[
              profile.state   ? { label: 'State',   value: profile.state }   : null,
              profile.city    ? { label: 'City',    value: profile.city }    : null,
              profile.address ? { label: 'Address', value: profile.address } : null,
            ].filter(Boolean).map((item: any) => (
              <div key={item.label} className="flex justify-between items-center py-2 border-b border-border last:border-0">
                <p className="t-small text-text-muted">{item.label}</p>
                <p className="t-body text-text-primary text-right">{item.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Account info */}
        <div className="card space-y-2">
          <div className="flex items-center gap-2 mb-1">
            <Calendar size={16} className="text-text-muted" />
            <p className="t-h3 text-text-primary">Account</p>
          </div>
          {[
            { label: 'Member Since', value: new Date(profile.created_at).toLocaleDateString('en-NG') },
            profile.approved_at ? { label: 'Approved On', value: new Date(profile.approved_at).toLocaleDateString('en-NG') } : null,
            { label: 'Role', value: profile.role, icon: Shield },
          ].filter(Boolean).map((item: any) => (
            <div key={item.label} className="flex justify-between items-center py-2 border-b border-border last:border-0">
              <p className="t-small text-text-muted capitalize">{item.label}</p>
              <p className="t-body text-text-primary capitalize">{item.value}</p>
            </div>
          ))}
        </div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-[10px] border border-danger/30 text-danger hover:bg-danger/5 transition-colors t-label"
        >
          <LogOut size={16} />
          Sign Out
        </button>

      </div>
    </div>
  )
}