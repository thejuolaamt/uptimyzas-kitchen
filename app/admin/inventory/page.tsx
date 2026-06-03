'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getSession } from '@/lib/auth'
import { useToast } from '@/lib/toast'
import { Package, TrendingDown } from 'lucide-react'

type InventoryRow = {
  item_name: string
  total_opening: number
  total_sold: number
  total_remaining: number
  total_variance: number
  shift_count: number
}

// Inventory Page Skeleton Component
function InventorySkeleton() {
  return (
    <div className="min-h-screen bg-bg-subtle">
      <div className="p-4 sm:p-6">
        {/* Title skeleton */}
        <div className="skeleton h-8 w-48 mb-6 rounded" />

        {/* Summary cards skeleton */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="card text-center">
              <div className="skeleton h-4 w-20 mx-auto mb-2 rounded" />
              <div className="skeleton h-8 w-16 mx-auto rounded" />
            </div>
          ))}
        </div>

        {/* Filter card skeleton */}
        <div className="card mb-6">
          <div className="skeleton h-6 w-40 mb-3 rounded" />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="skeleton h-12 w-full rounded" />
            <div className="skeleton h-12 w-full rounded" />
            <div className="skeleton h-12 w-full rounded" />
          </div>
        </div>

        {/* Table skeleton */}
        <div className="bg-white rounded-[10px] border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <div className="min-w-[640px]">
              <table className="w-full">
                <thead className="bg-bg-subtle border-b border-border">
                  <tr>
                    {['Item', 'Shifts', 'Total Opening', 'Total Sold', 'Total Remaining', 'Variance'].map((h, i) => (
                      <th key={i} className={`p-3 ${i === 0 ? 'text-left' : 'text-right'}`}>
                        <div className="skeleton h-5 w-20 rounded" />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                    <tr key={i} className="border-b border-border">
                      {[1, 2, 3, 4, 5, 6].map(j => (
                        <td key={j} className="p-3">
                          <div className={`skeleton h-5 ${j === 1 || j === 3 || j === 4 ? 'w-12' : 'w-24'} rounded ${j === 0 ? 'ml-0' : 'ml-auto'}`} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-bg-subtle border-t border-border">
                  <tr>
                    {[1, 2, 3, 4, 5, 6].map(i => (
                      <td key={i} className="p-3">
                        <div className="skeleton h-5 w-16 rounded" />
                      </td>
                    ))}
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function AdminInventoryPage() {
  const router = useRouter()
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [inventory, setInventory] = useState<InventoryRow[]>([])
  const [startDate, setStartDate] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - 7)
    return d.toISOString().split('T')[0]
  })
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0])

  useEffect(() => {
    const session = getSession()
    if (!session) {
      router.push('/auth/login')
    } else if (session.role !== 'admin') {
      router.push('/dashboard')
    } else {
      fetchInventory()
    }
  }, [router])

  const fetchInventory = async () => {
    setLoading(true)

    const { data, error } = await supabase
      .from('shift_stock')
      .select('item_name, opening_qty, sold_qty, remaining_qty')
      .gte('shift_date', startDate)
      .lte('shift_date', endDate)

    if (error) {
      toast('Error loading inventory: ' + error.message, 'error')
      setLoading(false)
      return
    }

    // Aggregate by item name in JS
    const map = new Map<string, InventoryRow>()
    for (const row of data || []) {
      const existing = map.get(row.item_name)
      if (existing) {
        existing.total_opening += row.opening_qty
        existing.total_sold += row.sold_qty
        existing.total_remaining += row.remaining_qty
        existing.shift_count += 1
      } else {
        map.set(row.item_name, {
          item_name: row.item_name,
          total_opening: row.opening_qty,
          total_sold: row.sold_qty,
          total_remaining: row.remaining_qty,
          total_variance: 0,
          shift_count: 1
        })
      }
    }

    // Pull variance from shift_close for same range
    const { data: closeData } = await supabase
      .from('shift_close')
      .select('item_id, variance, shift_stock(item_name)')
      .gte('shift_date', startDate)
      .lte('shift_date', endDate)

    for (const row of closeData || []) {
      const name = (row.shift_stock as any)?.item_name
      if (name && map.has(name)) {
        map.get(name)!.total_variance += row.variance
      }
    }

    setInventory(Array.from(map.values()).sort((a, b) => b.total_sold - a.total_sold))
    setLoading(false)
  }

  const totalSold = inventory.reduce((s, i) => s + i.total_sold, 0)
  const totalVariance = inventory.reduce((s, i) => s + i.total_variance, 0)

  // Show skeleton while loading
  if (loading) {
    return <InventorySkeleton />
  }

  return (
    <div className="min-h-screen bg-bg-subtle">
      <div className="p-4 sm:p-6">

        <h1 className="t-h1 text-text-primary mb-6">Inventory Overview</h1>

        {/* Summary cards - responsive grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <div className="card text-center">
            <p className="t-small text-text-muted uppercase tracking-widest mb-1">Items Tracked</p>
            <p className="t-h1 text-primary">{inventory.length}</p>
          </div>
          <div className="card text-center">
            <p className="t-small text-text-muted uppercase tracking-widest mb-1">Total Sold</p>
            <p className="t-h1 text-[#2E7D32]">{totalSold}</p>
          </div>
          <div className="card text-center">
            <p className="t-small text-text-muted uppercase tracking-widest mb-1">Total Variance</p>
            <p className={`t-h1 ${totalVariance < 0 ? 'text-danger' : totalVariance > 0 ? 'text-[#2E7D32]' : 'text-text-primary'}`}>
              {totalVariance > 0 ? `+${totalVariance}` : totalVariance}
            </p>
          </div>
          <div className="card text-center">
            <p className="t-small text-text-muted uppercase tracking-widest mb-1">Date Range</p>
            <p className="t-label text-text-primary text-xs sm:text-sm">{startDate} → {endDate}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="card mb-6">
          <p className="t-h3 text-text-primary mb-3">Filter by Date Range</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block t-label text-text-primary mb-1">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="input-base"
              />
            </div>
            <div>
              <label className="block t-label text-text-primary mb-1">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="input-base"
              />
            </div>
            <div className="flex items-end">
              <button onClick={fetchInventory} className="btn-primary w-full">Apply</button>
            </div>
          </div>
        </div>

        {/* Table with horizontal scroll */}
        <div className="bg-white rounded-[10px] border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <div className="min-w-[640px]">
              <table className="w-full">
                <thead className="bg-bg-subtle border-b border-border">
                  <tr>
                    {['Item', 'Shifts', 'Total Opening', 'Total Sold', 'Total Remaining', 'Variance'].map(h => (
                      <th key={h} className={`p-3 t-label text-text-secondary whitespace-nowrap ${h === 'Item' ? 'text-left' : 'text-right'}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {inventory.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center p-10">
                        <Package size={32} className="mx-auto text-text-muted mb-2" />
                        <p className="t-body text-text-muted">No inventory data for this range</p>
                      </td>
                    </tr>
                  ) : (
                    inventory.map((row) => (
                      <tr key={row.item_name} className="border-b border-border hover:bg-bg-subtle">
                        <td className="p-3 t-body text-text-primary font-medium whitespace-nowrap">{row.item_name}</td>
                        <td className="p-3 t-mono text-text-secondary text-right">{row.shift_count}</td>
                        <td className="p-3 t-mono text-text-secondary text-right">{row.total_opening}</td>
                        <td className="p-3 t-mono text-[#2E7D32] text-right font-medium">{row.total_sold}</td>
                        <td className="p-3 t-mono text-text-primary text-right">{row.total_remaining}</td>
                        <td className={`p-3 t-mono text-right font-medium whitespace-nowrap ${
                          row.total_variance < 0 ? 'text-danger' :
                          row.total_variance > 0 ? 'text-[#2E7D32]' : 'text-text-muted'
                        }`}>
                          {row.total_variance > 0 ? `+${row.total_variance}` : row.total_variance}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                {inventory.length > 0 && (
                  <tfoot className="bg-bg-subtle border-t border-border">
                    <tr>
                      <td className="p-3 t-label text-text-primary">Total</td>
                      <td className="p-3 t-mono text-text-secondary text-right">—</td>
                      <td className="p-3 t-mono text-text-secondary text-right">{inventory.reduce((s, i) => s + i.total_opening, 0)}</td>
                      <td className="p-3 t-mono text-[#2E7D32] text-right font-medium">{totalSold}</td>
                      <td className="p-3 t-mono text-text-primary text-right">{inventory.reduce((s, i) => s + i.total_remaining, 0)}</td>
                      <td className={`p-3 t-mono text-right font-medium ${totalVariance < 0 ? 'text-danger' : totalVariance > 0 ? 'text-[#2E7D32]' : 'text-text-muted'}`}>
                        {totalVariance > 0 ? `+${totalVariance}` : totalVariance}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </div>

        {/* Most sold */}
        {inventory.length > 0 && (
          <div className="card mt-6">
            <div className="flex items-center gap-2 mb-4">
              <TrendingDown size={16} className="text-primary" />
              <p className="t-h3 text-text-primary">Top Selling Items</p>
            </div>
            <div className="space-y-3">
              {inventory.slice(0, 5).map((item, idx) => (
                <div key={item.item_name} className="flex items-center gap-3">
                  <span className="t-small text-text-muted w-5">{idx + 1}</span>
                  <div className="flex-1">
                    <div className="flex justify-between mb-1">
                      <p className="t-body text-text-primary truncate max-w-[60%]">{item.item_name}</p>
                      <p className="t-mono text-text-secondary flex-shrink-0 ml-2">{item.total_sold} sold</p>
                    </div>
                    <div className="progress-bar">
                      <div
                        className="progress-fill progress-fill-high"
                        style={{ width: `${totalSold > 0 ? (item.total_sold / totalSold) * 100 : 0}%` }}
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