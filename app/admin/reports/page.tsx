'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getSession } from '@/lib/auth'
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
  cash_expenses: number
  transfer_expenses: number
  net_profit: number
  order_count: number
  total_variance: number
}

export default function AdminReportsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState<any>(null)
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
      setSession(userSession)
      fetchShifts()
      fetchReports()
    }
  }, [router])

  const fetchShifts = async () => {
    const { data, error } = await supabase
      .from('shifts')
      .select('*')
      .order('name')

    if (!error && data) {
      setShifts(data)
    }
  }

  const fetchReports = async () => {
    setLoading(true)
    
    let query = supabase
      .from('shift_sessions')
      .select(`
        *,
        shifts(name),
        opener:opener_staff_id(first_name, surname),
        closer:closer_staff_id(first_name, surname)
      `)
      .eq('status', 'closed')
      .order('closed_at', { ascending: false })

    if (startDate) {
      query = query.gte('shift_date', startDate)
    }
    if (endDate) {
      query = query.lte('shift_date', endDate)
    }
    if (selectedShift) {
      query = query.eq('shift_id', selectedShift)
    }

    const { data: sessions, error } = await query

    if (!error && sessions) {
      const reportsData = await Promise.all(sessions.map(async (session) => {
        const { data: orders } = await supabase
          .from('orders')
          .select('total, payment_method, cash_amount, transfer_amount')
          .eq('shift_date', session.shift_date)
          .eq('shift_id', session.shift_id)

        const totalRevenue = orders?.reduce((sum, o) => sum + o.total, 0) || 0
        const cashRevenue = orders?.reduce((sum, o) => sum + (o.cash_amount || 0), 0) || 0
        const transferRevenue = orders?.reduce((sum, o) => sum + (o.transfer_amount || 0), 0) || 0
        const orderCount = orders?.length || 0

        const { data: expenses } = await supabase
          .from('expenses')
          .select('amount, payment_method')
          .eq('shift_date', session.shift_date)
          .eq('shift_id', session.shift_id)

        const totalExpenses = expenses?.reduce((sum, e) => sum + e.amount, 0) || 0
        const cashExpenses = expenses?.reduce((sum, e) => sum + (e.payment_method === 'cash' ? e.amount : 0), 0) || 0
        const transferExpenses = expenses?.reduce((sum, e) => sum + (e.payment_method === 'transfer' ? e.amount : 0), 0) || 0

        const { data: varianceData } = await supabase
          .from('shift_close')
          .select('variance')
          .eq('shift_date', session.shift_date)
          .eq('shift_id', session.shift_id)

        const totalVariance = varianceData?.reduce((sum, v) => sum + v.variance, 0) || 0

        return {
          shift_date: session.shift_date,
          shift_name: session.shifts?.name || 'Unknown',
          opened_at: session.opened_at,
          closed_at: session.closed_at,
          opener_name: session.opener ? `${session.opener.first_name} ${session.opener.surname}` : 'Unknown',
          closer_name: session.closer ? `${session.closer.first_name} ${session.closer.surname}` : 'Unknown',
          total_revenue: totalRevenue,
          cash_revenue: cashRevenue,
          transfer_revenue: transferRevenue,
          total_expenses: totalExpenses,
          cash_expenses: cashExpenses,
          transfer_expenses: transferExpenses,
          net_profit: totalRevenue - totalExpenses,
          order_count: orderCount,
          total_variance: totalVariance
        }
      }))

      setReports(reportsData)
    }
    setLoading(false)
  }

  const exportToCSV = () => {
    // Create CSV header
    const headers = [
      'Shift Date',
      'Shift Name',
      'Opened By',
      'Closed By',
      'Order Count',
      'Cash Revenue',
      'Transfer Revenue',
      'Total Revenue',
      'Cash Expenses',
      'Transfer Expenses',
      'Total Expenses',
      'Net Profit',
      'Stock Variance'
    ]
    
    // Create CSV rows
    const rows = reports.map(report => [
      report.shift_date,
      report.shift_name,
      report.opener_name,
      report.closer_name,
      report.order_count,
      report.cash_revenue,
      report.transfer_revenue,
      report.total_revenue,
      report.cash_expenses,
      report.transfer_expenses,
      report.total_expenses,
      report.net_profit,
      report.total_variance
    ])
    
    // Combine headers and rows
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n')
    
    // Download file
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `shift_reports_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const getTotalStats = () => {
    return {
      totalRevenue: reports.reduce((sum, r) => sum + r.total_revenue, 0),
      totalExpenses: reports.reduce((sum, r) => sum + r.total_expenses, 0),
      totalProfit: reports.reduce((sum, r) => sum + r.net_profit, 0),
      totalOrders: reports.reduce((sum, r) => sum + r.order_count, 0),
    }
  }

  const stats = getTotalStats()

  if (loading) return <div className="p-6">Loading...</div>

  return (
    <div className="min-h-screen bg-bg-subtle">
      <div className="p-6">
        <h1 className="text-2xl font-bold text-text-primary mb-6">Shift Reports</h1>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <div className="card text-center">
            <p className="text-text-secondary text-xs">Total Shifts</p>
            <p className="text-2xl font-bold text-primary">{reports.length}</p>
          </div>
          <div className="card text-center">
            <p className="text-text-secondary text-xs">Total Orders</p>
            <p className="text-2xl font-bold text-info">{stats.totalOrders}</p>
          </div>
          <div className="card text-center">
            <p className="text-text-secondary text-xs">Total Revenue</p>
            <p className="text-2xl font-bold text-success">₦{stats.totalRevenue.toLocaleString()}</p>
          </div>
          <div className="card text-center">
            <p className="text-text-secondary text-xs">Total Profit</p>
            <p className={`text-2xl font-bold ${stats.totalProfit >= 0 ? 'text-success' : 'text-danger'}`}>
              ₦{stats.totalProfit.toLocaleString()}
            </p>
          </div>
        </div>

        <div className="card mb-6">
          <h3 className="font-bold text-text-primary mb-3 flex items-center gap-2">
            <Calendar size={18} />
            Filters
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
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
            <div>
              <label className="block text-text-secondary text-sm mb-1">Shift Type</label>
              <select
                value={selectedShift}
                onChange={(e) => setSelectedShift(e.target.value)}
                className="input-base"
              >
                <option value="">All Shifts</option>
                {shifts.map(shift => (
                  <option key={shift.id} value={shift.id}>{shift.name}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-2 items-end">
              <button onClick={fetchReports} className="btn-primary flex-1">Apply</button>
              <button onClick={() => {
                setStartDate('')
                setEndDate('')
                setSelectedShift('')
                fetchReports()
              }} className="btn-secondary">Clear</button>
            </div>
          </div>
        </div>

        {reports.length > 0 && (
          <div className="flex gap-3 mb-6">
            <button onClick={exportToCSV} className="btn-primary flex items-center gap-2">
              <Download size={18} />
              Export to CSV
            </button>
          </div>
        )}

        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-bg-subtle border-b border-border">
              <tr>
                <th className="text-left p-3 text-text-secondary">Date</th>
                <th className="text-left p-3 text-text-secondary">Shift</th>
                <th className="text-center p-3 text-text-secondary">Orders</th>
                <th className="text-right p-3 text-text-secondary">Revenue</th>
                <th className="text-right p-3 text-text-secondary">Expenses</th>
                <th className="text-right p-3 text-text-secondary">Profit</th>
                <th className="text-right p-3 text-text-secondary">Variance</th>
                <th className="text-left p-3 text-text-secondary">Opened By</th>
                <th className="text-left p-3 text-text-secondary">Closed By</th>
              </tr>
            </thead>
            <tbody>
              {reports.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center p-8 text-text-muted">
                    No closed shifts found
                  </td>
                </tr>
              ) : (
                reports.map((report, idx) => (
                  <tr key={idx} className="border-b border-border hover:bg-bg-subtle">
                    <td className="p-3 font-mono text-xs">{report.shift_date}</td>
                    <td className="p-3 font-medium">{report.shift_name}</td>
                    <td className="p-3 text-center">{report.order_count}</td>
                    <td className="p-3 text-right text-success">₦{report.total_revenue.toLocaleString()}</td>
                    <td className="p-3 text-right text-danger">₦{report.total_expenses.toLocaleString()}</td>
                    <td className={`p-3 text-right font-bold ${report.net_profit >= 0 ? 'text-success' : 'text-danger'}`}>
                      ₦{report.net_profit.toLocaleString()}
                    </td>
                    <td className={`p-3 text-right ${report.total_variance > 0 ? 'text-success' : report.total_variance < 0 ? 'text-danger' : ''}`}>
                      {report.total_variance > 0 ? `+${report.total_variance}` : report.total_variance}
                    </td>
                    <td className="p-3 text-text-secondary text-xs">{report.opener_name}</td>
                    <td className="p-3 text-text-secondary text-xs">{report.closer_name}</td>
                  </tr>
                ))
              )}
            </tbody>
            {reports.length > 0 && (
              <tfoot className="bg-bg-subtle border-t border-border font-bold">
                <tr>
                  <td colSpan={2} className="p-3">Total</td>
                  <td className="p-3 text-center">{stats.totalOrders}</td>
                  <td className="p-3 text-right text-success">₦{stats.totalRevenue.toLocaleString()}</td>
                  <td className="p-3 text-right text-danger">₦{stats.totalExpenses.toLocaleString()}</td>
                  <td className={`p-3 text-right ${stats.totalProfit >= 0 ? 'text-success' : 'text-danger'}`}>
                    ₦{stats.totalProfit.toLocaleString()}
                  </td>
                  <td colSpan={3} className="p-3"></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  )
}