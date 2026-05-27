// app/admin/shifts/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getSession } from '@/lib/auth'
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
  const [loading, setLoading] = useState(true)
  const [shifts, setShifts] = useState<Shift[]>([])
  const [showModal, setShowModal] = useState(false)
  const [editingShift, setEditingShift] = useState<Shift | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    start_time: '',
    end_time: '',
  })

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
    
    if (!error && data) {
      setShifts(data)
    }
    setLoading(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const shiftData = {
      name: formData.name,
      start_time: formData.start_time,
      end_time: formData.end_time,
    }

    if (editingShift) {
      const { error } = await supabase
        .from('shifts')
        .update(shiftData)
        .eq('id', editingShift.id)
      
      if (error) {
        alert('Error updating: ' + error.message)
        return
      }
    } else {
      const { error } = await supabase
        .from('shifts')
        .insert(shiftData)
      
      if (error) {
        alert('Error creating: ' + error.message)
        return
      }
    }
    
    fetchShifts()
    closeModal()
  }

  const deleteShift = async (id: string) => {
    if (confirm('Are you sure you want to delete this shift?')) {
      const { error } = await supabase
        .from('shifts')
        .delete()
        .eq('id', id)
      
      if (error) {
        alert('Error deleting: ' + error.message)
      } else {
        fetchShifts()
      }
    }
  }

  const openModal = (shift?: Shift) => {
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
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditingShift(null)
    setFormData({ name: '', start_time: '', end_time: '' })
  }

  if (loading) return <div className="p-6">Loading...</div>

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-text-primary">Shift Management</h1>
        <button onClick={() => openModal()} className="btn-primary flex items-center gap-2">
          <Plus size={18} />
          Add Shift
        </button>
      </div>

      <div className="bg-bg-card rounded-default border border-border overflow-hidden">
        <table className="w-full">
          <thead className="bg-bg-subtle border-b border-border">
            <tr>
              <th className="text-left p-3 text-text-secondary font-medium">Shift Name</th>
              <th className="text-left p-3 text-text-secondary font-medium">Start Time</th>
              <th className="text-left p-3 text-text-secondary font-medium">End Time</th>
              <th className="text-center p-3 text-text-secondary font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {shifts.length === 0 ? (
              <tr>
                <td colSpan={4} className="text-center p-8 text-text-muted">
                  No shifts yet. Click "Add Shift" to create one.
                </td>
              </tr>
            ) : (
              shifts.map((shift) => (
                <tr key={shift.id} className="border-b border-border hover:bg-bg-subtle">
                  <td className="p-3 text-text-primary font-semibold">{shift.name}</td>
                  <td className="p-3 text-text-secondary">{shift.start_time.slice(0, 5)}</td>
                  <td className="p-3 text-text-secondary">{shift.end_time.slice(0, 5)}</td>
                  <td className="p-3 text-center">
                    <div className="flex justify-center gap-2">
                      <button onClick={() => openModal(shift)} className="text-info hover:opacity-70">
                        <Edit size={18} />
                      </button>
                      <button onClick={() => deleteShift(shift.id)} className="text-danger hover:opacity-70">
                        <Trash2 size={18} />
                      </button>
                    </div>
                   </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="card w-full max-w-md mx-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-text-primary">
                {editingShift ? 'Edit Shift' : 'Add New Shift'}
              </h2>
              <button onClick={closeModal} className="text-text-muted hover:text-text-primary">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-text-primary font-medium mb-1">Shift Name *</label>
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
                <label className="block text-text-primary font-medium mb-1">Start Time *</label>
                <input
                  type="time"
                  value={formData.start_time}
                  onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                  className="input-base"
                  required
                />
              </div>
              <div>
                <label className="block text-text-primary font-medium mb-1">End Time *</label>
                <input
                  type="time"
                  value={formData.end_time}
                  onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                  className="input-base"
                  required
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" className="btn-primary flex-1">
                  {editingShift ? 'Update' : 'Create'}
                </button>
                <button type="button" onClick={closeModal} className="btn-secondary flex-1">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}