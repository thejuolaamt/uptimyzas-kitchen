'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getSession } from '@/lib/auth'
import { TrendingUp, TrendingDown, DollarSign, ShoppingBag, Users, Package, AlertCircle, RefreshCw } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { useScrollContainer } from '@/lib/useScrollContainer'
import { useToast } from '@/lib/toast'

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

const getLast7Days = () => {
  const dates = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    dates.push(d.toISOString().split('T')[0])
  }
  return dates
}

export default function AdminOverview() {
  const router = useRouter()
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [session, setSession] = useState<any>(null)
  const [stats, setStats] = useState<DashboardStats>({
    totalRevenue: 0, totalOrders: 0, totalExpenses: 0, totalProfit: 0,
    activeStaff: 0, pendingApprovals: 0, lowStockItems: 0,
    activeShift: null, recentOrders: [], revenueByDay: [],
    revenueByPaymentMethod: [], topSellingItems: []
  })

  // Pull-to-refresh handler
  const handlePullToRefresh = async () => {
    setRefreshing(true)
    toast('Refreshing dashboard...', 'info')
    
    await fetchDashboardData()
    
    setRefreshing(false)
    toast('Dashboard refreshed!', 'success')
  }

  // Scroll container with pull-to-refresh
  const scrollRef = useScrollContainer({
    preventPullToRefresh: true,
    onPullToRefresh: handlePullToRefresh,
    pullThreshold: 80
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
    const sevenDaysAgo = last7Days[0]

    const { data: orders } = await supabase
      .from('orders')
      .select('id, total, payment_method, cash_amount, transfer_amount, created_at, items_json')
      .gte('created_at', `${sevenDaysAgo}T00:00:00`)
      .order('created_at', { ascending: false })

    const totalRevenue = orders?.reduce((s, o) => s + o.total, 0) || 0

    const { data: expenses } = await supabase
      .from('expenses')
      .select('amount')
      .gte('created_at', `${sevenDaysAgo}T00:00:00`)

    const totalExpenses = expenses?.reduce((s, e) => s + e.amount, 0) || 0

    const { data: staff } = await supabase
      .from('users')
      .select('status')
      .eq('role', 'staff')

    const activeStaff = staff?.filter(s => s.status === 'active').length || 0
    const pendingApprovals = staff?.filter(s => s.status === 'pending').length || 0

    const { data: stock } = await supabase
      .from('shift_stock')
      .select('remaining_qty, opening_qty')
      .eq('shift_date', today)

    const lowStockItems = stock?.filter(s => s.opening_qty > 0 && (s.remaining_qty / s.opening_qty) * 100 < 20).length || 0

    const { data: activeShift } = await supabase
      .from('shift_sessions')
      .select('*, shifts(*)')
      .eq('shift_date', today)
      .eq('status', 'open')
      .maybeSingle()

    const revenueByDay = last7Days.map(date => ({
      date: date.slice(5),
      revenue: (orders || []).filter(o => o.created_at?.startsWith(date)).reduce((s, o) => s + o.total, 0)
    }))

    const cashRev = orders?.filter(o => o.payment_method === 'cash').reduce((s, o) => s + o.total, 0) || 0
    const transferRev = orders?.filter(o => o.payment_method === 'transfer').reduce((s, o) => s + o.total, 0) || 0
    const splitRev = orders?.filter(o => o.payment_method === 'split').reduce((s, o) => s + o.total, 0) || 0
    const revenueByPaymentMethod = [
      { name: 'Cash', value: cashRev },
      { name: 'Transfer', value: transferRev },
      { name: 'Split', value: splitRev },
    ].filter(m => m.value > 0)

    const itemSales: Record<string, number> = {}
    orders?.forEach(order => {
      order.items_json?.forEach((item: any) => {
        itemSales[item.name] = (itemSales[item.name] || 0) + item.qty
      })
    })
    const topSellingItems = Object.entries(itemSales)
      .map(([name, quantity]) => ({ name, quantity }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5)

    const recentOrders = (orders || []).slice(0, 5).map(o => ({
      id: o.id?.slice(-8) || '—',
      total: o.total,
      payment_method: o.payment_method,
      created_at: new Date(o.created_at).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' })
    }))

    setStats({
      totalRevenue, totalOrders: orders?.length || 0,
      totalExpenses, totalProfit: totalRevenue - totalExpenses,
      activeStaff, pendingApprovals, lowStockItems,
      activeShift: activeShift?.shifts || null,
      recentOrders, revenueByDay, revenueByPaymentMethod, topSellingItems
    })
    setLoading(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-bg-subtle flex items-center justify-center">
        <div className="w-7 h-7 border-[3px] border-border border-t-primary rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div ref={scrollRef} className="page-scroll">
      {/* Pull-to-refresh indicator */}
      {refreshing && (
        <div className="fixed top-14 left-0 right-0 z-50 flex justify-center py-2 bg-primary/10">
          <div className="flex items-center gap-2 text-primary">
            <RefreshCw size={16} className="animate-spin" />
            <span className="t-small">Refreshing...</span>
          </div>
        </div>
      )}

      <div className="min-h-screen bg-bg-subtle p-6">
        <div className="mb-6">
          <h1 className="t-h1 text-text-primary">Business Overview</h1>
          <p className="t-body text-text-secondary mt-1">Welcome back, {session?.first_name} · Last 7 days</p>
        </div>

        {/* Active shift banner */}
        {stats.activeShift && (
          <div className="card border-l-4 border-l-[#2E7D32] mb-6 flex items-center justify-between">
            <div>
              <p className="t-label text-[#2E7D32] uppercase tracking-widest">Active Shift</p>
              <p className="t-body text-text-primary mt-0.5">{stats.activeShift.name} shift is currently open</p>
            </div>
            <div className="w-2 h-2 rounded-full bg-[#2E7D32] animate-pulse" />
          </div>
        )}

        {/* KPI cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Total Revenue', value: `₦${stats.totalRevenue.toLocaleString()}`, icon: DollarSign, color: 'text-[#2E7D32]' },
            { label: 'Total Orders', value: stats.totalOrders, icon: ShoppingBag, color: 'text-primary' },
            { label: 'Total Expenses', value: `₦${stats.totalExpenses.toLocaleString()}`, icon: TrendingDown, color: 'text-danger' },
            { label: 'Net Profit', value: `₦${stats.totalProfit.toLocaleString()}`, icon: TrendingUp, color: stats.totalProfit >= 0 ? 'text-[#2E7D32]' : 'text-danger' },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="card">
              <Icon size={20} className={`${color} mb-2`} />
              <p className="t-small text-text-muted">{label}</p>
              <p className={`t-h2 ${color} mt-1`}>{value}</p>
            </div>
          ))}
        </div>

        {/* Secondary cards */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { label: 'Active Staff', value: stats.activeStaff, icon: Users, color: 'text-text-primary' },
            { label: 'Pending Approvals', value: stats.pendingApprovals, icon: AlertCircle, color: 'text-[#E65100]' },
            { label: 'Low Stock Items', value: stats.lowStockItems, icon: Package, color: 'text-danger' },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="card text-center">
              <Icon size={18} className={`mx-auto mb-1 ${color}`} />
              <p className={`t-h2 ${color}`}>{value}</p>
              <p className="t-small text-text-muted mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          <div className="card">
            <p className="t-h3 text-text-primary mb-4">Revenue Trend</p>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={stats.revenueByDay}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" />
                <XAxis dataKey="date" stroke="#9E9E9E" tick={{ fontSize: 11 }} />
                <YAxis stroke="#9E9E9E" tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(v) => [`₦${Number(v).toLocaleString()}`, 'Revenue']}
                  contentStyle={{ backgroundColor: 'white', borderRadius: 8, border: '1px solid #E0E0E0', fontSize: 12 }}
                />
                <Line type="monotone" dataKey="revenue" stroke="#8B0000" strokeWidth={2} dot={{ fill: '#8B0000', r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="card">
            <p className="t-h3 text-text-primary mb-4">Payment Methods</p>
            {stats.revenueByPaymentMethod.length === 0 ? (
              <div className="flex items-center justify-center h-[220px]">
                <p className="t-body text-text-muted">No orders yet</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={stats.revenueByPaymentMethod}
                    cx="50%" cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${percent ? (percent * 100).toFixed(0) : 0}%`}
                    outerRadius={80}
                    dataKey="value"
                  >
                    {stats.revenueByPaymentMethod.map((_, index) => (
                      <Cell key={index} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => `₦${Number(v).toLocaleString()}`} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Top items + Recent orders */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          <div className="card">
            <p className="t-h3 text-text-primary mb-4">Top Selling Items</p>
            {stats.topSellingItems.length === 0 ? (
              <p className="t-body text-text-muted text-center py-6">No orders yet</p>
            ) : (
              <div className="space-y-3">
                {stats.topSellingItems.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-3">
                    <span className="t-small text-text-muted w-4">{idx + 1}</span>
                    <div className="flex-1">
                      <div className="flex justify-between mb-1">
                        <p className="t-body text-text-primary">{item.name}</p>
                        <p className="t-mono text-text-secondary">{item.quantity}</p>
                      </div>
                      <div className="progress-bar">
                        <div
                          className="progress-fill progress-fill-high"
                          style={{ width: `${(item.quantity / (stats.topSellingItems[0]?.quantity || 1)) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card">
            <p className="t-h3 text-text-primary mb-4">Recent Orders</p>
            {stats.recentOrders.length === 0 ? (
              <p className="t-body text-text-muted text-center py-6">No orders yet</p>
            ) : (
              <div className="space-y-2">
                {stats.recentOrders.map((order) => (
                  <div key={order.id} className="flex justify-between items-center py-2 border-b border-border">
                    <div>
                      <p className="t-mono text-text-muted">#{order.id}</p>
                      <p className="t-small text-text-secondary">{order.created_at}</p>
                    </div>
                    <div className="text-right">
                      <p className="t-body text-text-primary font-medium">₦{order.total.toLocaleString()}</p>
                      <p className="t-small text-text-muted capitalize">{order.payment_method}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Staff', sub: 'Approve accounts', icon: Users, path: '/admin/staff' },
            { label: 'Menu', sub: 'Add or edit items', icon: Package, path: '/admin/menu' },
            { label: 'Reports', sub: 'Export data', icon: TrendingUp, path: '/admin/reports' },
            { label: 'Settings', sub: 'Configure thresholds', icon: AlertCircle, path: '/admin/settings' },
          ].map(({ label, sub, icon: Icon, path }) => (
            <button key={path} onClick={() => router.push(path)} className="card text-left hover:border-primary/40 transition-colors">
              <Icon size={20} className="text-primary mb-2" />
              <p className="t-body text-text-primary font-medium">{label}</p>
              <p className="t-small text-text-muted mt-0.5">{sub}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}