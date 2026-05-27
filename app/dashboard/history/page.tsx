'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getSession } from '@/lib/auth'
import { Search, Calendar, User, CreditCard, FileText } from 'lucide-react'

type Order = {
  id: string
  items_json: any[]
  total: number
  payment_method: string
  cash_amount: number
  transfer_amount: number
  change_given: number
  created_at: string
  staff_id: string
  staff_name?: string
}

type Staff = {
  id: string
  first_name: string
  surname: string
}

export default function OrderHistoryPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [orders, setOrders] = useState<Order[]>([])
  const [staffList, setStaffList] = useState<Staff[]>([])
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  
  // Filters
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [selectedStaff, setSelectedStaff] = useState('')
  const [selectedPayment, setSelectedPayment] = useState('')
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    const userSession = getSession()
    if (!userSession) {
      router.push('/auth/login')
    } else {
      fetchStaffList()
      fetchOrders()
    }
  }, [router])

  const fetchStaffList = async () => {
    const { data, error } = await supabase
      .from('users')
      .select('id, first_name, surname')
      .eq('status', 'active')
      .order('first_name')

    if (!error && data) {
      setStaffList(data)
    }
  }

  const fetchOrders = async () => {
    setLoading(true)
    
    let query = supabase
      .from('orders')
      .select('*, users(first_name, surname)')
      .order('created_at', { ascending: false })

    // Apply filters
    if (startDate) {
      query = query.gte('created_at', `${startDate}T00:00:00`)
    }
    if (endDate) {
      query = query.lte('created_at', `${endDate}T23:59:59`)
    }
    if (selectedStaff) {
      query = query.eq('staff_id', selectedStaff)
    }
    if (selectedPayment) {
      query = query.eq('payment_method', selectedPayment)
    }

    const { data, error } = await query

    if (!error && data) {
      const ordersWithStaff = data.map(order => ({
        ...order,
        staff_name: order.users ? `${order.users.first_name} ${order.users.surname}` : 'Unknown'
      }))
      setOrders(ordersWithStaff)
    }
    setLoading(false)
  }

  const handleSearch = () => {
    fetchOrders()
  }

  const clearFilters = () => {
    setStartDate('')
    setEndDate('')
    setSelectedStaff('')
    setSelectedPayment('')
    setSearchTerm('')
    fetchOrders()
  }

  const getTotalOrders = () => orders.length
  const getTotalRevenue = () => orders.reduce((sum, order) => sum + order.total, 0)
  const getAverageOrderValue = () => getTotalRevenue() / getTotalOrders() || 0

  if (loading) return <div className="p-6">Loading...</div>

  return (
    <div className="min-h-screen bg-bg-subtle">
      <div className="p-4">
        <h1 className="text-xl font-bold text-text-primary mb-4">Order History</h1>

        {/* Stats Cards */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="card text-center">
            <p className="text-text-secondary text-xs">Total Orders</p>
            <p className="text-2xl font-bold text-primary">{getTotalOrders()}</p>
          </div>
          <div className="card text-center">
            <p className="text-text-secondary text-xs">Total Revenue</p>
            <p className="text-2xl font-bold text-success">₦{getTotalRevenue().toLocaleString()}</p>
          </div>
          <div className="card text-center">
            <p className="text-text-secondary text-xs">Average Order</p>
            <p className="text-2xl font-bold text-info">₦{getAverageOrderValue().toLocaleString()}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="card mb-4">
          <h3 className="font-bold text-text-primary mb-3">Filters</h3>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-text-secondary text-sm mb-1">Start Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="input-base"
                />
              </div>
              <div>
                <label className="block text-text-secondary text-sm mb-1">End Date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="input-base"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-text-secondary text-sm mb-1">Staff Member</label>
              <select
                value={selectedStaff}
                onChange={(e) => setSelectedStaff(e.target.value)}
                className="input-base"
              >
                <option value="">All Staff</option>
                {staffList.map(staff => (
                  <option key={staff.id} value={staff.id}>
                    {staff.first_name} {staff.surname}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-text-secondary text-sm mb-1">Payment Method</label>
              <select
                value={selectedPayment}
                onChange={(e) => setSelectedPayment(e.target.value)}
                className="input-base"
              >
                <option value="">All Methods</option>
                <option value="cash">Cash</option>
                <option value="transfer">Transfer</option>
                <option value="split">Split</option>
              </select>
            </div>

            <div className="flex gap-3">
              <button onClick={handleSearch} className="btn-primary flex-1 flex items-center justify-center gap-2">
                <Search size={18} />
                Search
              </button>
              <button onClick={clearFilters} className="btn-secondary flex-1">
                Clear
              </button>
            </div>
          </div>
        </div>

        {/* Orders List */}
        <div className="space-y-3">
          {orders.length === 0 ? (
            <div className="card text-center py-8">
              <p className="text-text-muted">No orders found</p>
            </div>
          ) : (
            orders.map((order) => (
              <div key={order.id} className="card cursor-pointer hover:shadow-md transition-shadow" onClick={() => setSelectedOrder(order)}>
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="font-mono text-xs text-text-muted">#{order.id.slice(-8)}</p>
                    <p className="font-bold text-text-primary">₦{order.total.toLocaleString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold capitalize">{order.payment_method}</p>
                    <p className="text-xs text-text-muted">{new Date(order.created_at).toLocaleString()}</p>
                  </div>
                </div>
                
                <div className="flex justify-between items-center text-sm">
                  <div className="flex items-center gap-2 text-text-secondary">
                    <User size={14} />
                    <span>{order.staff_name}</span>
                  </div>
                  <div className="text-text-secondary">
                    {order.items_json.length} item(s)
                  </div>
                </div>

                {order.payment_method === 'split' && (
                  <div className="mt-2 text-xs text-text-muted">
                    Cash: ₦{order.cash_amount?.toLocaleString()} | Transfer: ₦{order.transfer_amount?.toLocaleString()}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Order Details Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSelectedOrder(null)}>
          <div className="card w-full max-w-md max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-text-primary">Order Details</h2>
              <button onClick={() => setSelectedOrder(null)} className="text-text-muted">✕</button>
            </div>

            <div className="space-y-4">
              <div className="bg-bg-subtle p-3 rounded-default">
                <p className="font-mono text-sm">Order #{selectedOrder.id.slice(-8)}</p>
                <p className="text-text-secondary text-sm">{new Date(selectedOrder.created_at).toLocaleString()}</p>
                <p className="text-text-secondary text-sm">Staff: {selectedOrder.staff_name}</p>
              </div>

              <div>
                <h3 className="font-bold text-text-primary mb-2">Items</h3>
                <div className="space-y-2">
                  {selectedOrder.items_json.map((item, idx) => (
                    <div key={idx} className="flex justify-between text-sm">
                      <span>{item.qty}× {item.name}</span>
                      <span className="font-mono">₦{item.subtotal.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
                <div className="border-t border-border mt-2 pt-2 flex justify-between font-bold">
                  <span>Total</span>
                  <span>₦{selectedOrder.total.toLocaleString()}</span>
                </div>
              </div>

              <div>
                <h3 className="font-bold text-text-primary mb-2">Payment</h3>
                <div className="space-y-1 text-sm">
                  <p className="flex justify-between">
                    <span className="text-text-secondary">Method:</span>
                    <span className="capitalize font-semibold">{selectedOrder.payment_method}</span>
                  </p>
                  {selectedOrder.cash_amount > 0 && (
                    <p className="flex justify-between">
                      <span className="text-text-secondary">Cash:</span>
                      <span>₦{selectedOrder.cash_amount.toLocaleString()}</span>
                    </p>
                  )}
                  {selectedOrder.transfer_amount > 0 && (
                    <p className="flex justify-between">
                      <span className="text-text-secondary">Transfer:</span>
                      <span>₦{selectedOrder.transfer_amount.toLocaleString()}</span>
                    </p>
                  )}
                  {selectedOrder.change_given > 0 && (
                    <p className="flex justify-between text-success">
                      <span>Change Given:</span>
                      <span>₦{selectedOrder.change_given.toLocaleString()}</span>
                    </p>
                  )}
                </div>
              </div>

              <button onClick={() => setSelectedOrder(null)} className="btn-primary w-full">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}