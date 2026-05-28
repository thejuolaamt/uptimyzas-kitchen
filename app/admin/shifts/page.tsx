'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getSession } from '@/lib/auth'
import { useToast } from '@/lib/toast'
import { Plus, Edit, Trash2, X } from 'lucide-react'

type Shift = {
  id: string
  name: string
  start_time: string
  end_time: string
  created_at: string
}

export default function ShiftManagement() {
  const router = useRouter()
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [shifts, setShifts] = useState<Shift[]>([])
  const [showModal, setShowModal] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [editingShift, setEditingShift] = useState<Shift | null>(null)
  const [formData, setFormData] = useState({ name: '', start_time: '', end_time: '' })

  useEffect(() => {
    const session = getSession()
    if (!session) {
      router.push('/auth/login')
    } else if (session.role !== 'admin') {
      router.push('/dashboard')
    } else {
      fetchShifts()
    }
  }, [router])

  const fetchShifts = async () => {
    const { data, error } = await supabase
      .from('shifts')
      .select('*')
      .order('start_time', { ascending: true })

    if (!error && data) setShifts(data)
    setLoading(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const shiftData = { name: formData.name, start_time: formData.start_time, end_time: formData.end_time }

    if (editingShift) {
      const { error } = await supabase.from('shifts').update(shiftData).eq('id', editingShift.id)
      if (error) { toast('Error updating shift: ' + error.message, 'error'); return }
      toast('Shift updated', 'success')
    } else {
      const { error } = await supabase.from('shifts').insert(shiftData)
      if (error) { toast('Error creating shift: ' + error.message, 'error'); return }
      toast('Shift created', 'success')
    }

    fetchShifts()
    closeModal()
  }

  const deleteShift = async (id: string) => {
    const { error } = await supabase.from('shifts').delete().eq('id', id)
    if (error) {
      toast('Error deleting shift: ' + error.message, 'error')
    } else {
      toast('Shift deleted', 'info')
      fetchShifts()
    }
    setDeleteConfirm(null)
  }

  const openModal = (shift?: Shift) => {
    if (shift) {
      setEditingShift(shift)
      setFormData({ name: shift.name, start_time: shift.start_time.slice(0, 5), end_time: shift.end_time.slice(0, 5) })
    } else {
      setEditingShift(null)
      setFormData({ name: '', start_time: '', end_time: '' })
    }
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditingShift(null)
    setFormData({ name: '', start_time: '', end_time: '' })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-bg-subtle flex items-center justify-center">
        <div className="w-7 h-7 border-[3px] border-border border-t-primary rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="t-h1 text-text-primary">Shift Management</h1>
        <button onClick={() => openModal()} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> Add Shift
        </button>
      </div>

      <div className="bg-white rounded-[10px] border border-border overflow-hidden">
        <table className="w-full">
          <thead className="bg-bg-subtle border-b border-border">
            <tr>
              {['Shift Name', 'Start Time', 'End Time', 'Actions'].map(h => (
                <th key={h} className={`p-3 t-label text-text-secondary ${h === 'Actions' ? 'text-center' : 'text-left'}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shifts.length === 0 ? (
              <tr>
                <td colSpan={4} className="text-center p-8 t-body text-text-muted">
                  No shifts yet. Click "Add Shift" to create one.
                </td>
              </tr>
            ) : (
              shifts.map((shift) => (
                <tr key={shift.id} className="border-b border-border hover:bg-bg-subtle">
                  <td className="p-3 t-body text-text-primary font-medium">{shift.name}</td>
                  <td className="p-3 t-mono text-text-secondary">{shift.start_time.slice(0, 5)}</td>
                  <td className="p-3 t-mono text-text-secondary">{shift.end_time.slice(0, 5)}</td>
                  <td className="p-3 text-center">
                    <div className="flex justify-center gap-2">
                      <button onClick={() => openModal(shift)} className="text-[#1565C0] min-h-0 min-w-0 w-8 h-8 flex items-center justify-center">
                        <Edit size={16} />
                      </button>
                      <button onClick={() => setDeleteConfirm(shift.id)} className="text-danger min-h-0 min-w-0 w-8 h-8 flex items-center justify-center">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add/Edit modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-end justify-center z-50">
          <div className="bg-white w-full max-w-md rounded-t-[20px] p-5">
            <div className="w-10 h-1 rounded-full bg-border mx-auto mb-5" />
            <div className="flex justify-between items-center mb-4">
              <p className="t-h2 text-text-primary">{editingShift ? 'Edit Shift' : 'Add New Shift'}</p>
              <button onClick={closeModal} className="text-text-muted min-h-0 min-w-0 w-8 h-8 flex items-center justify-center"><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
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
                <button type="button" onClick={closeModal} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" className="btn-primary flex-1">{editingShift ? 'Update' : 'Create'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirm modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-end justify-center z-50">
          <div className="bg-white w-full max-w-md rounded-t-[20px] p-5">
            <div className="w-10 h-1 rounded-full bg-border mx-auto mb-5" />
            <p className="t-h2 text-text-primary">Delete this shift?</p>
            <p className="t-body text-text-secondary mt-2">This cannot be undone.</p>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setDeleteConfirm(null)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={() => deleteShift(deleteConfirm)} className="btn-primary flex-1">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}