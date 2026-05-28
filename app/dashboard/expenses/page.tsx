'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getSession } from '@/lib/auth'
import { useToast } from '@/lib/toast'
import { Plus, Trash2 } from 'lucide-react'

type Expense = {
  id: string
  description: string
  amount: number
  payment_method: string
  created_at: string
}

export default function ExpensesPage() {
  const router = useRouter()
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState<any>(null)
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [activeShift, setActiveShift] = useState<any>(null)
  const [showModal, setShowModal] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    description: '',
    amount: '',
    payment_method: 'cash'
  })

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
      toast('No active shift. Please open a shift first.', 'warning')
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

    if (!error && data) setExpenses(data)
  }

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
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
      toast('Error adding expense: ' + error.message, 'error')
    } else {
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
      })
      toast('Expense added', 'success')
      fetchExpenses(activeShift.shift_id)
      closeModal()
    }
    setSubmitting(false)
  }

  const handleDeleteExpense = async (id: string) => {
    const { error } = await supabase
      .from('expenses')
      .delete()
      .eq('id', id)

    if (error) {
      toast('Error deleting expense: ' + error.message, 'error')
    } else {
      toast('Expense deleted', 'info')
      fetchExpenses(activeShift.shift_id)
    }
    setShowDeleteConfirm(null)
  }

  const closeModal = () => {
    setShowModal(false)
    setFormData({ description: '', amount: '', payment_method: 'cash' })
  }

  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0)

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
        <div className="card border-l-4 border-l-primary">
          <p className="t-h2 text-text-primary">{activeShift?.shifts?.name} Shift</p>
          <p className="t-small text-text-secondary mt-1">
            {new Date().toLocaleDateString('en-NG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>

        {/* Total */}
        <div className="card text-center py-5">
          <p className="t-small text-text-secondary uppercase tracking-widest mb-1">Total Expenses</p>
          <p className="t-h1 text-danger">₦{totalExpenses.toLocaleString()}</p>
        </div>

        {/* Add button */}
        <button
          onClick={() => setShowModal(true)}
          className="btn-primary w-full flex items-center justify-center gap-2"
        >
          <Plus size={16} />
          Add Expense
        </button>

        {/* List */}
        <div>
          <p className="t-h3 text-text-primary mb-3">This Shift</p>
          {expenses.length === 0 ? (
            <div className="card text-center py-10">
              <p className="t-body text-text-muted">No expenses logged yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {expenses.map((expense) => (
                <div key={expense.id} className="card flex justify-between items-start">
                  <div className="flex-1">
                    <p className="t-body text-text-primary font-medium">{expense.description}</p>
                    <div className="flex gap-3 mt-1">
                      <span className="t-small text-text-muted">
                        {expense.payment_method === 'cash' ? 'Cash' : 'Transfer'}
                      </span>
                      <span className="t-small text-text-muted">
                        {new Date(expense.created_at).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                  <div className="text-right flex flex-col items-end gap-2">
                    <p className="t-body text-danger font-medium">₦{expense.amount.toLocaleString()}</p>
                    <button
                      onClick={() => setShowDeleteConfirm(expense.id)}
                      className="text-text-muted min-h-0 min-w-0 w-6 h-6 flex items-center justify-center"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Add expense modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40">
          <div className="bg-white w-full max-w-md rounded-t-[20px] p-5">
            <div className="w-10 h-1 rounded-full bg-border mx-auto mb-5" />
            <p className="t-h2 text-text-primary mb-4">Add Expense</p>
            <form onSubmit={handleAddExpense} className="space-y-4">
              <div>
                <label className="block t-label text-text-primary mb-1">Description</label>
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
                <label className="block t-label text-text-primary mb-1">Amount (₦)</label>
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
                <label className="block t-label text-text-primary mb-1">Payment Method</label>
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
                <button type="button" onClick={closeModal} className="btn-secondary flex-1">
                  Cancel
                </button>
                <button type="submit" disabled={submitting} className="btn-primary flex-1">
                  {submitting ? 'Saving...' : 'Add Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirm modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40">
          <div className="bg-white w-full max-w-md rounded-t-[20px] p-5">
            <div className="w-10 h-1 rounded-full bg-border mx-auto mb-5" />
            <p className="t-h2 text-text-primary">Delete this expense?</p>
            <p className="t-body text-text-secondary mt-2">This cannot be undone.</p>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="btn-secondary flex-1"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteExpense(showDeleteConfirm)}
                className="btn-primary flex-1"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}