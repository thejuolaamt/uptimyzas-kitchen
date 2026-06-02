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
  [itemId: string]: number // remaining_qty per item
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

export default function OrdersPage() {
  const router = useRouter()
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [cart, setCart] = useState<CartItem[]>([])
  const [stockMap, setStockMap] = useState<StockMap>({})
  const [stockRows, setStockRows] = useState<StockRow[]>([])
  const [showCart, setShowCart] = useState(false)

  // Add stock modal
  const [showAddStock, setShowAddStock] = useState(false)
  const [addStockItem, setAddStockItem] = useState<StockRow | null>(null)
  const [addStockQty, setAddStockQty] = useState('')
  const [addingStock, setAddingStock] = useState(false)

  const activeShiftRef = useRef<any>(null)
  const sessionRef = useRef<any>(null)

  useEffect(() => {
    const userSession = getSession()
    if (!userSession) {
      router.push('/auth/login')
      return
    }
    sessionRef.current = userSession

    const saved = localStorage.getItem('current_order_cart')
    if (saved) setCart(JSON.parse(saved))

    init()
  }, [router])

  const init = async () => {
    const today = new Date().toISOString().split('T')[0]
    const { data, error } = await supabase
      .from('shift_sessions')
      .select('*, shifts(*)')
      .eq('shift_date', today)
      .eq('status', 'open')
      .single()

    if (!data || error) {
      toast('No active shift. Please open a shift first.', 'warning')
      router.push('/dashboard')
      return
    }

    activeShiftRef.current = data

    await Promise.all([fetchMenuItems(), fetchStock(data.shift_id)])
    subscribeToStock(data.shift_id)
    setLoading(false)
  }

  const fetchMenuItems = async () => {
    const { data } = await supabase
      .from('menu_items')
      .select('*')
      .eq('available', true)
      .order('category', { ascending: true })

    if (data) {
      setMenuItems(data)
      setCategories(['All', ...new Set(data.map(i => i.category))])
    }
  }

  const fetchStock = async (shiftId: string) => {
    const today = new Date().toISOString().split('T')[0]
    const { data } = await supabase
      .from('shift_stock')
      .select('id, item_id, item_name, remaining_qty, opening_qty, sold_qty, unit')
      .eq('shift_date', today)
      .eq('shift_id', shiftId)

    if (data) {
      setStockRows(data)
      const map: StockMap = {}
      data.forEach(row => { map[row.item_id] = row.remaining_qty })
      setStockMap(map)
    }
  }

  const subscribeToStock = (shiftId: string) => {
    const today = new Date().toISOString().split('T')[0]
    supabase
      .channel(`orders-stock-${shiftId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'shift_stock',
          filter: `shift_date=eq.${today}`,
        },
        (payload) => {
          setStockMap(prev => ({
            ...prev,
            [payload.new.item_id]: payload.new.remaining_qty,
          }))
          setStockRows(prev =>
            prev.map(r => r.item_id === payload.new.item_id ? { ...r, ...payload.new } : r)
          )
        }
      )
      .subscribe()
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

  // Mid-shift stock top-up
  const openAddStock = (stockRow: StockRow) => {
    setAddStockItem(stockRow)
    setAddStockQty('')
    setShowAddStock(true)
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
        opening_qty:   addStockItem.opening_qty + qty,
        remaining_qty: addStockItem.remaining_qty + qty,
      })
      .eq('id', addStockItem.id)

    if (error) {
      toast('Error updating stock: ' + error.message, 'error')
      setAddingStock(false)
      return
    }

    // Log the top-up as a shift activity
    const today = new Date().toISOString().split('T')[0]
    const session = sessionRef.current
    await supabase.from('shift_activities').insert({
      shift_date:     today,
      shift_id:       shift.shift_id,
      staff_id:       session.id,
      staff_name:     `${session.first_name} ${session.surname}`,
      staff_role:     session.role,
      action_type:    'ADD_STOCK',
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
    return (
      <div className="min-h-screen bg-bg-subtle flex items-center justify-center">
        <div className="w-7 h-7 border-[3px] border-border border-t-primary rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div
      className="min-h-screen bg-bg-subtle"
      style={{ paddingBottom: cartCount > 0 ? '148px' : '88px' }}
    >

      {/* Sticky category strip */}
      <div className="bg-white border-b border-border sticky top-14 z-10">
        <div className="flex items-center justify-between px-4 pt-2.5 pb-1">
          <p className="t-small text-text-muted">
            {activeShiftRef.current?.shifts?.name} Shift
          </p>
          {/* Add stock button */}
          <button
            onClick={() => setShowAddStock(true)}
            className="flex items-center gap-1.5 text-primary t-small font-medium min-h-0 min-w-0 py-1"
          >
            <PackagePlus size={15} />
            Add Stock
          </button>
        </div>
        <div className="overflow-x-auto scrollbar-none">
          <div className="flex whitespace-nowrap px-4 pb-3 gap-2">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-1.5 rounded-full t-label transition-colors min-h-0 min-w-0 flex-shrink-0 ${
                  selectedCategory === cat
                    ? 'bg-primary text-white'
                    : 'bg-bg-subtle text-text-secondary border border-border'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Menu grid */}
      <div className="px-4 pt-4 grid grid-cols-2 gap-3">
        {filteredItems.length === 0 ? (
          <div className="col-span-2 text-center py-16">
            <p className="t-body text-text-muted">No items in this category</p>
          </div>
        ) : (
          filteredItems.map(item => {
            const cartItem   = cart.find(c => c.id === item.id)
            const inCart     = !!cartItem
            const remaining  = getRemainingAfterCart(item.id)
            const stockTotal = stockMap[item.id] ?? 0
            const outOfStock = stockTotal <= 0
            const maxedOut   = remaining <= 0 && inCart

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
                    : 'bg-white border-transparent'
                }`}
                style={{ minHeight: '100px' }}
              >
                {/* Cart qty badge */}
                {inCart && !outOfStock && (
                  <span className="absolute top-3 right-3 w-6 h-6 rounded-full bg-primary text-white text-[11px] font-semibold flex items-center justify-center">
                    {cartItem!.quantity}
                  </span>
                )}

                {/* Out of stock badge */}
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
        <div className="fixed bottom-[68px] left-0 right-0 px-4 z-20 pb-2">
          <button
            onClick={() => setShowCart(true)}
            className="w-full bg-primary rounded-[16px] px-5 py-4 flex items-center justify-between shadow-lg active:scale-[0.98] transition-transform"
          >
            <div className="flex items-center gap-3">
              <div className="relative">
                <ShoppingCart size={20} className="text-white" />
                <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-white text-primary text-[9px] font-bold flex items-center justify-center">
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
                  router.push('/dashboard/payment')
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

            {/* Item selector — if no item selected yet */}
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
              /* Qty input — once item is selected */
              <div className="px-5 py-6 space-y-5 flex-1">
                {/* Selected item summary */}
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
                    type="number"
                    value={addStockQty}
                    onChange={(e) => setAddStockQty(e.target.value)}
                    className="input-base text-center text-2xl font-semibold"
                    placeholder="0"
                    inputMode="numeric"
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