'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getSession } from '@/lib/auth'
import { 
  TrendingUp, TrendingDown, DollarSign, ShoppingBag, Users, 
  Calendar, Package, AlertCircle 
} from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts'

type DashboardStats = {
  totalRevenue: number
  totalOrders: number
  totalExpenses: number
  totalProfit: number
  activeStaff: number
  pendingApprovals: number
  lowStockItems: number
  activeShift: any
  recentOrders: any[]
  revenueByDay: { date: string; revenue: number }[]
  revenueByPaymentMethod: { name: string; value: number }[]
  topSellingItems: { name: string; quantity: number }[]
}

const COLORS = ['#8B0000', '#2E7D32', '#1565C0', '#E65100']

export default function AdminOverview() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState<any>(null)
  const [stats, setStats] = useState<DashboardStats>({
    totalRevenue: 0,
    totalOrders: 0,
    totalExpenses: 0,
    totalProfit: 0,
    activeStaff: 0,
    pendingApprovals: 0,
    lowStockItems: 0,
    activeShift: null,
    recentOrders: [],
    revenueByDay: [],
    revenueByPaymentMethod: [],
    topSellingItems: []
  })

  useEffect(() => {
    const userSession = getSession()
    if (!userSession) {
      router.push('/auth/login')
    } else if (userSession.role !== 'admin') {
      router.push('/dashboard')
    } else {
      setSession(userSession)
      fetchDashboardData()
    }
  }, [router])

  const fetchDashboardData = async () => {
    setLoading(true)
    const today = new Date().toISOString().split('T')[0]
    const last7Days = getLast7Days()

    // Get orders with id field
    const { data: orders } = await supabase
      .from('orders')
      .select('id, total, payment_method, created_at, items_json')
      .order('created_at', { ascending: false })
      .limit(200)

    const totalRevenue = orders?.reduce((sum, o) => sum + o.total, 0) || 0

    // Get expenses
    const { data: expenses } = await supabase
      .from('expenses')
      .select('amount')

    const totalExpenses = expenses?.reduce((sum, e) => sum + e.amount, 0) || 0

    // Get staff stats
    const { data: staff } = await supabase
      .from('users')
      .select('status')
      .eq('role', 'staff')

    const activeStaff = staff?.filter(s => s.status === 'active').length || 0
    const pendingApprovals = staff?.filter(s => s.status === 'pending').length || 0

    // Get low stock items
    const { data: stock } = await supabase
      .from('shift_stock')
      .select('item_name, remaining_qty, opening_qty')
      .eq('shift_date', today)

    const lowStockItems = stock?.filter(s => (s.remaining_qty / s.opening_qty) * 100 < 20).length || 0

    // Check active shift
    const { data: activeShift } = await supabase
      .from('shift_sessions')
      .select('*, shifts(*)')
      .eq('shift_date', today)
      .eq('status', 'open')
      .single()

    // Revenue by day (last 7 days)
    const revenueByDay = last7Days.map(date => {
      const dayOrders = orders?.filter(o => o.created_at?.startsWith(date)) || []
      return {
        date: date.slice(5),
        revenue: dayOrders.reduce((sum, o) => sum + o.total, 0)
      }
    })

    // Revenue by payment method
    const cashRevenue = orders?.filter(o => o.payment_method === 'cash').reduce((sum, o) => sum + o.total, 0) || 0
    const transferRevenue = orders?.filter(o => o.payment_method === 'transfer').reduce((sum, o) => sum + o.total, 0) || 0
    const splitRevenue = orders?.filter(o => o.payment_method === 'split').reduce((sum, o) => sum + o.total, 0) || 0

    const revenueByPaymentMethod = [
      { name: 'Cash', value: cashRevenue },
      { name: 'Transfer', value: transferRevenue },
      { name: 'Split', value: splitRevenue },
    ].filter(m => m.value > 0)

    // Top selling items
    const itemSales: { [key: string]: number } = {}
    orders?.forEach(order => {
      if (order.items_json) {
        order.items_json.forEach((item: any) => {
          itemSales[item.name] = (itemSales[item.name] || 0) + item.qty
        })
      }
    })
    const topSellingItems = Object.entries(itemSales)
      .map(([name, quantity]) => ({ name, quantity }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5)

    // Recent orders - now with id
    const recentOrders = orders?.slice(0, 5).map(o => ({
      id: o.id?.slice(-8) || 'unknown',
      total: o.total,
      payment_method: o.payment_method,
      created_at: new Date(o.created_at).toLocaleTimeString()
    })) || []

    setStats({
      totalRevenue,
      totalOrders: orders?.length || 0,
      totalExpenses,
      totalProfit: totalRevenue - totalExpenses,
      activeStaff,
      pendingApprovals,
      lowStockItems,
      activeShift: activeShift?.shifts || null,
      recentOrders,
      revenueByDay,
      revenueByPaymentMethod,
      topSellingItems
    })

    setLoading(false)
  }

  const getLast7Days = () => {
    const dates = []
    for (let i = 6; i >= 0; i--) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      dates.push(date.toISOString().split('T')[0])
    }
    return dates
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
        <p className="text-text-secondary mt-4">Loading dashboard...</p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-bg-subtle p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text-primary">Business Overview</h1>
        <p className="text-text-secondary">Welcome back, {session?.first_name}</p>
      </div>

      {/* Active Shift Alert */}
      {stats.activeShift && (
        <div className="bg-success/10 border border-success rounded-default p-4 mb-6 flex items-center justify-between">
          <div>
            <p className="font-semibold text-success">✅ Active Shift</p>
            <p className="text-text-secondary text-sm">{stats.activeShift.name} shift is currently open</p>
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="card">
          <div className="flex items-center justify-between mb-2">
            <DollarSign size={24} className="text-success" />
            <TrendingUp size={16} className="text-text-muted" />
          </div>
          <p className="text-text-secondary text-sm">Total Revenue</p>
          <p className="text-2xl font-bold text-success">₦{stats.totalRevenue.toLocaleString()}</p>
        </div>
        
        <div className="card">
          <div className="flex items-center justify-between mb-2">
            <ShoppingBag size={24} className="text-primary" />
          </div>
          <p className="text-text-secondary text-sm">Total Orders</p>
          <p className="text-2xl font-bold text-primary">{stats.totalOrders}</p>
        </div>
        
        <div className="card">
          <div className="flex items-center justify-between mb-2">
            <TrendingDown size={24} className="text-danger" />
          </div>
          <p className="text-text-secondary text-sm">Total Expenses</p>
          <p className="text-2xl font-bold text-danger">₦{stats.totalExpenses.toLocaleString()}</p>
        </div>
        
        <div className="card">
          <div className="flex items-center justify-between mb-2">
            <DollarSign size={24} className="text-info" />
          </div>
          <p className="text-text-secondary text-sm">Net Profit</p>
          <p className={`text-2xl font-bold ${stats.totalProfit >= 0 ? 'text-success' : 'text-danger'}`}>
            ₦{stats.totalProfit.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Second Row KPIs */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="card text-center">
          <Users size={20} className="mx-auto mb-1 text-text-secondary" />
          <p className="text-2xl font-bold text-text-primary">{stats.activeStaff}</p>
          <p className="text-text-secondary text-xs">Active Staff</p>
        </div>
        <div className="card text-center">
          <AlertCircle size={20} className="mx-auto mb-1 text-warning" />
          <p className="text-2xl font-bold text-warning">{stats.pendingApprovals}</p>
          <p className="text-text-secondary text-xs">Pending Approvals</p>
        </div>
        <div className="card text-center">
          <Package size={20} className="mx-auto mb-1 text-danger" />
          <p className="text-2xl font-bold text-danger">{stats.lowStockItems}</p>
          <p className="text-text-secondary text-xs">Low Stock Items</p>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Revenue Trend */}
        <div className="card">
          <h3 className="font-bold text-text-primary mb-4">Revenue Trend (Last 7 Days)</h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={stats.revenueByDay}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" />
              <XAxis dataKey="date" stroke="#616161" />
              <YAxis stroke="#616161" />
              <Tooltip 
                formatter={(value) => [`₦${Number(value).toLocaleString()}`, 'Revenue']}
                contentStyle={{ backgroundColor: 'white', borderRadius: 8, border: '1px solid #E0E0E0' }}
              />
              <Line type="monotone" dataKey="revenue" stroke="#8B0000" strokeWidth={2} dot={{ fill: '#8B0000' }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Payment Methods */}
        <div className="card">
          <h3 className="font-bold text-text-primary mb-4">Revenue by Payment Method</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={stats.revenueByPaymentMethod}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {stats.revenueByPaymentMethod.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => `₦${Number(value).toLocaleString()}`} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top Selling Items & Recent Orders */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Selling Items */}
        <div className="card">
          <h3 className="font-bold text-text-primary mb-4">🏆 Top Selling Items</h3>
          <div className="space-y-3">
            {stats.topSellingItems.length === 0 ? (
              <p className="text-text-muted text-center py-4">No orders yet</p>
            ) : (
              stats.topSellingItems.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-xl font-bold text-text-muted w-6">#{idx + 1}</span>
                    <span className="font-medium text-text-primary">{item.name}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="w-32 bg-bg-subtle rounded-full h-2">
                      <div 
                        className="bg-primary h-2 rounded-full"
                        style={{ width: `${Math.min(100, (item.quantity / (stats.topSellingItems[0]?.quantity || 1)) * 100)}%` }}
                      />
                    </div>
                    <span className="font-mono text-text-secondary">{item.quantity} sold</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Orders */}
        <div className="card">
          <h3 className="font-bold text-text-primary mb-4">📋 Recent Orders</h3>
          <div className="space-y-2">
            {stats.recentOrders.length === 0 ? (
              <p className="text-text-muted text-center py-4">No orders yet</p>
            ) : (
              stats.recentOrders.map((order) => (
                <div key={order.id} className="flex justify-between items-center py-2 border-b border-border">
                  <div>
                    <p className="font-mono text-xs text-text-muted">#{order.id}</p>
                    <p className="text-text-secondary text-sm">{order.created_at}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-text-primary">₦{order.total.toLocaleString()}</p>
                    <p className="text-xs capitalize text-text-muted">{order.payment_method}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
        <button 
          onClick={() => router.push('/admin/staff')}
          className="card hover:shadow-md transition-all text-left"
        >
          <Users size={24} className="text-primary mb-2" />
          <p className="font-semibold text-text-primary">Staff Management</p>
          <p className="text-text-secondary text-xs">Approve pending accounts</p>
        </button>
        <button 
          onClick={() => router.push('/admin/menu')}
          className="card hover:shadow-md transition-all text-left"
        >
          <Package size={24} className="text-primary mb-2" />
          <p className="font-semibold text-text-primary">Menu Items</p>
          <p className="text-text-secondary text-xs">Add or edit items</p>
        </button>
        <button 
          onClick={() => router.push('/admin/reports')}
          className="card hover:shadow-md transition-all text-left"
        >
          <TrendingUp size={24} className="text-primary mb-2" />
          <p className="font-semibold text-text-primary">Reports</p>
          <p className="text-text-secondary text-xs">Export data</p>
        </button>
        <button 
          onClick={() => router.push('/admin/settings')}
          className="card hover:shadow-md transition-all text-left"
        >
          <Calendar size={24} className="text-primary mb-2" />
          <p className="font-semibold text-text-primary">Settings</p>
          <p className="text-text-secondary text-xs">Configure thresholds</p>
        </button>
      </div>
    </div>
  )
}