'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getSession } from '@/lib/auth'
import { Plus, Trash2, Receipt } from 'lucide-react'

type Expense = {
  id: string
  description: string
  amount: number
  payment_method: string
  created_at: string
}

export default function ExpensesPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState<any>(null)
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [activeShift, setActiveShift] = useState<any>(null)
  const [showModal, setShowModal] = useState(false)
  const [formData, setFormData] = useState({
    description: '',
    amount: '',
    payment_method: 'cash'
  })
  const [totalExpenses, setTotalExpenses] = useState(0)

  useEffect(() => {
    const userSession = getSession()
    if (!userSession) {
      router.push('/auth/login')
    } else {
      setSession(userSession)
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
      alert('No active shift. Please open a shift first.')
      router.push('/dashboard')
    } else {
      setActiveShift(data)
      fetchExpenses(data.shift_id)
    }
    setLoading(false)
  }

  const fetchExpenses = async (shiftId: string) => {
    const today = new Date().toISOString().split('T')[0]
    
    const { data, error } = await supabase
      .from('expenses')
      .select('*')
      .eq('shift_date', today)
      .eq('shift_id', shiftId)
      .order('created_at', { ascending: false })

    if (!error && data) {
      setExpenses(data)
      const total = data.reduce((sum, exp) => sum + exp.amount, 0)
      setTotalExpenses(total)
    }
  }

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const today = new Date().toISOString().split('T')[0]
    
    const { error } = await supabase
      .from('expenses')
      .insert({
        shift_date: today,
        shift_id: activeShift.shift_id,
        staff_id: session.id,
        description: formData.description,
        amount: parseFloat(formData.amount),
        payment_method: formData.payment_method
      })

    if (error) {
      alert('Error adding expense: ' + error.message)
    } else {
      // Log expense activity
      await supabase.from('shift_activities').insert({
        shift_date: today,
        shift_id: activeShift.shift_id,
        staff_id: session.id,
        staff_name: `${session.first_name} ${session.surname}`,
        staff_role: session.role,
        action_type: 'ADD_EXPENSE',
        action_details: {
          description: formData.description,
          amount: parseFloat(formData.amount),
          payment_method: formData.payment_method
        }
      });
      
      fetchExpenses(activeShift.shift_id)
      closeModal()
    }
  }

  const deleteExpense = async (id: string) => {
    if (confirm('Delete this expense?')) {
      const { error } = await supabase
        .from('expenses')
        .delete()
        .eq('id', id)

      if (error) {
        alert('Error deleting: ' + error.message)
      } else {
        fetchExpenses(activeShift.shift_id)
      }
    }
  }

  const closeModal = () => {
    setShowModal(false)
    setFormData({ description: '', amount: '', payment_method: 'cash' })
  }

  if (loading) return <div className="p-6">Loading...</div>

  return (
    <div className="min-h-screen bg-bg-subtle">
      <div className="p-4">
        <div className="card mb-4 bg-primary text-white border-none">
          <h2 className="font-bold text-lg">{activeShift?.shifts?.name} Shift</h2>
          <p className="text-sm opacity-90">{new Date().toLocaleDateString()}</p>
        </div>

        <div className="card mb-4 text-center">
          <Receipt className="mx-auto mb-2 text-text-secondary" size={32} />
          <p className="text-text-secondary text-sm">Total Expenses</p>
          <p className="text-3xl font-bold text-danger">₦{totalExpenses.toLocaleString()}</p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="btn-primary w-full mb-4 flex items-center justify-center gap-2"
        >
          <Plus size={18} />
          Add Expense
        </button>

        <div className="space-y-2">
          <h3 className="font-bold text-text-primary mb-3">Expense History</h3>
          
          {expenses.length === 0 ? (
            <div className="card text-center py-8">
              <p className="text-text-muted">No expenses logged this shift</p>
            </div>
          ) : (
            expenses.map((expense) => (
              <div key={expense.id} className="card">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <p className="font-semibold text-text-primary">{expense.description}</p>
                    <div className="flex gap-3 mt-1">
                      <span className="text-xs text-text-muted">
                        {expense.payment_method === 'cash' ? '💰 Cash' : '📱 Transfer'}
                      </span>
                      <span className="text-xs text-text-muted">
                        {new Date(expense.created_at).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-danger">₦{expense.amount.toLocaleString()}</p>
                    <button
                      onClick={() => deleteExpense(expense.id)}
                      className="text-text-muted hover:text-danger mt-1"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-md">
            <h2 className="text-xl font-bold text-text-primary mb-4">Add Expense</h2>
            <form onSubmit={handleAddExpense} className="space-y-4">
              <div>
                <label className="block text-text-primary font-medium mb-1">Description</label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="input-base"
                  placeholder="e.g., Market purchase, Transport, Gas"
                  required
                />
              </div>
              
              <div>
                <label className="block text-text-primary font-medium mb-1">Amount (₦)</label>
                <input
                  type="number"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  className="input-base"
                  placeholder="0.00"
                  required
                />
              </div>
              
              <div>
                <label className="block text-text-primary font-medium mb-1">Payment Method</label>
                <select
                  value={formData.payment_method}
                  onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
                  className="input-base"
                >
                  <option value="cash">Cash</option>
                  <option value="transfer">Transfer</option>
                </select>
              </div>
              
              <div className="flex gap-3 pt-2">
                <button type="submit" className="btn-primary flex-1">
                  Add Expense
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