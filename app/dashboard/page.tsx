'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getSession } from '@/lib/auth'
import { useToast } from '@/lib/toast'
import { Package, Receipt, Users, TrendingUp, AlertCircle, CheckCircle, Loader2 } from 'lucide-react'

type MenuItem = {
  id: string
  name: string
  category: string
  price: number
  unit: string
  available: boolean
}

type Shift = {
  id: string
  name: string
  start_time: string
  end_time: string
}

export default function DashboardPage() {
  const router = useRouter()
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState<any>(null)
  const [stats, setStats] = useState({
    todayOrders: 0,
    todayRevenue: 0,
    activeStaff: 0,
    lowStockItems: 0,
  })
  const [hasActiveShift, setHasActiveShift] = useState(false)
  const [showShiftModal, setShowShiftModal] = useState(false)
  const [selectedShift, setSelectedShift] = useState<string>('')
  const [shifts, setShifts] = useState<Shift[]>([])
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [stockQuantities, setStockQuantities] = useState<Record<string, string>>({})
  const [openingShift, setOpeningShift] = useState(false)

  useEffect(() => {
    const userSession = getSession()
    if (!userSession) {
      router.push('/auth/login')
      return
    }
    setSession(userSession)
    loadDashboard()
  }, [router])

  const loadDashboard = async () => {
    try {
      setLoading(true)
      const today = new Date().toISOString().split('T')[0]

      // Check active shift
      const { data: activeShift } = await supabase
        .from('shift_sessions')
        .select('id')
        .eq('shift_date', today)
        .eq('status', 'open')
        .maybeSingle()

      setHasActiveShift(!!activeShift)

      if (activeShift) {
        await loadStats(today)
      }

      // Load shifts for modal
      const { data: shiftData } = await supabase
        .from('shifts')
        .select('*')
        .order('start_time')

      setShifts(shiftData || [])

      // Load menu items for stock setup
      const { data: menuData } = await supabase
        .from('menu_items')
        .select('*')
        .eq('available', true)
        .order('category')

      setMenuItems(menuData || [])
      
      const initialStock: Record<string, string> = {}
      menuData?.forEach(item => {
        initialStock[item.id] = ''
      })
      setStockQuantities(initialStock)

    } catch (error) {
      console.error('Error loading dashboard:', error)
      toast('Failed to load dashboard data', 'error')
    } finally {
      setLoading(false)
    }
  }

  const loadStats = async (today: string) => {
    try {
      const { count: orderCount } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('shift_date', today)

      const { data: orders } = await supabase
        .from('orders')
        .select('total')
        .eq('shift_date', today)

      const totalRevenue = orders?.reduce((sum, o) => sum + o.total, 0) || 0

      const { count: staffCount } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active')

      const { data: lowStock } = await supabase
        .from('shift_stock')
        .select('item_name, remaining_qty')
        .eq('shift_date', today)
        .lt('remaining_qty', 5)

      setStats({
        todayOrders: orderCount || 0,
        todayRevenue: totalRevenue,
        activeStaff: staffCount || 0,
        lowStockItems: lowStock?.length || 0,
      })
    } catch (error) {
      console.error('Error loading stats:', error)
    }
  }

  const handleOpenShift = async () => {
    if (!selectedShift) {
      toast('Please select a shift', 'warning')
      return
    }

    const hasStock = Object.values(stockQuantities).some(q => parseInt(q) > 0)
    if (!hasStock) {
      toast('Please enter opening stock quantities for at least one item', 'warning')
      return
    }

    setOpeningShift(true)
    const today = new Date().toISOString().split('T')[0]

    try {
      const shift = shifts.find(s => s.id === selectedShift)
      if (!shift) throw new Error('Shift not found')

      // 1. Create the shift session
      const { data: shiftData, error: shiftError } = await supabase
        .from('shift_sessions')
        .insert({
          shift_date: today,
          shift_id: selectedShift,
          status: 'open',
          opener_staff_id: session.id,
          opened_at: new Date().toISOString(),
        })
        .select()
        .single()

      if (shiftError) throw new Error(shiftError.message)

      // 2. Prepare stock data for batch insert
      const stockData = menuItems
        .filter(item => {
          const qty = parseInt(stockQuantities[item.id] || '0')
          return qty > 0
        })
        .map(item => ({
          shift_date: today,
          shift_id: selectedShift,
          item_id: item.id,
          item_name: item.name,
          opening_qty: parseInt(stockQuantities[item.id] || '0'),
          remaining_qty: parseInt(stockQuantities[item.id] || '0'),
          sold_qty: 0,
          unit: item.unit,
          opener_staff_id: session.id,
        }))

      if (stockData.length === 0) {
        throw new Error('No stock items with quantity > 0')
      }

      // Batch insert - atomic operation
      const { error: stockError } = await supabase
        .from('shift_stock')
        .insert(stockData)

      if (stockError) {
        // Rollback: delete the shift session
        await supabase
          .from('shift_sessions')
          .delete()
          .eq('id', shiftData.id)
        
        throw new Error(`Failed to add stock: ${stockError.message}`)
      }

      // 3. Log the activity
      await supabase.from('shift_activities').insert({
        shift_date: today,
        shift_id: selectedShift,
        staff_id: session.id,
        staff_name: `${session.first_name} ${session.surname}`,
        staff_role: session.role,
        action_type: 'OPEN_SHIFT',
        action_details: {
          shift_name: shift.name,
          items_count: stockData.length,
        },
      })

      toast(`Shift opened successfully with ${stockData.length} items`, 'success')
      setShowShiftModal(false)
      setHasActiveShift(true)
      await loadStats(today)

    } catch (error: any) {
      console.error('Error opening shift:', error)
      toast(error.message || 'Failed to open shift', 'error')
    } finally {
      setOpeningShift(false)
    }
  }

  const handleCloseShift = async () => {
    router.push('/dashboard/close-shift')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-bg-subtle flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-bg-subtle">
      <div className="p-4 space-y-4">
        {/* Welcome Section */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <h1 className="text-xl font-bold text-text-primary">
            Welcome back, {session?.first_name || 'Staff'}!
          </h1>
          <p className="text-sm text-text-secondary">
            {new Date().toLocaleDateString('en-NG', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}
          </p>
        </div>

        {/* Shift Status */}
        <div className={`rounded-2xl p-4 shadow-sm ${
          hasActiveShift ? 'bg-[#2E7D32]/10 border border-[#2E7D32]/20' : 'bg-warning/10 border border-warning/20'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {hasActiveShift ? (
                <CheckCircle size={24} className="text-[#2E7D32]" />
              ) : (
                <AlertCircle size={24} className="text-warning" />
              )}
              <div>
                <p className={`font-semibold ${
                  hasActiveShift ? 'text-[#2E7D32]' : 'text-warning'
                }`}>
                  {hasActiveShift ? 'Shift Active' : 'No Active Shift'}
                </p>
                <p className="text-sm text-text-secondary">
                  {hasActiveShift 
                    ? 'You can take orders and manage stock' 
                    : 'Open a shift to start taking orders'}
                </p>
              </div>
            </div>
            {!hasActiveShift ? (
              <button
                onClick={() => setShowShiftModal(true)}
                className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium"
              >
                Open Shift
              </button>
            ) : (
              <button
                onClick={handleCloseShift}
                className="bg-danger text-white px-4 py-2 rounded-lg text-sm font-medium"
              >
                Close Shift
              </button>
            )}
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <Receipt size={20} className="text-primary" />
              <span className="text-xs text-text-secondary">Today</span>
            </div>
            <p className="text-2xl font-bold text-text-primary mt-1">{stats.todayOrders}</p>
            <p className="text-xs text-text-secondary">Orders</p>
          </div>
          
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <TrendingUp size={20} className="text-[#2E7D32]" />
              <span className="text-xs text-text-secondary">Today</span>
            </div>
            <p className="text-2xl font-bold text-text-primary mt-1">₦{stats.todayRevenue.toLocaleString()}</p>
            <p className="text-xs text-text-secondary">Revenue</p>
          </div>
          
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <Users size={20} className="text-blue-500" />
              <span className="text-xs text-text-secondary">Active</span>
            </div>
            <p className="text-2xl font-bold text-text-primary mt-1">{stats.activeStaff}</p>
            <p className="text-xs text-text-secondary">Staff</p>
          </div>
          
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <Package size={20} className="text-warning" />
              <span className="text-xs text-text-secondary">Low Stock</span>
            </div>
            <p className="text-2xl font-bold text-text-primary mt-1">{stats.lowStockItems}</p>
            <p className="text-xs text-text-secondary">Items</p>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => router.push('/dashboard/orders')}
            disabled={!hasActiveShift}
            className={`p-4 rounded-xl text-left transition-all ${
              hasActiveShift 
                ? 'bg-primary text-white hover:shadow-lg active:scale-95' 
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            <p className="font-semibold">Take Order</p>
            <p className="text-sm opacity-80">Start a new order</p>
          </button>
          
          <button
            onClick={() => router.push('/dashboard/stock')}
            disabled={!hasActiveShift}
            className={`p-4 rounded-xl text-left transition-all ${
              hasActiveShift 
                ? 'bg-white border border-primary text-primary hover:shadow-lg active:scale-95' 
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            <p className="font-semibold">Manage Stock</p>
            <p className="text-sm opacity-80">View and update stock</p>
          </button>
        </div>
      </div>

      {/* Open Shift Modal */}
      {showShiftModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end md:items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-t-2xl md:rounded-2xl max-h-[90vh] flex flex-col">
            <div className="px-5 pt-4 pb-3 border-b border-border flex-shrink-0">
              <div className="w-10 h-1 rounded-full bg-border mx-auto mb-4 md:hidden" />
              <div className="flex justify-between items-center">
                <div>
                  <p className="t-h2 text-text-primary">Open Shift</p>
                  <p className="t-small text-text-secondary mt-0.5">
                    Select shift and set opening stock
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowShiftModal(false)
                    setSelectedShift('')
                  }}
                  className="text-text-muted w-9 h-9 flex items-center justify-center rounded-full hover:bg-bg-subtle"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
              {/* Shift Selection */}
              <div>
                <label className="block t-label text-text-primary mb-2">
                  Select Shift
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {shifts.map(shift => (
                    <button
                      key={shift.id}
                      onClick={() => setSelectedShift(shift.id)}
                      className={`p-3 rounded-xl border-2 text-left transition-all ${
                        selectedShift === shift.id
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <p className="font-medium text-text-primary">{shift.name}</p>
                      <p className="text-xs text-text-secondary">
                        {shift.start_time} - {shift.end_time}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Opening Stock */}
              {selectedShift && (
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="t-label text-text-primary">
                      Opening Stock Quantities
                    </label>
                    <span className="text-xs text-text-secondary">
                      Enter 0 for items not in stock
                    </span>
                  </div>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {menuItems.map(item => (
                      <div key={item.id} className="flex items-center gap-3">
                        <span className="text-sm text-text-primary flex-1">{item.name}</span>
                        <span className="text-xs text-text-secondary">{item.unit}</span>
                        <input
                          type="number"
                          min="0"
                          value={stockQuantities[item.id] || ''}
                          onChange={(e) => {
                            setStockQuantities(prev => ({
                              ...prev,
                              [item.id]: e.target.value
                            }))
                          }}
                          className="w-20 px-2 py-1.5 text-center border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                          placeholder="0"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="px-5 py-4 border-t border-border flex-shrink-0">
              <button
                onClick={handleOpenShift}
                disabled={openingShift || !selectedShift}
                className="w-full bg-primary text-white py-3 rounded-xl font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {openingShift ? (
                  <>
                    <Loader2 size={20} className="animate-spin" />
                    Opening Shift...
                  </>
                ) : (
                  'Open Shift'
                )}
              </button>
              {!selectedShift && (
                <p className="text-xs text-warning text-center mt-2">
                  Please select a shift
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}