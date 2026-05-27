// app/admin/menu/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getSession } from '@/lib/auth'
import { Plus, Edit, Trash2, Check, X } from 'lucide-react'

type MenuItem = {
  id: string
  name: string
  category: string
  price: number
  unit: string
  available: boolean
}

export default function MenuManagement() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<MenuItem[]>([])
  const [showModal, setShowModal] = useState(false)
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    price: '',
    unit: '',
  })

  useEffect(() => {
    const session = getSession()
    if (!session) {
      router.push('/auth/login')
    } else if (session.role !== 'admin') {
      router.push('/dashboard')
    } else {
      fetchMenuItems()
    }
  }, [router])

  const fetchMenuItems = async () => {
    const { data, error } = await supabase
      .from('menu_items')
      .select('*')
      .order('category', { ascending: true })
    
    if (!error && data) {
      setItems(data)
    }
    setLoading(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const itemData = {
      name: formData.name,
      category: formData.category,
      price: parseFloat(formData.price),
      unit: formData.unit,
      available: true,
    }

    if (editingItem) {
      const { error } = await supabase
        .from('menu_items')
        .update(itemData)
        .eq('id', editingItem.id)
      
      if (error) {
        alert('Error updating: ' + error.message)
        return
      }
    } else {
      const { error } = await supabase
        .from('menu_items')
        .insert(itemData)
      
      if (error) {
        alert('Error creating: ' + error.message)
        return
      }
    }
    
    fetchMenuItems()
    closeModal()
  }

  const toggleAvailability = async (item: MenuItem) => {
    const { error } = await supabase
      .from('menu_items')
      .update({ available: !item.available })
      .eq('id', item.id)
    
    if (!error) {
      fetchMenuItems()
    }
  }

  const deleteItem = async (id: string) => {
    if (confirm('Are you sure you want to delete this item?')) {
      const { error } = await supabase
        .from('menu_items')
        .delete()
        .eq('id', id)
      
      if (error) {
        alert('Error deleting: ' + error.message)
      } else {
        fetchMenuItems()
      }
    }
  }

  const openModal = (item?: MenuItem) => {
    if (item) {
      setEditingItem(item)
      setFormData({
        name: item.name,
        category: item.category,
        price: item.price.toString(),
        unit: item.unit,
      })
    } else {
      setEditingItem(null)
      setFormData({ name: '', category: '', price: '', unit: '' })
    }
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditingItem(null)
    setFormData({ name: '', category: '', price: '', unit: '' })
  }

  if (loading) return <div className="p-6">Loading...</div>

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-text-primary">Menu Management</h1>
        <button onClick={() => openModal()} className="btn-primary flex items-center gap-2">
          <Plus size={18} />
          Add Item
        </button>
      </div>

      <div className="bg-bg-card rounded-default border border-border overflow-hidden">
        <table className="w-full">
          <thead className="bg-bg-subtle border-b border-border">
            <tr>
              <th className="text-left p-3 text-text-secondary font-medium">Name</th>
              <th className="text-left p-3 text-text-secondary font-medium">Category</th>
              <th className="text-left p-3 text-text-secondary font-medium">Unit</th>
              <th className="text-right p-3 text-text-secondary font-medium">Price (₦)</th>
              <th className="text-center p-3 text-text-secondary font-medium">Status</th>
              <th className="text-center p-3 text-text-secondary font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center p-8 text-text-muted">
                  No menu items yet. Click "Add Item" to create one.
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.id} className="border-b border-border hover:bg-bg-subtle">
                  <td className="p-3 text-text-primary">{item.name}</td>
                  <td className="p-3 text-text-secondary">{item.category}</td>
                  <td className="p-3 text-text-secondary">{item.unit}</td>
                  <td className="p-3 text-right font-mono">₦{item.price.toLocaleString()}</td>
                  <td className="p-3 text-center">
                    <button
                      onClick={() => toggleAvailability(item)}
                      className={`px-2 py-1 rounded-sm text-xs font-semibold ${
                        item.available 
                          ? 'bg-success/10 text-success' 
                          : 'bg-danger/10 text-danger'
                      }`}
                    >
                      {item.available ? 'Available' : 'Unavailable'}
                    </button>
                  </td>
                  <td className="p-3 text-center">
                    <div className="flex justify-center gap-2">
                      <button onClick={() => openModal(item)} className="text-info hover:opacity-70">
                        <Edit size={18} />
                      </button>
                      <button onClick={() => deleteItem(item.id)} className="text-danger hover:opacity-70">
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
                {editingItem ? 'Edit Item' : 'Add New Item'}
              </h2>
              <button onClick={closeModal} className="text-text-muted hover:text-text-primary">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-text-primary font-medium mb-1">Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="input-base"
                  required
                />
              </div>
              <div>
                <label className="block text-text-primary font-medium mb-1">Category *</label>
                <input
                  type="text"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="input-base"
                  placeholder="e.g., Main, Soup, Swallow, Protein, Drinks"
                  required
                />
              </div>
              <div>
                <label className="block text-text-primary font-medium mb-1">Unit *</label>
                <input
                  type="text"
                  value={formData.unit}
                  onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                  className="input-base"
                  placeholder="e.g., plate, bowl, wrap, piece, bottle"
                  required
                />
              </div>
              <div>
                <label className="block text-text-primary font-medium mb-1">Price (₦) *</label>
                <input
                  type="number"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  className="input-base"
                  placeholder="0.00"
                  required
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" className="btn-primary flex-1">
                  {editingItem ? 'Update' : 'Create'}
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