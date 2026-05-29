'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { FileText } from 'lucide-react'

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
    const saved = localStorage.getItem('shift_summary')
    if (saved) {
      setSummary(JSON.parse(saved))
    } else {
      router.push('/dashboard')
    }
  }, [router])

  if (!summary) {
    return (
      <div className="min-h-screen bg-bg-subtle flex items-center justify-center">
        <div className="w-7 h-7 border-[3px] border-border border-t-primary rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-bg-subtle">
      <div className="p-4 max-w-2xl mx-auto space-y-4 pb-10">

        {/* Header */}
        <div className="card text-center py-6">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
            <FileText size={24} className="text-primary" />
          </div>
          <h1 className="t-h1 text-text-primary">Shift Report</h1>
          <p className="t-body text-text-secondary mt-1">{summary.shiftName} Shift</p>
          <p className="t-small text-text-muted mt-0.5">
            {new Date(summary.shiftDate).toLocaleDateString('en-NG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>

        {/* Revenue */}
        <div className="card">
          <p className="t-h3 text-text-primary mb-3">Revenue</p>
          <div className="space-y-2">
            <div className="flex justify-between">
              <p className="t-body text-text-secondary">Cash</p>
              <p className="t-mono text-[#2E7D32]">₦{(summary.cashRevenue || 0).toLocaleString()}</p>
            </div>
            <div className="flex justify-between">
              <p className="t-body text-text-secondary">Transfer</p>
              <p className="t-mono text-[#1565C0]">₦{(summary.transferRevenue || 0).toLocaleString()}</p>
            </div>
            <div className="flex justify-between border-t border-border pt-2 mt-1">
              <p className="t-h3 text-text-primary">Total Revenue</p>
              <p className="t-mono text-[#2E7D32] font-medium">₦{summary.totalRevenue.toLocaleString()}</p>
            </div>
          </div>
        </div>

        {/* Expenses */}
        <div className="card">
          <p className="t-h3 text-text-primary mb-3">Expenses</p>
          <div className="space-y-2">
            <div className="flex justify-between">
              <p className="t-body text-text-secondary">Cash</p>
              <p className="t-mono text-danger">₦{(summary.cashExpenses || 0).toLocaleString()}</p>
            </div>
            <div className="flex justify-between">
              <p className="t-body text-text-secondary">Transfer</p>
              <p className="t-mono text-[#E65100]">₦{(summary.transferExpenses || 0).toLocaleString()}</p>
            </div>
            <div className="flex justify-between border-t border-border pt-2 mt-1">
              <p className="t-h3 text-text-primary">Total Expenses</p>
              <p className="t-mono text-danger font-medium">₦{summary.totalExpenses.toLocaleString()}</p>
            </div>
          </div>
        </div>

        {/* Net profit */}
        <div className="card">
          <div className="flex justify-between items-center">
            <p className="t-h2 text-text-primary">Net Profit</p>
            <p className={`t-h1 font-medium ${summary.netRevenue >= 0 ? 'text-[#2E7D32]' : 'text-danger'}`}>
              ₦{summary.netRevenue.toLocaleString()}
            </p>
          </div>
        </div>

        {/* Stock variance */}
        <div className="card">
          <p className="t-h3 text-text-primary mb-3">Stock Variance</p>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-bg-subtle">
                <tr>
                  {['Item', 'Open', 'Sold', 'Exp.', 'Actual', 'Var.'].map(h => (
                    <th key={h} className={`p-2 t-small text-text-muted ${h === 'Item' ? 'text-left' : 'text-right'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {summary.stockItems.map((item, idx) => (
                  <tr key={idx} className="border-b border-border">
                    <td className="p-2 t-body text-text-primary">{item.name}</td>
                    <td className="p-2 t-mono text-text-secondary text-right">{item.opening}</td>
                    <td className="p-2 t-mono text-text-secondary text-right">{item.sold}</td>
                    <td className="p-2 t-mono text-text-secondary text-right">{item.expected}</td>
                    <td className="p-2 t-mono text-text-secondary text-right">{item.actual}</td>
                    <td className={`p-2 t-mono text-right font-medium ${
                      item.variance > 0 ? 'text-[#2E7D32]' : item.variance < 0 ? 'text-danger' : 'text-text-muted'
                    }`}>
                      {item.variance > 0 ? `+${item.variance}` : item.variance}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button onClick={() => window.print()} className="btn-secondary flex-1">
            Print Report
          </button>
          <button onClick={() => router.push('/dashboard')} className="btn-primary flex-1">
            Back to Dashboard
          </button>
        </div>

        <p className="t-small text-text-muted text-center">
          This shift has been closed. No further orders can be taken.
        </p>

      </div>
    </div>
  )
}