'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getSession } from '@/lib/auth'
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

export default function StaffManagement() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState<any>(null)
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null)
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
    
    let query = supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false })

    const { data, error } = await query

    if (!error && data) {
      setStaff(data)
    }
    setLoading(false)
  }

  const approveStaff = async (staffId: string) => {
    const { error } = await supabase
      .from('users')
      .update({
        status: 'active',
        approved_at: new Date().toISOString()
      })
      .eq('id', staffId)

    if (error) {
      alert('Error approving staff: ' + error.message)
    } else {
      fetchStaff()
      setSelectedStaff(null)
    }
  }

  const declineStaff = async (staffId: string) => {
    const { error } = await supabase
      .from('users')
      .update({
        status: 'declined',
        declined_at: new Date().toISOString()
      })
      .eq('id', staffId)

    if (error) {
      alert('Error declining staff: ' + error.message)
    } else {
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
      alert('Error updating role: ' + error.message)
    } else {
      fetchStaff()
    }
  }

  const archiveStaff = async (staffId: string) => {
    if (confirm('Archive this staff member? They will no longer be able to access the system.')) {
      const { error } = await supabase
        .from('users')
        .update({ status: 'archived' })
        .eq('id', staffId)

      if (error) {
        alert('Error archiving staff: ' + error.message)
      } else {
        fetchStaff()
      }
    }
  }

  const getFilteredStaff = () => {
    if (filter === 'all') return staff
    return staff.filter(member => member.status === filter)
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <span className="bg-warning/10 text-warning px-2 py-1 rounded-full text-xs font-semibold">Pending</span>
      case 'active':
        return <span className="bg-success/10 text-success px-2 py-1 rounded-full text-xs font-semibold">Active</span>
      case 'declined':
        return <span className="bg-danger/10 text-danger px-2 py-1 rounded-full text-xs font-semibold">Declined</span>
      case 'archived':
        return <span className="bg-text-muted/10 text-text-muted px-2 py-1 rounded-full text-xs font-semibold">Archived</span>
      default:
        return <span className="bg-border px-2 py-1 rounded-full text-xs">{status}</span>
    }
  }

  const getPendingCount = () => staff.filter(m => m.status === 'pending').length

  if (loading) return <div className="p-6">Loading...</div>

  return (
    <div className="min-h-screen bg-bg-subtle">
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-text-primary">Staff Management</h1>
          {getPendingCount() > 0 && (
            <div className="bg-primary text-white px-3 py-1 rounded-full text-sm font-semibold">
              {getPendingCount()} Pending
            </div>
          )}
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 mb-6 border-b border-border">
          {(['all', 'pending', 'active', 'declined'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`px-4 py-2 font-semibold capitalize transition-colors ${
                filter === tab
                  ? 'text-primary border-b-2 border-primary'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              {tab} {tab === 'pending' && getPendingCount() > 0 && `(${getPendingCount()})`}
            </button>
          ))}
        </div>

        {/* Staff List */}
        <div className="space-y-3">
          {getFilteredStaff().length === 0 ? (
            <div className="card text-center py-8">
              <Users size={48} className="mx-auto text-text-muted mb-2" />
              <p className="text-text-muted">No staff members found</p>
            </div>
          ) : (
            getFilteredStaff().map((member) => (
              <div key={member.id} className="card">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-text-primary">
                        {member.first_name} {member.surname}
                      </h3>
                      {getStatusBadge(member.status)}
                      {member.role === 'admin' && (
                        <span className="bg-primary/10 text-primary px-2 py-1 rounded-full text-xs font-semibold">Admin</span>
                      )}
                    </div>
                    <p className="text-text-secondary text-sm mt-1">{member.email}</p>
                    <p className="text-text-secondary text-sm">{member.phone}</p>
                    {member.is_student && (
                      <p className="text-xs text-info mt-1">Student</p>
                    )}
                    <p className="text-text-muted text-xs mt-2">
                      Joined: {new Date(member.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setSelectedStaff(member)}
                      className="btn-secondary p-2"
                      title="View Details"
                    >
                      <Eye size={18} />
                    </button>
                    {member.status === 'pending' && (
                      <>
                        <button
                          onClick={() => approveStaff(member.id)}
                          className="bg-success/10 text-success p-2 rounded-default hover:bg-success/20"
                          title="Approve"
                        >
                          <Check size={18} />
                        </button>
                        <button
                          onClick={() => declineStaff(member.id)}
                          className="bg-danger/10 text-danger p-2 rounded-default hover:bg-danger/20"
                          title="Decline"
                        >
                          <X size={18} />
                        </button>
                      </>
                    )}
                    {member.status === 'active' && member.role !== 'admin' && (
                      <button
                        onClick={() => promoteToAdmin(member.id, member.role)}
                        className="bg-info/10 text-info p-2 rounded-default hover:bg-info/20"
                        title="Promote to Admin"
                      >
                        <UserCheck size={18} />
                      </button>
                    )}
                    {member.status === 'active' && member.role === 'admin' && session?.id !== member.id && (
                      <button
                        onClick={() => promoteToAdmin(member.id, member.role)}
                        className="bg-warning/10 text-warning p-2 rounded-default hover:bg-warning/20"
                        title="Demote to Staff"
                      >
                        <UserX size={18} />
                      </button>
                    )}
                    {member.status === 'active' && (
                      <button
                        onClick={() => archiveStaff(member.id)}
                        className="bg-text-muted/10 text-text-muted p-2 rounded-default hover:bg-text-muted/20"
                        title="Archive"
                      >
                        <Users size={18} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Staff Details Modal */}
      {selectedStaff && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSelectedStaff(null)}>
          <div className="card w-full max-w-md max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-text-primary">Staff Details</h2>
              <button onClick={() => setSelectedStaff(null)} className="text-text-muted">✕</button>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-text-secondary text-sm">Full Name</p>
                <p className="font-semibold">{selectedStaff.first_name} {selectedStaff.surname}</p>
              </div>

              <div>
                <p className="text-text-secondary text-sm">Email</p>
                <p>{selectedStaff.email}</p>
              </div>

              <div>
                <p className="text-text-secondary text-sm">Phone</p>
                <p>{selectedStaff.phone}</p>
              </div>

              {selectedStaff.additional_phone && (
                <div>
                  <p className="text-text-secondary text-sm">Additional Phone</p>
                  <p>{selectedStaff.additional_phone}</p>
                </div>
              )}

              <div>
                <p className="text-text-secondary text-sm">Role</p>
                <p className="capitalize">{selectedStaff.role}</p>
              </div>

              <div>
                <p className="text-text-secondary text-sm">Status</p>
                {getStatusBadge(selectedStaff.status)}
              </div>

              <div>
                <p className="text-text-secondary text-sm">Student</p>
                <p>{selectedStaff.is_student ? 'Yes' : 'No'}</p>
              </div>

              {selectedStaff.state && (
                <div>
                  <p className="text-text-secondary text-sm">State</p>
                  <p>{selectedStaff.state}</p>
                </div>
              )}

              {selectedStaff.city && (
                <div>
                  <p className="text-text-secondary text-sm">City</p>
                  <p>{selectedStaff.city}</p>
                </div>
              )}

              {selectedStaff.address && (
                <div>
                  <p className="text-text-secondary text-sm">Address</p>
                  <p>{selectedStaff.address}</p>
                </div>
              )}

              <div>
                <p className="text-text-secondary text-sm">Joined</p>
                <p>{new Date(selectedStaff.created_at).toLocaleString()}</p>
              </div>

              {selectedStaff.approved_at && (
                <div>
                  <p className="text-text-secondary text-sm">Approved At</p>
                  <p>{new Date(selectedStaff.approved_at).toLocaleString()}</p>
                </div>
              )}

              {selectedStaff.declined_at && (
                <div>
                  <p className="text-text-secondary text-sm">Declined At</p>
                  <p>{new Date(selectedStaff.declined_at).toLocaleString()}</p>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                {selectedStaff.status === 'pending' && (
                  <>
                    <button onClick={() => approveStaff(selectedStaff.id)} className="btn-primary flex-1">
                      Approve
                    </button>
                    <button onClick={() => declineStaff(selectedStaff.id)} className="btn-secondary flex-1">
                      Decline
                    </button>
                  </>
                )}
                <button onClick={() => setSelectedStaff(null)} className="btn-secondary flex-1">
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}