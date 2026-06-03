'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getSession } from '@/lib/auth'
import { useToast } from '@/lib/toast'
import { Check, X, Eye, UserCheck, UserX, Users } from 'lucide-react'

type StaffMember = {
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
  declined_at: string | null
}

// Staff Management Skeleton Component
function StaffManagementSkeleton() {
  return (
    <div className="min-h-screen bg-bg-subtle">
      <div className="p-4 sm:p-6">
        {/* Header skeleton */}
        <div className="flex justify-between items-center mb-6">
          <div className="skeleton h-8 w-48 rounded" />
          <div className="skeleton h-6 w-24 rounded-full" />
        </div>

        {/* Filter tabs skeleton */}
        <div className="flex gap-1 mb-6 border-b border-border">
          {['all', 'pending', 'active', 'declined'].map((tab, i) => (
            <div key={i} className="skeleton h-10 w-20 rounded-t-lg" />
          ))}
        </div>

        {/* Staff list skeleton */}
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="card">
              <div className="flex justify-between items-start">
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="skeleton h-5 w-32 rounded" />
                    <div className="skeleton h-5 w-16 rounded-full" />
                    <div className="skeleton h-5 w-12 rounded-full" />
                  </div>
                  <div className="skeleton h-4 w-48 rounded" />
                  <div className="skeleton h-4 w-32 rounded" />
                  <div className="skeleton h-3 w-24 rounded mt-1" />
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <div className="skeleton w-9 h-9 rounded-full" />
                  <div className="skeleton w-9 h-9 rounded-full" />
                  <div className="skeleton w-9 h-9 rounded-full" />
                  <div className="skeleton w-9 h-9 rounded-full" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function StaffManagement() {
  const router = useRouter()
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState<any>(null)
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null)
  const [archiveConfirm, setArchiveConfirm] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'pending' | 'active' | 'declined'>('pending')

  useEffect(() => {
    const userSession = getSession()
    if (!userSession) {
      router.push('/auth/login')
    } else if (userSession.role !== 'admin') {
      router.push('/dashboard')
    } else {
      setSession(userSession)
      fetchStaff()
    }
  }, [router])

  const fetchStaff = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false })

    if (!error && data) setStaff(data)
    setLoading(false)
  }

  const approveStaff = async (staffId: string) => {
    const { error } = await supabase
      .from('users')
      .update({ status: 'active', approved_at: new Date().toISOString() })
      .eq('id', staffId)

    if (error) {
      toast('Error approving staff: ' + error.message, 'error')
    } else {
      toast('Staff approved successfully', 'success')
      fetchStaff()
      setSelectedStaff(null)
    }
  }

  const declineStaff = async (staffId: string) => {
    const { error } = await supabase
      .from('users')
      .update({ status: 'declined', declined_at: new Date().toISOString() })
      .eq('id', staffId)

    if (error) {
      toast('Error declining staff: ' + error.message, 'error')
    } else {
      toast('Staff declined', 'info')
      fetchStaff()
      setSelectedStaff(null)
    }
  }

  const promoteToAdmin = async (staffId: string, currentRole: string) => {
    const newRole = currentRole === 'admin' ? 'staff' : 'admin'
    const { error } = await supabase
      .from('users')
      .update({ role: newRole })
      .eq('id', staffId)

    if (error) {
      toast('Error updating role: ' + error.message, 'error')
    } else {
      toast(`Role updated to ${newRole}`, 'success')
      fetchStaff()
    }
  }

  const archiveStaff = async (staffId: string) => {
    const { error } = await supabase
      .from('users')
      .update({ status: 'archived' })
      .eq('id', staffId)

    if (error) {
      toast('Error archiving staff: ' + error.message, 'error')
    } else {
      toast('Staff archived', 'info')
      fetchStaff()
    }
    setArchiveConfirm(null)
  }

  const getFilteredStaff = () =>
    filter === 'all' ? staff : staff.filter(m => m.status === filter)

  const getPendingCount = () => staff.filter(m => m.status === 'pending').length

  const getStatusBadge = (status: string) => {
    const map: Record<string, string> = {
      pending:  'bg-[#E65100]/10 text-[#E65100]',
      active:   'bg-[#2E7D32]/10 text-[#2E7D32]',
      declined: 'bg-danger/10 text-danger',
      archived: 'bg-border text-text-muted',
    }
    return (
      <span className={`${map[status] || 'bg-border'} px-2 py-1 rounded-full t-small font-medium capitalize`}>
        {status}
      </span>
    )
  }

  // Show skeleton while loading
  if (loading) {
    return <StaffManagementSkeleton />
  }

  return (
    <div className="min-h-screen bg-bg-subtle">
      <div className="p-4 sm:p-6">

        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="t-h1 text-text-primary">Staff Management</h1>
          {getPendingCount() > 0 && (
            <span className="bg-primary text-white px-3 py-1 rounded-full t-small font-medium">
              {getPendingCount()} Pending
            </span>
          )}
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1 mb-6 border-b border-border overflow-x-auto scrollbar-none">
          <div className="flex min-w-max">
            {(['all', 'pending', 'active', 'declined'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setFilter(tab)}
                className={`px-4 py-2 t-label capitalize transition-colors ${
                  filter === tab
                    ? 'text-primary border-b-2 border-primary'
                    : 'text-text-secondary'
                }`}
              >
                {tab}{tab === 'pending' && getPendingCount() > 0 ? ` (${getPendingCount()})` : ''}
              </button>
            ))}
          </div>
        </div>

        {/* Staff list */}
        <div className="space-y-3">
          {getFilteredStaff().length === 0 ? (
            <div className="card text-center py-10">
              <Users size={32} className="mx-auto text-text-muted mb-2" />
              <p className="t-body text-text-muted">No staff members found</p>
            </div>
          ) : (
            getFilteredStaff().map((member) => (
              <div key={member.id} className="card">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <p className="t-body text-text-primary font-medium">
                        {member.first_name} {member.surname}
                      </p>
                      {getStatusBadge(member.status)}
                      {member.role === 'admin' && (
                        <span className="bg-primary/10 text-primary px-2 py-1 rounded-full t-small">Admin</span>
                      )}
                    </div>
                    <p className="t-small text-text-secondary">{member.email}</p>
                    <p className="t-small text-text-secondary">{member.phone}</p>
                    <p className="t-small text-text-muted mt-1">
                      Joined {new Date(member.created_at).toLocaleDateString('en-NG')}
                    </p>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={() => setSelectedStaff(member)}
                      className="btn-secondary p-2 min-h-0 min-w-0 w-9 h-9"
                    >
                      <Eye size={16} />
                    </button>
                    {member.status === 'pending' && (
                      <>
                        <button
                          onClick={() => approveStaff(member.id)}
                          className="bg-[#2E7D32]/10 text-[#2E7D32] p-2 rounded-[10px] w-9 h-9 min-h-0 min-w-0 flex items-center justify-center"
                        >
                          <Check size={16} />
                        </button>
                        <button
                          onClick={() => declineStaff(member.id)}
                          className="bg-danger/10 text-danger p-2 rounded-[10px] w-9 h-9 min-h-0 min-w-0 flex items-center justify-center"
                        >
                          <X size={16} />
                        </button>
                      </>
                    )}
                    {member.status === 'active' && member.role !== 'admin' && (
                      <button
                        onClick={() => promoteToAdmin(member.id, member.role)}
                        className="bg-[#1565C0]/10 text-[#1565C0] p-2 rounded-[10px] w-9 h-9 min-h-0 min-w-0 flex items-center justify-center"
                      >
                        <UserCheck size={16} />
                      </button>
                    )}
                    {member.status === 'active' && member.role === 'admin' && session?.id !== member.id && (
                      <button
                        onClick={() => promoteToAdmin(member.id, member.role)}
                        className="bg-[#E65100]/10 text-[#E65100] p-2 rounded-[10px] w-9 h-9 min-h-0 min-w-0 flex items-center justify-center"
                      >
                        <UserX size={16} />
                      </button>
                    )}
                    {member.status === 'active' && (
                      <button
                        onClick={() => setArchiveConfirm(member.id)}
                        className="bg-border text-text-muted p-2 rounded-[10px] w-9 h-9 min-h-0 min-w-0 flex items-center justify-center"
                      >
                        <Users size={16} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Staff details modal */}
      {selectedStaff && (
        <div className="fixed inset-0 bg-black/40 flex items-end justify-center z-50">
          <div className="bg-white w-full max-w-md rounded-t-[20px] max-h-[85vh] flex flex-col">
            <div className="px-5 pt-5 pb-4 border-b border-border flex-shrink-0">
              <div className="w-10 h-1 rounded-full bg-border mx-auto mb-4" />
              <div className="flex justify-between items-center">
                <p className="t-h2 text-text-primary">Staff Details</p>
                <button onClick={() => setSelectedStaff(null)} className="text-text-muted min-h-0 min-w-0 w-8 h-8 flex items-center justify-center">✕</button>
              </div>
            </div>
            <div className="overflow-y-auto flex-1 px-5 py-4 space-y-3">
              {[
                ['Full Name', `${selectedStaff.first_name} ${selectedStaff.surname}`],
                ['Email', selectedStaff.email],
                ['Phone', selectedStaff.phone],
                selectedStaff.additional_phone ? ['Additional Phone', selectedStaff.additional_phone] : null,
                ['Role', selectedStaff.role],
                ['Student', selectedStaff.is_student ? 'Yes' : 'No'],
                selectedStaff.state ? ['State', selectedStaff.state] : null,
                selectedStaff.city ? ['City', selectedStaff.city] : null,
                selectedStaff.address ? ['Address', selectedStaff.address] : null,
                ['Joined', new Date(selectedStaff.created_at).toLocaleString('en-NG')],
                selectedStaff.approved_at ? ['Approved At', new Date(selectedStaff.approved_at).toLocaleString('en-NG')] : null,
                selectedStaff.declined_at ? ['Declined At', new Date(selectedStaff.declined_at).toLocaleString('en-NG')] : null,
              ].filter(Boolean).map(([label, value]: any) => (
                <div key={label}>
                  <p className="t-small text-text-muted">{label}</p>
                  <p className="t-body text-text-primary">{value}</p>
                </div>
              ))}
              <div className="pt-1">
                <p className="t-small text-text-muted mb-1">Status</p>
                {getStatusBadge(selectedStaff.status)}
              </div>
            </div>
            <div className="px-5 py-4 border-t border-border flex gap-3 flex-shrink-0">
              {selectedStaff.status === 'pending' && (
                <>
                  <button onClick={() => approveStaff(selectedStaff.id)} className="btn-primary flex-1">Approve</button>
                  <button onClick={() => declineStaff(selectedStaff.id)} className="btn-secondary flex-1">Decline</button>
                </>
              )}
              <button onClick={() => setSelectedStaff(null)} className="btn-secondary flex-1">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Archive confirm modal */}
      {archiveConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-end justify-center z-50">
          <div className="bg-white w-full max-w-md rounded-t-[20px] p-5">
            <div className="w-10 h-1 rounded-full bg-border mx-auto mb-5" />
            <p className="t-h2 text-text-primary">Archive this staff member?</p>
            <p className="t-body text-text-secondary mt-2">They will no longer be able to access the system.</p>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setArchiveConfirm(null)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={() => archiveStaff(archiveConfirm)} className="btn-primary flex-1">Archive</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}