'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getSession } from '@/lib/auth'
import { useToast } from '@/lib/toast'
import { Download, Calendar } from 'lucide-react'

type ShiftReport = {
  shift_date: string
  shift_name: string
  opened_at: string
  closed_at: string
  opener_name: string
  closer_name: string
  total_revenue: number
  cash_revenue: number
  transfer_revenue: number
  total_expenses: number
  net_profit: number
  order_count: number
  total_variance: number
}

export default function AdminReportsPage() {
  const router = useRouter()
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [reports, setReports] = useState<ShiftReport[]>([])
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [selectedShift, setSelectedShift] = useState('')
  const [shifts, setShifts] = useState<any[]>([])

  useEffect(() => {
    const userSession = getSession()
    if (!userSession) {
      router.push('/auth/login')
    } else if (userSession.role !== 'admin') {
      router.push('/dashboard')
    } else {
      fetchShifts()
      fetchReports()
    }
  }, [router])

  const fetchShifts = async () => {
    const { data } = await supabase.from('shifts').select('*').order('name')
    if (data) setShifts(data)
  }

  const fetchReports = async () => {
    setLoading(true)

    // Build sessions query
    let sessionsQuery = supabase
      .from('shift_sessions')
      .select(`*, shifts(name), opener:opener_staff_id(first_name, surname), closer:closer_staff_id(first_name, surname)`)
      .eq('status', 'closed')
      .order('shift_date', { ascending: false })

    if (startDate) sessionsQuery = sessionsQuery.gte('shift_date', startDate)
    if (endDate) sessionsQuery = sessionsQuery.lte('shift_date', endDate)
    if (selectedShift) sessionsQuery = sessionsQuery.eq('shift_id', selectedShift)

    const { data: sessions, error } = await sessionsQuery

    if (error) {
      toast('Error loading reports: ' + error.message, 'error')
      setLoading(false)
      return
    }

    if (!sessions || sessions.length === 0) {
      setReports([])
      setLoading(false)
      return
    }

    // Collect all shift dates and IDs to batch fetch
    const shiftDates = sessions.map(s => s.shift_date)
    const shiftIds = sessions.map(s => s.shift_id)

    // Single batch fetch for orders
    const { data: allOrders } = await supabase
      .from('orders')
      .select('shift_date, shift_id, total, cash_amount, transfer_amount')
      .in('shift_date', shiftDates)
      .in('shift_id', shiftIds)

    // Single batch fetch for expenses
    const { data: allExpenses } = await supabase
      .from('expenses')
      .select('shift_date, shift_id, amount')
      .in('shift_date', shiftDates)
      .in('shift_id', shiftIds)

    // Single batch fetch for variance
    const { data: allVariance } = await supabase
      .from('shift_close')
      .select('shift_date, shift_id, variance')
      .in('shift_date', shiftDates)
      .in('shift_id', shiftIds)

    // Build reports by merging — no more per-session queries
    const reportsData: ShiftReport[] = sessions.map(session => {
      const key = `${session.shift_date}_${session.shift_id}`

      const orders = (allOrders || []).filter(o => `${o.shift_date}_${o.shift_id}` === key)
      const expenses = (allExpenses || []).filter(e => `${e.shift_date}_${e.shift_id}` === key)
      const variances = (allVariance || []).filter(v => `${v.shift_date}_${v.shift_id}` === key)

      const total_revenue = orders.reduce((s, o) => s + o.total, 0)
      const cash_revenue = orders.reduce((s, o) => s + (o.cash_amount || 0), 0)
      const transfer_revenue = orders.reduce((s, o) => s + (o.transfer_amount || 0), 0)
      const total_expenses = expenses.reduce((s, e) => s + e.amount, 0)
      const total_variance = variances.reduce((s, v) => s + v.variance, 0)

      return {
        shift_date: session.shift_date,
        shift_name: session.shifts?.name || 'Unknown',
        opened_at: session.opened_at,
        closed_at: session.closed_at,
        opener_name: session.opener ? `${session.opener.first_name} ${session.opener.surname}` : '—',
        closer_name: session.closer ? `${session.closer.first_name} ${session.closer.surname}` : '—',
        total_revenue,
        cash_revenue,
        transfer_revenue,
        total_expenses,
        net_profit: total_revenue - total_expenses,
        order_count: orders.length,
        total_variance
      }
    })

    setReports(reportsData)
    setLoading(false)
  }

  const exportToCSV = () => {
    const headers = ['Date', 'Shift', 'Opened By', 'Closed By', 'Orders', 'Cash', 'Transfer', 'Revenue', 'Expenses', 'Profit', 'Variance']
    const rows = reports.map(r => [
      r.shift_date, r.shift_name, r.opener_name, r.closer_name,
      r.order_count, r.cash_revenue, r.transfer_revenue,
      r.total_revenue, r.total_expenses, r.net_profit, r.total_variance
    ])
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `shift_reports_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const stats = {
    totalRevenue: reports.reduce((s, r) => s + r.total_revenue, 0),
    totalExpenses: reports.reduce((s, r) => s + r.total_expenses, 0),
    totalProfit: reports.reduce((s, r) => s + r.net_profit, 0),
    totalOrders: reports.reduce((s, r) => s + r.order_count, 0),
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
      <div className="p-4 sm:p-6">
        <h1 className="t-h1 text-text-primary mb-6">Shift Reports</h1>

        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Total Shifts', value: reports.length, color: 'text-primary' },
            { label: 'Total Orders', value: stats.totalOrders, color: 'text-[#1565C0]' },
            { label: 'Total Revenue', value: `₦${stats.totalRevenue.toLocaleString()}`, color: 'text-[#2E7D32]' },
            { label: 'Total Profit', value: `₦${stats.totalProfit.toLocaleString()}`, color: stats.totalProfit >= 0 ? 'text-[#2E7D32]' : 'text-danger' },
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
            <p className="t-h3 text-text-primary">Filters</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="block t-label text-text-primary mb-1">Start Date</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="input-base" />
            </div>
            <div>
              <label className="block t-label text-text-primary mb-1">End Date</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="input-base" />
            </div>
            <div>
              <label className="block t-label text-text-primary mb-1">Shift Type</label>
              <select value={selectedShift} onChange={(e) => setSelectedShift(e.target.value)} className="input-base">
                <option value="">All Shifts</option>
                {shifts.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="flex gap-2 items-end">
              <button onClick={fetchReports} className="btn-primary flex-1">Apply</button>
              <button onClick={() => { setStartDate(''); setEndDate(''); setSelectedShift(''); fetchReports() }} className="btn-secondary">Clear</button>
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

        {/* Table with horizontal scroll - FIXED */}
        <div className="bg-white rounded-[10px] border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <div className="min-w-[800px]">
              <table className="w-full">
                <thead className="bg-bg-subtle border-b border-border">
                  <tr>
                    {['Date', 'Shift', 'Orders', 'Revenue', 'Expenses', 'Profit', 'Variance', 'Opened By', 'Closed By'].map(h => (
                      <th key={h} className={`p-3 t-label text-text-secondary whitespace-nowrap ${['Orders', 'Revenue', 'Expenses', 'Profit', 'Variance'].includes(h) ? 'text-right' : 'text-left'}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {reports.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="text-center p-10 t-body text-text-muted">No closed shifts found</td>
                    </tr>
                  ) : (
                    reports.map((r, idx) => (
                      <tr key={idx} className="border-b border-border hover:bg-bg-subtle">
                        <td className="p-3 t-mono text-text-secondary whitespace-nowrap">{r.shift_date}</td>
                        <td className="p-3 t-body text-text-primary font-medium whitespace-nowrap">{r.shift_name}</td>
                        <td className="p-3 t-mono text-right">{r.order_count}</td>
                        <td className="p-3 t-mono text-[#2E7D32] text-right whitespace-nowrap">₦{r.total_revenue.toLocaleString()}</td>
                        <td className="p-3 t-mono text-danger text-right whitespace-nowrap">₦{r.total_expenses.toLocaleString()}</td>
                        <td className={`p-3 t-mono text-right font-medium whitespace-nowrap ${r.net_profit >= 0 ? 'text-[#2E7D32]' : 'text-danger'}`}>₦{r.net_profit.toLocaleString()}</td>
                        <td className={`p-3 t-mono text-right whitespace-nowrap ${r.total_variance > 0 ? 'text-[#2E7D32]' : r.total_variance < 0 ? 'text-danger' : 'text-text-muted'}`}>
                          {r.total_variance > 0 ? `+${r.total_variance}` : r.total_variance}
                        </td>
                        <td className="p-3 t-small text-text-secondary whitespace-nowrap">{r.opener_name}</td>
                        <td className="p-3 t-small text-text-secondary whitespace-nowrap">{r.closer_name}</td>
                      </tr>
                    ))
                  )}
                </tbody>
                {reports.length > 0 && (
                  <tfoot className="bg-bg-subtle border-t border-border">
                    <tr>
                      <td colSpan={2} className="p-3 t-label text-text-primary">Total</td>
                      <td className="p-3 t-mono text-right">{stats.totalOrders}</td>
                      <td className="p-3 t-mono text-[#2E7D32] text-right whitespace-nowrap">₦{stats.totalRevenue.toLocaleString()}</td>
                      <td className="p-3 t-mono text-danger text-right whitespace-nowrap">₦{stats.totalExpenses.toLocaleString()}</td>
                      <td className={`p-3 t-mono text-right font-medium whitespace-nowrap ${stats.totalProfit >= 0 ? 'text-[#2E7D32]' : 'text-danger'}`}>₦{stats.totalProfit.toLocaleString()}</td>
                      <td colSpan={3} className="p-3"></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}