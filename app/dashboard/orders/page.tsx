'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getSession } from '@/lib/auth'
import { useToast } from '@/lib/toast'
import { Plus, Minus, Trash2, ShoppingCart } from 'lucide-react'

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

export default function OrdersPage() {
  const router = useRouter()
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [cart, setCart] = useState<CartItem[]>([])
  const [activeShift, setActiveShift] = useState<any>(null)
  const [showCart, setShowCart] = useState(false)

  useEffect(() => {
    const userSession = getSession()
    if (!userSession) {
      router.push('/auth/login')
      return
    }
    checkActiveShift()
    fetchMenuItems()
    const saved = localStorage.getItem('current_order_cart')
    if (saved) setCart(JSON.parse(saved))
  }, [router])

  const saveCart = (newCart: CartItem[]) => {
    localStorage.setItem('current_order_cart', JSON.stringify(newCart))
    setCart(newCart)
  }

  const checkActiveShift = async () => {
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
    setActiveShift(data)
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

  const getCartItem = (id: string) => cart.find(c => c.id === id)
  const cartCount   = cart.reduce((s, i) => s + i.quantity, 0)
  const cartTotal   = cart.reduce((s, i) => s + i.price * i.quantity, 0)

  const tapItem = (item: MenuItem) => {
    const existing = getCartItem(item.id)
    const newCart = existing
      ? cart.map(c => c.id === item.id ? { ...c, quantity: c.quantity + 1 } : c)
      : [...cart, { id: item.id, name: item.name, price: item.price, unit: item.unit, quantity: 1 }]
    saveCart(newCart)
  }

  const updateQty = (itemId: string, delta: number) => {
    const item = getCartItem(itemId)
    if (!item) return
    const newCart = item.quantity + delta <= 0
      ? cart.filter(c => c.id !== itemId)
      : cart.map(c => c.id === itemId ? { ...c, quantity: c.quantity + delta } : c)
    saveCart(newCart)
  }

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

      {/* Shift label + category strip */}
      <div className="bg-white border-b border-border sticky top-14 z-10">
        <div className="px-4 pt-3 pb-1">
          <p className="t-small text-text-muted">
            {activeShift?.shifts?.name} Shift
          </p>
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

      {/* Menu grid — tap to add */}
      <div className="px-4 pt-4 grid grid-cols-2 gap-3">
        {filteredItems.length === 0 ? (
          <div className="col-span-2 text-center py-16">
            <p className="t-body text-text-muted">No items in this category</p>
          </div>
        ) : (
          filteredItems.map(item => {
            const cartItem = getCartItem(item.id)
            const inCart   = !!cartItem

            return (
              <button
                key={item.id}
                onClick={() => tapItem(item)}
                className={`relative text-left p-4 rounded-[18px] border-2 transition-all active:scale-95 ${
                  inCart
                    ? 'bg-primary/5 border-primary'
                    : 'bg-white border-transparent'
                }`}
                style={{ minHeight: '100px' }}
              >
                {/* Cart badge */}
                {inCart && (
                  <span className="absolute top-3 right-3 w-6 h-6 rounded-full bg-primary text-white text-[11px] font-semibold flex items-center justify-center">
                    {cartItem.quantity}
                  </span>
                )}

                <p className="t-h3 text-text-primary leading-snug pr-8">
                  {item.name}
                </p>
                <p className="t-small text-text-muted mt-1">{item.unit}</p>
                <p className="t-label text-primary font-semibold mt-2">
                  ₦{item.price.toLocaleString()}
                </p>
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
            <span className="t-h3 text-white">
              ₦{cartTotal.toLocaleString()}
            </span>
          </button>
        </div>
      )}

      {/* Cart drawer */}
      {showCart && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/40">
          <div className="bg-white w-full rounded-t-[24px] max-h-[88vh] flex flex-col">

            {/* Handle + header */}
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

            {/* Items list */}
            <div className="overflow-y-auto flex-1 px-5 py-3 divide-y divide-border">
              {cart.map(item => (
                <div key={item.id} className="flex items-center gap-3 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="t-body text-text-primary font-medium truncate">
                      {item.name}
                    </p>
                    <p className="t-small text-text-secondary">
                      ₦{item.price.toLocaleString()} each
                    </p>
                  </div>

                  {/* Qty controls */}
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
                      className="w-8 h-8 min-h-0 min-w-0 rounded-full bg-primary flex items-center justify-center"
                    >
                      <Plus size={14} className="text-white" />
                    </button>
                  </div>

                  {/* Line total */}
                  <p className="t-mono text-text-primary w-20 text-right flex-shrink-0">
                    ₦{(item.price * item.quantity).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>

            {/* Footer */}
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
    </div>
  )
}