'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { FileText, Download } from 'lucide-react'

type SummaryItem = {
  name: string
  opening: number
  sold: number
  expected: number
  actual: number
  variance: number
}

type ShiftSummary = {
  shiftName: string
  shiftDate: string
  openedAt: string
  closedAt: string
  totalRevenue: number
  cashRevenue: number
  transferRevenue: number
  totalExpenses: number
  cashExpenses: number
  transferExpenses: number
  netRevenue: number
  stockItems: SummaryItem[]
}

export default function ShiftSummaryPage() {
  const router = useRouter()
  const [summary, setSummary] = useState<ShiftSummary | null>(null)

  useEffect(() => {
    const savedSummary = localStorage.getItem('shift_summary')
    if (savedSummary) {
      setSummary(JSON.parse(savedSummary))
    } else {
      router.push('/dashboard')
    }
  }, [router])

  const handlePrint = () => {
    window.print()
  }

  if (!summary) {
    return <div className="p-6 text-center">Loading...</div>
  }

  return (
    <div className="min-h-screen bg-bg-subtle">
      <div className="p-4 max-w-2xl mx-auto">
        <div className="card mb-4 text-center">
          <FileText size={48} className="mx-auto mb-2 text-primary" />
          <h1 className="text-2xl font-bold text-text-primary">Shift Report</h1>
          <p className="text-text-secondary">{summary.shiftName} Shift</p>
          <p className="text-text-secondary text-sm">{new Date(summary.shiftDate).toLocaleDateString()}</p>
        </div>

        <div className="card mb-4">
          <h2 className="font-bold text-text-primary mb-3">Revenue Breakdown</h2>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-text-secondary">Cash Revenue</span>
              <span className="font-mono font-bold text-success">₦{summary.cashRevenue?.toLocaleString() || '0'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-secondary">Transfer Revenue</span>
              <span className="font-mono font-bold text-info">₦{summary.transferRevenue?.toLocaleString() || '0'}</span>
            </div>
            <div className="flex justify-between border-t border-border pt-2 mt-2">
              <span className="font-bold text-text-primary">Total Revenue</span>
              <span className="font-mono font-bold text-success">₦{summary.totalRevenue.toLocaleString()}</span>
            </div>
          </div>
        </div>

        <div className="card mb-4">
          <h2 className="font-bold text-text-primary mb-3">Expenses Breakdown</h2>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-text-secondary">Cash Expenses</span>
              <span className="font-mono font-bold text-danger">₦{summary.cashExpenses?.toLocaleString() || '0'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-secondary">Transfer Expenses</span>
              <span className="font-mono font-bold text-warning">₦{summary.transferExpenses?.toLocaleString() || '0'}</span>
            </div>
            <div className="flex justify-between border-t border-border pt-2 mt-2">
              <span className="font-bold text-text-primary">Total Expenses</span>
              <span className="font-mono font-bold text-danger">₦{summary.totalExpenses.toLocaleString()}</span>
            </div>
          </div>
        </div>

        <div className="card mb-4">
          <h2 className="font-bold text-text-primary mb-3">Final Summary</h2>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-text-secondary">Total Revenue</span>
              <span className="font-mono">₦{summary.totalRevenue.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-secondary">Total Expenses</span>
              <span className="font-mono">(₦{summary.totalExpenses.toLocaleString()})</span>
            </div>
            <div className="flex justify-between border-t border-border pt-2 mt-2">
              <span className="font-bold text-text-primary text-lg">Net Profit</span>
              <span className={`font-mono font-bold text-lg ${summary.netRevenue >= 0 ? 'text-success' : 'text-danger'}`}>
                ₦{summary.netRevenue.toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        <div className="card mb-4">
          <h2 className="font-bold text-text-primary mb-3">Stock Variance</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-bg-subtle">
                <tr>
                  <th className="text-left p-2 text-text-secondary">Item</th>
                  <th className="text-right p-2 text-text-secondary">Opening</th>
                  <th className="text-right p-2 text-text-secondary">Sold</th>
                  <th className="text-right p-2 text-text-secondary">Expected</th>
                  <th className="text-right p-2 text-text-secondary">Actual</th>
                  <th className="text-right p-2 text-text-secondary">Variance</th>
                </tr>
              </thead>
              <tbody>
                {summary.stockItems.map((item, idx) => (
                  <tr key={idx} className="border-b border-border">
                    <td className="p-2 font-medium">{item.name}</td>
                    <td className="p-2 text-right font-mono">{item.opening}</td>
                    <td className="p-2 text-right font-mono">{item.sold}</td>
                    <td className="p-2 text-right font-mono">{item.expected}</td>
                    <td className="p-2 text-right font-mono">{item.actual}</td>
                    <td className={`p-2 text-right font-mono ${item.variance > 0 ? 'text-success' : item.variance < 0 ? 'text-danger' : ''}`}>
                      {item.variance > 0 ? `+${item.variance}` : item.variance}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex gap-3">
          <button onClick={handlePrint} className="btn-secondary flex-1 flex items-center justify-center gap-2">
            <Download size={18} />
            Print Report
          </button>
          <button onClick={() => router.push('/dashboard')} className="btn-primary flex-1">
            Go to Dashboard
          </button>
        </div>

        <p className="text-center text-text-muted text-xs mt-6">
          This shift has been closed. No further orders can be taken.
        </p>
      </div>
    </div>
  )
}