'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getSession } from '@/lib/auth'
import { useToast } from '@/lib/toast'
import { Download, Calendar, TrendingDown } from 'lucide-react'

type DayReport = {
  date: string
  order_count: number
  total_revenue: number
  cash_revenue: number
  transfer_revenue: number
  total_expenses: number
  net_profit: number
}

type ItemSales = { name: string; quantity: number }

export default function ReportsPage() {
  const router = useRouter()
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [reports, setReports] = useState<DayReport[]>([])
  const [itemSales, setItemSales] = useState<ItemSales[]>([])
  const [startDate, setStartDate] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - 7)
    return d.toISOString().split('T')[0]
  })
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0])

  useEffect(() => {
    const userSession = getSession()
    if (!userSession) {
      router.push('/auth/login')
    } else {
      fetchReports()
    }
  }, [router])

  const fetchReports = async () => {
    setLoading(true)

    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('created_at, total, cash_amount, transfer_amount, items_json')
      .gte('created_at', `${startDate}T00:00:00`)
      .lte('created_at', `${endDate}T23:59:59`)
      .order('created_at', { ascending: false })

    if (ordersError) {
      toast('Error loading reports: ' + ordersError.message, 'error')
      setLoading(false)
      return
    }

    const { data: expenses, error: expensesError } = await supabase
      .from('expenses')
      .select('created_at, amount')
      .gte('created_at', `${startDate}T00:00:00`)
      .lte('created_at', `${endDate}T23:59:59`)

    if (expensesError) {
      toast('Error loading expenses: ' + expensesError.message, 'error')
      setLoading(false)
      return
    }

    // Group by day
    const dayMap = new Map<string, DayReport>()
    const ensureDay = (date: string) => {
      if (!dayMap.has(date)) {
        dayMap.set(date, {
          date, order_count: 0, total_revenue: 0, cash_revenue: 0,
          transfer_revenue: 0, total_expenses: 0, net_profit: 0
        })
      }
      return dayMap.get(date)!
    }

    for (const o of orders || []) {
      const date = o.created_at.split('T')[0]
      const day = ensureDay(date)
      day.order_count += 1
      day.total_revenue += o.total
      day.cash_revenue += o.cash_amount || 0
      day.transfer_revenue += o.transfer_amount || 0
    }
    for (const e of expenses || []) {
      const date = e.created_at.split('T')[0]
      const day = ensureDay(date)
      day.total_expenses += e.amount
    }
    dayMap.forEach(day => { day.net_profit = day.total_revenue - day.total_expenses })

    setReports(Array.from(dayMap.values()).sort((a, b) => b.date.localeCompare(a.date)))

    // Item sales breakdown
    const itemMap: Record<string, number> = {}
    orders?.forEach(order => {
      order.items_json?.forEach((item: any) => {
        itemMap[item.name] = (itemMap[item.name] || 0) + item.qty
      })
    })
    setItemSales(
      Object.entries(itemMap)
        .map(([name, quantity]) => ({ name, quantity }))
        .sort((a, b) => b.quantity - a.quantity)
    )

    setLoading(false)
  }

  const exportToCSV = () => {
    const headers = ['Date', 'Orders', 'Cash', 'Transfer', 'Revenue', 'Expenses', 'Profit']
    const rows = reports.map(r => [
      r.date, r.order_count, r.cash_revenue, r.transfer_revenue,
      r.total_revenue, r.total_expenses, r.net_profit
    ])
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `report_${startDate}_to_${endDate}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const stats = {
    totalRevenue: reports.reduce((s, r) => s + r.total_revenue, 0),
    totalExpenses: reports.reduce((s, r) => s + r.total_expenses, 0),
    totalProfit: reports.reduce((s, r) => s + r.net_profit, 0),
    totalOrders: reports.reduce((s, r) => s + r.order_count, 0),
  }
  const totalItemsSold = itemSales.reduce((s, i) => s + i.quantity, 0)

  if (loading) {
    return (
      <div className="min-h-screen bg-bg-subtle flex items-center justify-center">
        <div className="w-7 h-7 border-[3px] border-border border-t-primary rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-bg-subtle">
      <div className="p-4 sm:p-6">
        <h1 className="t-h1 text-text-primary mb-6">Reports</h1>

        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Total Orders', value: stats.totalOrders, color: 'text-[#1565C0]' },
            { label: 'Total Revenue', value: `₦${stats.totalRevenue.toLocaleString()}`, color: 'text-[#2E7D32]' },
            { label: 'Total Expenses', value: `₦${stats.totalExpenses.toLocaleString()}`, color: 'text-danger' },
            { label: 'Net Profit', value: `₦${stats.totalProfit.toLocaleString()}`, color: stats.totalProfit >= 0 ? 'text-[#2E7D32]' : 'text-danger' },
          ].map(({ label, value, color }) => (
            <div key={label} className="card text-center">
              <p className="t-small text-text-muted uppercase tracking-widest mb-1">{label}</p>
              <p className={`t-h1 ${color} text-base sm:text-xl md:text-2xl lg:text-3xl`}>{value}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="card mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Calendar size={16} className="text-text-secondary" />
            <p className="t-h3 text-text-primary">Date Range</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block t-label text-text-primary mb-1">Start Date</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="input-base" />
            </div>
            <div>
              <label className="block t-label text-text-primary mb-1">End Date</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="input-base" />
            </div>
            <div className="flex items-end">
              <button onClick={fetchReports} className="btn-primary w-full">Apply</button>
            </div>
          </div>
        </div>

        {reports.length > 0 && (
          <div className="mb-4">
            <button onClick={exportToCSV} className="btn-primary flex items-center gap-2">
              <Download size={16} /> Export CSV
            </button>
          </div>
        )}

        {/* Mobile: card list. Desktop: table */}
        <div className="sm:hidden space-y-3 mb-6">
          {reports.length === 0 ? (
            <div className="card text-center py-10">
              <p className="t-body text-text-muted">No orders in this range</p>
            </div>
          ) : (
            reports.map((r) => (
              <div key={r.date} className="card">
                <div className="flex justify-between items-center mb-2">
                  <p className="t-body text-text-primary font-medium">{r.date}</p>
                  <p className="t-small text-text-muted">{r.order_count} orders</p>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="t-small text-text-muted">Revenue</p>
                    <p className="t-mono text-[#2E7D32] font-medium">₦{r.total_revenue.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="t-small text-text-muted">Expenses</p>
                    <p className="t-mono text-danger font-medium">₦{r.total_expenses.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="t-small text-text-muted">Profit</p>
                    <p className={`t-mono font-medium ${r.net_profit >= 0 ? 'text-[#2E7D32]' : 'text-danger'}`}>₦{r.net_profit.toLocaleString()}</p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="hidden sm:block bg-white rounded-[10px] border border-border overflow-hidden mb-6">
          <div className="overflow-x-auto">
            <div className="min-w-[640px]">
              <table className="w-full">
                <thead className="bg-bg-subtle border-b border-border">
                  <tr>
                    {['Date', 'Orders', 'Revenue', 'Expenses', 'Profit'].map(h => (
                      <th key={h} className={`p-3 t-label text-text-secondary whitespace-nowrap ${h === 'Date' ? 'text-left' : 'text-right'}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {reports.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center p-10 t-body text-text-muted">No orders in this range</td>
                    </tr>
                  ) : (
                    reports.map((r) => (
                      <tr key={r.date} className="border-b border-border hover:bg-bg-subtle">
                        <td className="p-3 t-mono text-text-secondary whitespace-nowrap">{r.date}</td>
                        <td className="p-3 t-mono text-right">{r.order_count}</td>
                        <td className="p-3 t-mono text-[#2E7D32] text-right whitespace-nowrap">₦{r.total_revenue.toLocaleString()}</td>
                        <td className="p-3 t-mono text-danger text-right whitespace-nowrap">₦{r.total_expenses.toLocaleString()}</td>
                        <td className={`p-3 t-mono text-right font-medium whitespace-nowrap ${r.net_profit >= 0 ? 'text-[#2E7D32]' : 'text-danger'}`}>₦{r.net_profit.toLocaleString()}</td>
                      </tr>
                    ))
                  )}
                </tbody>
                {reports.length > 0 && (
                  <tfoot className="bg-bg-subtle border-t border-border">
                    <tr>
                      <td className="p-3 t-label text-text-primary">Total</td>
                      <td className="p-3 t-mono text-right">{stats.totalOrders}</td>
                      <td className="p-3 t-mono text-[#2E7D32] text-right whitespace-nowrap">₦{stats.totalRevenue.toLocaleString()}</td>
                      <td className="p-3 t-mono text-danger text-right whitespace-nowrap">₦{stats.totalExpenses.toLocaleString()}</td>
                      <td className={`p-3 t-mono text-right font-medium whitespace-nowrap ${stats.totalProfit >= 0 ? 'text-[#2E7D32]' : 'text-danger'}`}>₦{stats.totalProfit.toLocaleString()}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </div>

        {/* Item sales breakdown (replaces the old Inventory page) */}
        {itemSales.length > 0 && (
          <div className="card">
            <div className="flex items-center gap-2 mb-4">
              <TrendingDown size={16} className="text-primary" />
              <p className="t-h3 text-text-primary">Items Sold</p>
            </div>
            <div className="space-y-3">
              {itemSales.map((item) => (
                <div key={item.name} className="flex items-center gap-3">
                  <div className="flex-1">
                    <div className="flex justify-between mb-1">
                      <p className="t-body text-text-primary truncate max-w-[60%]">{item.name}</p>
                      <p className="t-mono text-text-secondary flex-shrink-0 ml-2">{item.quantity} sold</p>
                    </div>
                    <div className="progress-bar">
                      <div
                        className="progress-fill progress-fill-high"
                        style={{ width: `${totalItemsSold > 0 ? (item.quantity / (itemSales[0]?.quantity || 1)) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}