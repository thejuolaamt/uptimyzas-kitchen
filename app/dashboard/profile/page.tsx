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
  const [session, setSession] = useState<any>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [stats, setStats] = useState({
    totalOrders: 0,
    totalRevenue: 0,
    shiftsWorked: 0
  })

  useEffect(() => {
    const userSession = getSession()
    if (!userSession) {
      router.push('/auth/login')
    } else {
      setSession(userSession)
      fetchProfile(userSession.id)
      fetchUserStats(userSession.id)
    }
  }, [router])

  const fetchProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single()

    if (!error && data) {
      setProfile(data)
    }
    setLoading(false)
  }

  const fetchUserStats = async (userId: string) => {
    // Get orders count and revenue
    const { data: orders } = await supabase
      .from('orders')
      .select('total')
      .eq('staff_id', userId)

    const totalOrders = orders?.length || 0
    const totalRevenue = orders?.reduce((sum, o) => sum + o.total, 0) || 0

    // Get shifts worked (distinct shift dates where user had activity)
    const { data: activities } = await supabase
      .from('shift_activities')
      .select('shift_date')
      .eq('staff_id', userId)

    const uniqueShifts = new Set(activities?.map(a => a.shift_date))
    const shiftsWorked = uniqueShifts.size

    setStats({
      totalOrders,
      totalRevenue,
      shiftsWorked
    })
  }

  const handleLogout = () => {
    clearSession()
    router.push('/auth/login')
  }

  const getRoleBadge = (role: string) => {
    if (role === 'admin') {
      return <span className="bg-primary/10 text-primary px-3 py-1 rounded-full text-sm font-semibold">Administrator</span>
    }
    return <span className="bg-info/10 text-info px-3 py-1 rounded-full text-sm font-semibold">Staff</span>
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <span className="bg-success/10 text-success px-3 py-1 rounded-full text-sm font-semibold">Active</span>
      case 'pending':
        return <span className="bg-warning/10 text-warning px-3 py-1 rounded-full text-sm font-semibold">Pending</span>
      case 'declined':
        return <span className="bg-danger/10 text-danger px-3 py-1 rounded-full text-sm font-semibold">Declined</span>
      default:
        return <span className="bg-text-muted/10 text-text-muted px-3 py-1 rounded-full text-sm font-semibold">{status}</span>
    }
  }

  if (loading) return <div className="p-6">Loading...</div>

  if (!profile) return <div className="p-6">Profile not found</div>

  return (
    <div className="min-h-screen bg-bg-subtle">
      <div className="p-4">
        {/* Profile Header */}
        <div className="card mb-4 text-center bg-primary text-white border-none">
          <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3">
            <User size={40} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold">{profile.first_name} {profile.surname}</h1>
          <p className="text-white/80 text-sm">{profile.email}</p>
          <div className="flex justify-center gap-2 mt-3">
            {getRoleBadge(profile.role)}
            {getStatusBadge(profile.status)}
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="card text-center">
            <p className="text-text-secondary text-xs">Orders Taken</p>
            <p className="text-2xl font-bold text-primary">{stats.totalOrders}</p>
          </div>
          <div className="card text-center">
            <p className="text-text-secondary text-xs">Revenue Generated</p>
            <p className="text-2xl font-bold text-success">₦{stats.totalRevenue.toLocaleString()}</p>
          </div>
          <div className="card text-center">
            <p className="text-text-secondary text-xs">Shifts Worked</p>
            <p className="text-2xl font-bold text-info">{stats.shiftsWorked}</p>
          </div>
        </div>

        {/* Personal Information */}
        <div className="card mb-4">
          <h2 className="font-bold text-text-primary mb-3 flex items-center gap-2">
            <User size={18} />
            Personal Information
          </h2>
          <div className="space-y-3">
            <div className="flex justify-between items-center py-2 border-b border-border">
              <span className="text-text-secondary">Full Name</span>
              <span className="font-medium">{profile.first_name} {profile.surname}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-border">
              <span className="text-text-secondary flex items-center gap-2">
                <Mail size={14} />
                Email
              </span>
              <span>{profile.email}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-border">
              <span className="text-text-secondary flex items-center gap-2">
                <Phone size={14} />
                Phone
              </span>
              <span>{profile.phone}</span>
            </div>
            {profile.additional_phone && (
              <div className="flex justify-between items-center py-2 border-b border-border">
                <span className="text-text-secondary">Additional Phone</span>
                <span>{profile.additional_phone}</span>
              </div>
            )}
            <div className="flex justify-between items-center py-2 border-b border-border">
              <span className="text-text-secondary flex items-center gap-2">
                <GraduationCap size={14} />
                Student
              </span>
              <span>{profile.is_student ? 'Yes' : 'No'}</span>
            </div>
          </div>
        </div>

        {/* Location Information */}
        {(profile.state || profile.city || profile.address) && (
          <div className="card mb-4">
            <h2 className="font-bold text-text-primary mb-3 flex items-center gap-2">
              <MapPin size={18} />
              Location
            </h2>
            <div className="space-y-3">
              {profile.state && (
                <div className="flex justify-between items-center py-2 border-b border-border">
                  <span className="text-text-secondary">State</span>
                  <span>{profile.state}</span>
                </div>
              )}
              {profile.city && (
                <div className="flex justify-between items-center py-2 border-b border-border">
                  <span className="text-text-secondary">City</span>
                  <span>{profile.city}</span>
                </div>
              )}
              {profile.address && (
                <div className="flex justify-between items-center py-2 border-b border-border">
                  <span className="text-text-secondary">Address</span>
                  <span className="text-right">{profile.address}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Account Information */}
        <div className="card mb-4">
          <h2 className="font-bold text-text-primary mb-3 flex items-center gap-2">
            <Calendar size={18} />
            Account Information
          </h2>
          <div className="space-y-3">
            <div className="flex justify-between items-center py-2 border-b border-border">
              <span className="text-text-secondary">Member Since</span>
              <span>{new Date(profile.created_at).toLocaleDateString()}</span>
            </div>
            {profile.approved_at && (
              <div className="flex justify-between items-center py-2 border-b border-border">
                <span className="text-text-secondary">Approved On</span>
                <span>{new Date(profile.approved_at).toLocaleDateString()}</span>
              </div>
            )}
            <div className="flex justify-between items-center py-2">
              <span className="text-text-secondary flex items-center gap-2">
                <Shield size={14} />
                Role
              </span>
              <span className="capitalize">{profile.role}</span>
            </div>
          </div>
        </div>

        {/* Logout Button */}
        <button
          onClick={handleLogout}
          className="btn-secondary w-full flex items-center justify-center gap-2 text-danger border-danger/30 hover:bg-danger/10"
        >
          <LogOut size={18} />
          Sign Out
        </button>
      </div>
    </div>
  )
}