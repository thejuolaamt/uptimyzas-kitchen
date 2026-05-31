'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getSession } from '@/lib/auth'
import { useToast } from '@/lib/toast'
import { Plus, Edit, Trash2, X, UserPlus, UserMinus } from 'lucide-react'

type Shift = {
  id: string
  name: string
  start_time: string
  end_time: string
}

type StaffMember = {
  id: string
  first_name: string
  surname: string
  email: string
}

type StaffShift = {
  id: string
  staff_id: string
  shift_id: string
}

export default function ShiftManagement() {
  const router = useRouter()
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [shifts, setShifts] = useState<Shift[]>([])
  const [allStaff, setAllStaff] = useState<StaffMember[]>([])
  const [staffShifts, setStaffShifts] = useState<StaffShift[]>([])
  const [showShiftModal, setShowShiftModal] = useState(false)
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [editingShift, setEditingShift] = useState<Shift | null>(null)
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null)
  const [formData, setFormData] = useState({ name: '', start_time: '', end_time: '' })
  const [assigning, setAssigning] = useState(false)

  useEffect(() => {
    const session = getSession()
    if (!session) {
      router.push('/auth/login')
    } else if (session.role !== 'admin') {
      router.push('/dashboard')
    } else {
      fetchAll()
    }
  }, [router])

  const fetchAll = async () => {
    setLoading(true)
    const [shiftsRes, staffRes, staffShiftsRes] = await Promise.all([
      supabase.from('shifts').select('*').order('start_time', { ascending: true }),
      supabase.from('users').select('id, first_name, surname, email').eq('status', 'active').eq('role', 'staff').order('first_name'),
      supabase.from('staff_shifts').select('*'),
    ])
    if (shiftsRes.data) setShifts(shiftsRes.data)
    if (staffRes.data) setAllStaff(staffRes.data)
    if (staffShiftsRes.data) setStaffShifts(staffShiftsRes.data)
    setLoading(false)
  }

  const handleSubmitShift = async (e: React.FormEvent) => {
    e.preventDefault()
    const shiftData = {
      name: formData.name,
      start_time: formData.start_time,
      end_time: formData.end_time,
    }

    if (editingShift) {
      const { error } = await supabase.from('shifts').update(shiftData).eq('id', editingShift.id)
      if (error) { toast('Error updating shift: ' + error.message, 'error'); return }
      toast('Shift updated', 'success')
    } else {
      const { error } = await supabase.from('shifts').insert(shiftData)
      if (error) { toast('Error creating shift: ' + error.message, 'error'); return }
      toast('Shift created', 'success')
    }
    fetchAll()
    closeShiftModal()
  }

  const deleteShift = async (id: string) => {
    const { error } = await supabase.from('shifts').delete().eq('id', id)
    if (error) {
      toast('Error deleting shift: ' + error.message, 'error')
    } else {
      toast('Shift deleted', 'info')
      fetchAll()
    }
    setDeleteConfirm(null)
  }

  const openShiftModal = (shift?: Shift) => {
    if (shift) {
      setEditingShift(shift)
      setFormData({
        name: shift.name,
        start_time: shift.start_time.slice(0, 5),
        end_time: shift.end_time.slice(0, 5),
      })
    } else {
      setEditingShift(null)
      setFormData({ name: '', start_time: '', end_time: '' })
    }
    setShowShiftModal(true)
  }

  const closeShiftModal = () => {
    setShowShiftModal(false)
    setEditingShift(null)
    setFormData({ name: '', start_time: '', end_time: '' })
  }

  const openAssignModal = (shift: Shift) => {
    setSelectedShift(shift)
    setShowAssignModal(true)
  }

  const isAssigned = (staffId: string, shiftId: string) => {
    return staffShifts.some(ss => ss.staff_id === staffId && ss.shift_id === shiftId)
  }

  const toggleAssignment = async (staffId: string, shiftId: string) => {
    setAssigning(true)
    const existing = staffShifts.find(ss => ss.staff_id === staffId && ss.shift_id === shiftId)

    if (existing) {
      const { error } = await supabase.from('staff_shifts').delete().eq('id', existing.id)
      if (error) {
        toast('Error removing assignment: ' + error.message, 'error')
      } else {
        toast('Assignment removed', 'info')
        setStaffShifts(prev => prev.filter(ss => ss.id !== existing.id))
      }
    } else {
      const { data, error } = await supabase
        .from('staff_shifts')
        .insert({ staff_id: staffId, shift_id: shiftId })
        .select()
        .single()
      if (error) {
        toast('Error assigning staff: ' + error.message, 'error')
      } else {
        toast('Staff assigned', 'success')
        setStaffShifts(prev => [...prev, data])
      }
    }
    setAssigning(false)
  }

  const getAssignedStaff = (shiftId: string) => {
    return staffShifts
      .filter(ss => ss.shift_id === shiftId)
      .map(ss => allStaff.find(s => s.id === ss.staff_id))
      .filter(Boolean) as StaffMember[]
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
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="t-h1 text-text-primary">Shift Management</h1>
          <button
            onClick={() => openShiftModal()}
            className="btn-primary flex items-center gap-2"
          >
            <Plus size={16} /> Add Shift
          </button>
        </div>

        {/* Shifts list */}
        <div className="space-y-4">
          {shifts.length === 0 ? (
            <div className="card text-center py-10">
              <p className="t-body text-text-muted">No shifts yet. Click "Add Shift" to create one.</p>
            </div>
          ) : (
            shifts.map((shift) => {
              const assigned = getAssignedStaff(shift.id)
              return (
                <div key={shift.id} className="card">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <p className="t-h2 text-text-primary">{shift.name}</p>
                      <p className="t-mono text-text-secondary mt-0.5">
                        {shift.start_time.slice(0, 5)} — {shift.end_time.slice(0, 5)}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => openAssignModal(shift)}
                        className="bg-[#1565C0]/10 text-[#1565C0] p-2 rounded-[8px] min-h-0 min-w-0 w-9 h-9 flex items-center justify-center"
                      >
                        <UserPlus size={16} />
                      </button>
                      <button
                        onClick={() => openShiftModal(shift)}
                        className="bg-bg-subtle text-text-secondary p-2 rounded-[8px] min-h-0 min-w-0 w-9 h-9 flex items-center justify-center"
                      >
                        <Edit size={16} />
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(shift.id)}
                        className="bg-danger/10 text-danger p-2 rounded-[8px] min-h-0 min-w-0 w-9 h-9 flex items-center justify-center"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  {/* Assigned staff chips */}
                  <div>
                    <p className="t-small text-text-muted mb-2">
                      {assigned.length === 0 ? 'No staff assigned' : `${assigned.length} staff assigned`}
                    </p>
                    {assigned.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {assigned.map(staff => (
                          <span
                            key={staff.id}
                            className="bg-primary/10 text-primary t-small px-3 py-1 rounded-full"
                          >
                            {staff.first_name} {staff.surname}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Add/Edit shift modal */}
      {showShiftModal && (
        <div className="fixed inset-0 bg-black/40 flex items-end justify-center z-50">
          <div className="bg-white w-full max-w-md rounded-t-[20px] p-5">
            <div className="w-10 h-1 rounded-full bg-border mx-auto mb-5" />
            <div className="flex justify-between items-center mb-4">
              <p className="t-h2 text-text-primary">
                {editingShift ? 'Edit Shift' : 'Add New Shift'}
              </p>
              <button
                onClick={closeShiftModal}
                className="text-text-muted min-h-0 min-w-0 w-8 h-8 flex items-center justify-center"
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSubmitShift} className="space-y-4">
              <div>
                <label className="block t-label text-text-primary mb-1">Shift Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="input-base"
                  placeholder="e.g., Morning, Afternoon, Night"
                  required
                />
              </div>
              <div>
                <label className="block t-label text-text-primary mb-1">Start Time *</label>
                <input
                  type="time"
                  value={formData.start_time}
                  onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                  className="input-base"
                  required
                />
              </div>
              <div>
                <label className="block t-label text-text-primary mb-1">End Time *</label>
                <input
                  type="time"
                  value={formData.end_time}
                  onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                  className="input-base"
                  required
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={closeShiftModal} className="btn-secondary flex-1">
                  Cancel
                </button>
                <button type="submit" className="btn-primary flex-1">
                  {editingShift ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assign staff modal */}
      {showAssignModal && selectedShift && (
        <div className="fixed inset-0 bg-black/40 flex items-end justify-center z-50">
          <div className="bg-white w-full max-w-md rounded-t-[20px] max-h-[80vh] flex flex-col">
            <div className="px-5 pt-5 pb-4 border-b border-border flex-shrink-0">
              <div className="w-10 h-1 rounded-full bg-border mx-auto mb-4" />
              <div className="flex justify-between items-center">
                <div>
                  <p className="t-h2 text-text-primary">Assign Staff</p>
                  <p className="t-small text-text-secondary mt-0.5">
                    {selectedShift.name} · {selectedShift.start_time.slice(0, 5)} — {selectedShift.end_time.slice(0, 5)}
                  </p>
                </div>
                <button
                  onClick={() => setShowAssignModal(false)}
                  className="text-text-muted min-h-0 min-w-0 w-8 h-8 flex items-center justify-center"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="overflow-y-auto flex-1 px-5 py-4 space-y-2">
              {allStaff.length === 0 ? (
                <p className="t-body text-text-muted text-center py-8">
                  No active staff members found
                </p>
              ) : (
                allStaff.map(staff => {
                  const assigned = isAssigned(staff.id, selectedShift.id)
                  return (
                    <div
                      key={staff.id}
                      className="flex justify-between items-center py-3 border-b border-border"
                    >
                      <div>
                        <p className="t-body text-text-primary font-medium">
                          {staff.first_name} {staff.surname}
                        </p>
                        <p className="t-small text-text-muted">{staff.email}</p>
                      </div>
                      <button
                        onClick={() => toggleAssignment(staff.id, selectedShift.id)}
                        disabled={assigning}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-full t-small font-medium transition-colors min-h-0 ${
                          assigned
                            ? 'bg-danger/10 text-danger'
                            : 'bg-[#2E7D32]/10 text-[#2E7D32]'
                        }`}
                      >
                        {assigned ? (
                          <><UserMinus size={14} /> Remove</>
                        ) : (
                          <><UserPlus size={14} /> Assign</>
                        )}
                      </button>
                    </div>
                  )
                })
              )}
            </div>

            <div className="px-5 py-4 border-t border-border flex-shrink-0">
              <button
                onClick={() => setShowAssignModal(false)}
                className="btn-primary w-full"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-end justify-center z-50">
          <div className="bg-white w-full max-w-md rounded-t-[20px] p-5">
            <div className="w-10 h-1 rounded-full bg-border mx-auto mb-5" />
            <p className="t-h2 text-text-primary">Delete this shift?</p>
            <p className="t-body text-text-secondary mt-2">
              This will also remove all staff assignments for this shift.
            </p>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setDeleteConfirm(null)} className="btn-secondary flex-1">
                Cancel
              </button>
              <button onClick={() => deleteShift(deleteConfirm)} className="btn-primary flex-1">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}