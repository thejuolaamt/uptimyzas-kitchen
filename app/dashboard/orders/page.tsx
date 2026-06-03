'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getSession } from '@/lib/auth'
import { useToast } from '@/lib/toast'
import { Plus, Minus, Trash2, ShoppingCart, PackagePlus, X } from 'lucide-react'

type MenuItem = {
  id: string
  name: string
  category: string
  price: number
  unit: string
  available: boolean
}

type CartItem = {
  id: string
  name: string
  price: number
  unit: string
  quantity: number
}

type StockMap = {
  [itemId: string]: number
}

type StockRow = {
  id: string
  item_id: string
  item_name: string
  remaining_qty: number
  opening_qty: number
  sold_qty: number
  unit: string
}

// Orders Page Skeleton Component
function OrdersPageSkeleton() {
  return (
    <div className="min-h-screen bg-bg-subtle">
      <div className="bg-white border-b border-border sticky top-0 z-20">
        <div className="flex items-center justify-between px-4 pt-3 pb-2">
          <div className="skeleton h-5 w-24 rounded" />
          <div className="skeleton h-8 w-20 rounded-full" />
        </div>
        <div className="px-4 pb-3">
          <div className="flex gap-2 overflow-x-auto">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="skeleton h-8 w-20 rounded-full flex-shrink-0" />
            ))}
          </div>
        </div>
      </div>
      <div className="px-4 pt-4 pb-24 grid grid-cols-2 gap-3">
        {[1, 2, 3, 4, 5, 6].map(i => (
          <div key={i} className="bg-white rounded-[18px] border border-border p-4" style={{ minHeight: '100px' }}>
            <div className="space-y-2">
              <div className="skeleton h-6 w-32 rounded" />
              <div className="skeleton h-4 w-20 rounded" />
              <div className="flex justify-between items-center mt-2">
                <div className="skeleton h-5 w-16 rounded" />
                <div className="skeleton h-4 w-12 rounded" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function OrdersPage() {
  const router = useRouter()
  const toast = useToast()
  const [isRouterReady, setIsRouterReady] = useState(false)
  const [loading, setLoading] = useState(true)
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [cart, setCart] = useState<CartItem[]>([])
  const [stockMap, setStockMap] = useState<StockMap>({})
  const [stockRows, setStockRows] = useState<StockRow[]>([])
  const [showCart, setShowCart] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [showAddStock, setShowAddStock] = useState(false)
  const [addStockItem, setAddStockItem] = useState<StockRow | null>(null)
  const [addStockQty, setAddStockQty] = useState('')
  const [addingStock, setAddingStock] = useState(false)

  const activeShiftRef = useRef<any>(null)
  const sessionRef = useRef<any>(null)

  // Safe navigation function to prevent router errors
  const navigate = (path: string) => {
    if (isRouterReady) {
      router.push(path)
    } else {
      window.location.href = path
    }
  }

  useEffect(() => {
    setIsRouterReady(true)
  }, [])

  useEffect(() => {
    if (!isRouterReady) return
    
    const userSession = getSession()
    if (!userSession) {
      navigate('/auth/login')
      return
    }
    sessionRef.current = userSession

    const saved = localStorage.getItem('current_order_cart')
    if (saved) setCart(JSON.parse(saved))

    init()
  }, [isRouterReady])

  const init = async () => {
    try {
      setError(null)
      const today = new Date().toISOString().split('T')[0]
      console.log('Today date:', today)
      
      const { data, error } = await supabase
        .from('shift_sessions')
        .select('*, shifts(*)')
        .eq('shift_date', today)
        .eq('status', 'open')
        .maybeSingle()

      if (error) {
        console.error('Error fetching shift:', error)
        setError('Error loading shift: ' + error.message)
        toast('Error loading shift: ' + error.message, 'error')
        setLoading(false)
        return
      }

      if (!data) {
        console.log('No active shift found for today')
        setError('No active shift. Please open a shift first.')
        toast('No active shift. Please open a shift first.', 'warning')
        setLoading(false)
        return
      }

      console.log('Active shift found:', data)
      console.log('Shift ID:', data.shift_id)
      activeShiftRef.current = data

      await fetchMenuItems()
      await fetchStock(data.shift_id)
      
      setLoading(false)
    } catch (err) {
      console.error('Init error:', err)
      setError('Failed to load orders page')
      toast('Failed to load orders page', 'error')
      setLoading(false)
    }
  }

  const fetchMenuItems = async () => {
    const { data, error } = await supabase
      .from('menu_items')
      .select('*')
      .eq('available', true)
      .order('category', { ascending: true })

    if (error) {
      console.error('Error fetching menu:', error)
      toast('Error loading menu', 'error')
      return
    }

    if (data) {
      console.log('Menu items loaded:', data.length)
      setMenuItems(data)
      setCategories(['All', ...new Set(data.map(i => i.category))])
    }
  }

  const fetchStock = async (shiftId: string) => {
    const today = new Date().toISOString().split('T')[0]
    
    console.log('Fetching stock for shift_id:', shiftId, 'date:', today)
    
    const { data, error } = await supabase
      .from('shift_stock')
      .select('id, item_id, item_name, remaining_qty, opening_qty, sold_qty, unit')
      .eq('shift_date', today)
      .eq('shift_id', shiftId)

    if (error) {
      console.error('Error fetching stock:', error)
      toast('Error loading stock data: ' + error.message, 'error')
      return
    }
    
    console.log('Stock records found:', data?.length || 0)
    
    if (data && data.length > 0) {
      setStockRows(data)
      const map: StockMap = {}
      data.forEach(row => { map[row.item_id] = row.remaining_qty })
      setStockMap(map)
      console.log('Stock map created with', Object.keys(map).length, 'items')
    } else {
      console.warn('No stock records found for this shift!')
      setError('No stock data found. Please close and reopen the shift.')
      toast('No stock data found. Please close and reopen the shift.', 'warning')
    }
  }

  const saveCart = (newCart: CartItem[]) => {
    localStorage.setItem('current_order_cart', JSON.stringify(newCart))
    setCart(newCart)
  }

  const getRemainingAfterCart = (itemId: string) => {
    const stock = stockMap[itemId] ?? 0
    const inCart = cart.find(c => c.id === itemId)?.quantity ?? 0
    return stock - inCart
  }

  const tapItem = (item: MenuItem) => {
    const remaining = getRemainingAfterCart(item.id)
    if (remaining <= 0) {
      toast(`${item.name} is out of stock`, 'warning')
      return
    }
    const existing = cart.find(c => c.id === item.id)
    const newCart = existing
      ? cart.map(c => c.id === item.id ? { ...c, quantity: c.quantity + 1 } : c)
      : [...cart, { id: item.id, name: item.name, price: item.price, unit: item.unit, quantity: 1 }]
    saveCart(newCart)
  }

  const updateQty = (itemId: string, delta: number) => {
    if (delta > 0) {
      const remaining = getRemainingAfterCart(itemId)
      if (remaining <= 0) {
        toast('No more stock available for this item', 'warning')
        return
      }
    }
    const item = cart.find(c => c.id === itemId)
    if (!item) return
    const newCart = item.quantity + delta <= 0
      ? cart.filter(c => c.id !== itemId)
      : cart.map(c => c.id === itemId ? { ...c, quantity: c.quantity + delta } : c)
    saveCart(newCart)
  }

  const handleAddStock = async () => {
    if (!addStockItem || !addStockQty) return
    const qty = parseInt(addStockQty)
    if (isNaN(qty) || qty <= 0) {
      toast('Enter a valid quantity', 'warning')
      return
    }

    setAddingStock(true)
    const shift = activeShiftRef.current

    const { error } = await supabase
      .from('shift_stock')
      .update({
        opening_qty: addStockItem.opening_qty + qty,
        remaining_qty: addStockItem.remaining_qty + qty,
      })
      .eq('id', addStockItem.id)

    if (error) {
      toast('Error updating stock: ' + error.message, 'error')
      setAddingStock(false)
      return
    }

    const today = new Date().toISOString().split('T')[0]
    const session = sessionRef.current
    await supabase.from('shift_activities').insert({
      shift_date: today,
      shift_id: shift.shift_id,
      staff_id: session.id,
      staff_name: `${session.first_name} ${session.surname}`,
      staff_role: session.role,
      action_type: 'ADD_STOCK',
      action_details: {
        item_name: addStockItem.item_name,
        qty_added: qty,
      },
    })

    toast(`${qty} ${addStockItem.unit}(s) added to ${addStockItem.item_name}`, 'success')
    await fetchStock(shift.shift_id)
    setShowAddStock(false)
    setAddStockItem(null)
    setAddingStock(false)
  }

  const cartCount = cart.reduce((s, i) => s + i.quantity, 0)
  const cartTotal = cart.reduce((s, i) => s + i.price * i.quantity, 0)
  const filteredItems = selectedCategory === 'All'
    ? menuItems
    : menuItems.filter(i => i.category === selectedCategory)

  if (loading) {
    return <OrdersPageSkeleton />
  }

  if (error) {
    return (
      <div className="min-h-screen bg-bg-subtle flex items-center justify-center p-4">
        <div className="card text-center max-w-sm">
          <div className="text-danger text-4xl mb-3">⚠️</div>
          <p className="t-h3 text-text-primary mb-2">Unable to load orders</p>
          <p className="t-body text-text-secondary mb-4">{error}</p>
          <button 
            onClick={() => navigate('/dashboard')}
            className="btn-primary w-full"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-bg-subtle pb-32">
      {/* Sticky header - flush with top */}
      <div className="bg-white border-b border-border sticky top-0 z-20">
        <div className="flex items-center justify-between px-4 pt-3 pb-2">
          <p className="t-small font-medium text-primary">
            {activeShiftRef.current?.shifts?.name || 'Active'} Shift
          </p>
          <button
            onClick={() => setShowAddStock(true)}
            className="flex items-center gap-1.5 bg-primary/10 text-primary px-3 py-1.5 rounded-full t-small font-medium min-h-0"
          >
            <PackagePlus size={14} />
            Add Stock
          </button>
        </div>
        
        {/* Categories scroll */}
        <div className="overflow-x-auto scrollbar-none px-4 pb-3">
          <div className="flex gap-2 whitespace-nowrap">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-1.5 rounded-full t-label transition-all min-h-0 min-w-0 flex-shrink-0 ${
                  selectedCategory === cat
                    ? 'bg-primary text-white shadow-sm'
                    : 'bg-bg-subtle text-text-secondary border border-border hover:bg-border/50'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Menu grid */}
      <div className="px-4 pt-4 pb-24 grid grid-cols-2 gap-3">
        {filteredItems.length === 0 ? (
          <div className="col-span-2 text-center py-16">
            <p className="t-body text-text-muted">No items in this category</p>
          </div>
        ) : (
          filteredItems.map(item => {
            const cartItem = cart.find(c => c.id === item.id)
            const inCart = !!cartItem
            const remaining = getRemainingAfterCart(item.id)
            const stockTotal = stockMap[item.id] ?? 0
            const outOfStock = stockTotal <= 0
            const maxedOut = remaining <= 0 && inCart

            return (
              <button
                key={item.id}
                onClick={() => tapItem(item)}
                disabled={outOfStock || maxedOut}
                className={`relative text-left p-4 rounded-[18px] border-2 transition-all active:scale-95 ${
                  outOfStock || maxedOut
                    ? 'bg-bg-subtle border-border opacity-50 cursor-not-allowed'
                    : inCart
                    ? 'bg-primary/5 border-primary'
                    : 'bg-white border border-border shadow-sm'
                }`}
                style={{ minHeight: '100px' }}
              >
                {inCart && !outOfStock && (
                  <span className="absolute top-3 right-3 w-6 h-6 rounded-full bg-primary text-white text-[11px] font-semibold flex items-center justify-center shadow-sm">
                    {cartItem!.quantity}
                  </span>
                )}

                {outOfStock && (
                  <span className="absolute top-3 right-3 bg-border text-text-muted text-[10px] font-medium px-2 py-0.5 rounded-full">
                    Out
                  </span>
                )}

                <p className="t-h3 text-text-primary leading-snug pr-8">
                  {item.name}
                </p>
                <p className="t-small text-text-muted mt-0.5">{item.unit}</p>
                <div className="flex items-center justify-between mt-2">
                  <p className="t-label text-primary font-semibold">
                    ₦{item.price.toLocaleString()}
                  </p>
                  {!outOfStock && (
                    <p className="t-small text-text-muted">
                      {remaining > 0 ? `${remaining} left` : 'Max added'}
                    </p>
                  )}
                </div>
              </button>
            )
          })
        )}
      </div>

      {/* Persistent cart bar */}
      {cartCount > 0 && (
        <div className="fixed bottom-0 left-0 right-0 px-4 py-3 z-30 bg-gradient-to-t from-bg-subtle via-bg-subtle to-transparent">
          <button
            onClick={() => setShowCart(true)}
            className="w-full bg-primary rounded-[16px] px-5 py-4 flex items-center justify-between shadow-lg active:scale-[0.98] transition-transform"
          >
            <div className="flex items-center gap-3">
              <div className="relative">
                <ShoppingCart size={20} className="text-white" />
                <span className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-white text-primary text-[10px] font-bold flex items-center justify-center">
                  {cartCount}
                </span>
              </div>
              <span className="t-label text-white font-medium">View Order</span>
            </div>
            <span className="t-h3 text-white">₦{cartTotal.toLocaleString()}</span>
          </button>
        </div>
      )}

      {/* Cart drawer */}
      {showCart && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/40">
          <div className="bg-white w-full rounded-t-[24px] max-h-[88vh] flex flex-col">
            <div className="px-5 pt-4 pb-3 border-b border-border flex-shrink-0">
              <div className="w-10 h-1 rounded-full bg-border mx-auto mb-4" />
              <div className="flex justify-between items-center">
                <p className="t-h2 text-text-primary">Your Order</p>
                <button
                  onClick={() => setShowCart(false)}
                  className="text-text-muted min-h-0 min-w-0 w-9 h-9 flex items-center justify-center rounded-full hover:bg-bg-subtle"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="overflow-y-auto flex-1 px-5 py-3 divide-y divide-border">
              {cart.map(item => {
                const stockRemaining = stockMap[item.id] ?? 0
                const canAddMore = (stockRemaining - item.quantity) > 0
                return (
                  <div key={item.id} className="flex items-center gap-3 py-3">
                    <div className="flex-1 min-w-0">
                      <p className="t-body text-text-primary font-medium truncate">
                        {item.name}
                      </p>
                      <p className="t-small text-text-secondary">
                        ₦{item.price.toLocaleString()} each
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => updateQty(item.id, -1)}
                        className="w-8 h-8 min-h-0 min-w-0 rounded-full bg-bg-subtle flex items-center justify-center active:bg-border"
                      >
                        {item.quantity === 1
                          ? <Trash2 size={14} className="text-danger" />
                          : <Minus size={14} className="text-text-secondary" />
                        }
                      </button>
                      <span className="t-mono w-5 text-center font-medium">{item.quantity}</span>
                      <button
                        onClick={() => updateQty(item.id, 1)}
                        disabled={!canAddMore}
                        className={`w-8 h-8 min-h-0 min-w-0 rounded-full flex items-center justify-center ${
                          canAddMore ? 'bg-primary' : 'bg-border cursor-not-allowed'
                        }`}
                      >
                        <Plus size={14} className="text-white" />
                      </button>
                    </div>
                    <p className="t-mono text-text-primary w-20 text-right flex-shrink-0">
                      ₦{(item.price * item.quantity).toLocaleString()}
                    </p>
                  </div>
                )
              })}
            </div>

            <div className="px-5 py-4 border-t border-border flex-shrink-0 space-y-3">
              <div className="flex justify-between items-center">
                <p className="t-h3 text-text-secondary">
                  {cartCount} item{cartCount !== 1 ? 's' : ''}
                </p>
                <p className="t-h1 text-primary">₦{cartTotal.toLocaleString()}</p>
              </div>
              <button
                onClick={() => {
                  setShowCart(false)
                  navigate('/dashboard/payment')
                }}
                className="btn-primary w-full"
              >
                Proceed to Payment
              </button>
              <button
                onClick={() => { saveCart([]); setShowCart(false) }}
                className="w-full t-small text-text-muted text-center py-1"
              >
                Clear order
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add stock modal */}
      {showAddStock && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/40">
          <div className="bg-white w-full rounded-t-[24px] max-h-[85vh] flex flex-col">
            <div className="px-5 pt-4 pb-3 border-b border-border flex-shrink-0">
              <div className="w-10 h-1 rounded-full bg-border mx-auto mb-4" />
              <div className="flex justify-between items-center">
                <div>
                  <p className="t-h2 text-text-primary">Top Up Stock</p>
                  <p className="t-small text-text-secondary mt-0.5">
                    Add more units to any item mid-shift
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowAddStock(false)
                    setAddStockItem(null)
                  }}
                  className="text-text-muted min-h-0 min-w-0 w-9 h-9 flex items-center justify-center rounded-full hover:bg-bg-subtle"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {!addStockItem ? (
              <div className="overflow-y-auto flex-1 px-5 py-3 divide-y divide-border">
                {stockRows.length === 0 ? (
                  <p className="t-body text-text-muted text-center py-10">
                    No stock data available
                  </p>
                ) : (
                  stockRows
                    .sort((a, b) => a.item_name.localeCompare(b.item_name))
                    .map(row => (
                      <button
                        key={row.id}
                        onClick={() => setAddStockItem(row)}
                        className="w-full flex justify-between items-center py-3.5 min-h-0 text-left"
                      >
                        <div>
                          <p className="t-body text-text-primary font-medium">{row.item_name}</p>
                          <p className="t-small text-text-muted">{row.unit}</p>
                        </div>
                        <div className="text-right">
                          <p className={`t-mono font-semibold ${
                            row.remaining_qty <= 0 ? 'text-danger' : 'text-text-primary'
                          }`}>
                            {row.remaining_qty} remaining
                          </p>
                          <p className="t-small text-text-muted">
                            {row.sold_qty} sold
                          </p>
                        </div>
                      </button>
                    ))
                )}
              </div>
            ) : (
              <div className="px-5 py-6 space-y-5 flex-1">
                <div className="bg-primary/5 border border-primary/20 rounded-[14px] p-4">
                  <p className="t-h3 text-primary">{addStockItem.item_name}</p>
                  <div className="flex gap-4 mt-2">
                    <div>
                      <p className="t-small text-text-muted">Currently remaining</p>
                      <p className="t-mono font-semibold text-text-primary">
                        {addStockItem.remaining_qty} {addStockItem.unit}(s)
                      </p>
                    </div>
                    <div>
                      <p className="t-small text-text-muted">Sold this shift</p>
                      <p className="t-mono font-semibold text-text-primary">
                        {addStockItem.sold_qty}
                      </p>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block t-label text-text-primary mb-2">
                    How many to add?
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={addStockQty}
                    onChange={(e) => {
                      const value = e.target.value.replace(/[^0-9]/g, '')
                      setAddStockQty(value)
                    }}
                    className="input-base text-center text-2xl font-semibold"
                    placeholder="0"
                    min="1"
                    autoFocus
                  />
                  {addStockQty && parseInt(addStockQty) > 0 && (
                    <p className="t-small text-text-secondary mt-2 text-center">
                      New total will be{' '}
                      <span className="font-semibold text-primary">
                        {addStockItem.remaining_qty + parseInt(addStockQty)} {addStockItem.unit}(s)
                      </span>
                    </p>
                  )}
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setAddStockItem(null)}
                    className="btn-secondary flex-1"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleAddStock}
                    disabled={addingStock || !addStockQty || parseInt(addStockQty) <= 0}
                    className="btn-primary flex-1"
                  >
                    {addingStock ? 'Adding...' : 'Confirm'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}