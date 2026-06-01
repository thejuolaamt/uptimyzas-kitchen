'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getSession } from '@/lib/auth'
import { useToast } from '@/lib/toast'
import { Plus, Minus, Trash2, ShoppingBag } from 'lucide-react'

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
    loadCartFromStorage()
  }, [router])

  const loadCartFromStorage = () => {
    const saved = localStorage.getItem('current_order_cart')
    if (saved) setCart(JSON.parse(saved))
  }

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
    } else {
      setActiveShift(data)
    }
    setLoading(false)
  }

  const fetchMenuItems = async () => {
    const { data, error } = await supabase
      .from('menu_items')
      .select('*')
      .eq('available', true)
      .order('category', { ascending: true })

    if (!error && data) {
      setMenuItems(data)
      setCategories(['All', ...new Set(data.map(i => i.category))])
    }
  }

  const getCartItem = (id: string) => cart.find(c => c.id === id)

  const addToCart = (item: MenuItem) => {
    const existing = getCartItem(item.id)
    const newCart = existing
      ? cart.map(c => c.id === item.id ? { ...c, quantity: c.quantity + 1 } : c)
      : [...cart, { id: item.id, name: item.name, price: item.price, unit: item.unit, quantity: 1 }]
    saveCart(newCart)
  }

  const updateQuantity = (itemId: string, delta: number) => {
    const item = getCartItem(itemId)
    if (!item) return
    const newCart = item.quantity + delta <= 0
      ? cart.filter(c => c.id !== itemId)
      : cart.map(c => c.id === itemId ? { ...c, quantity: c.quantity + delta } : c)
    saveCart(newCart)
  }

  const clearCart = () => {
    saveCart([])
    setShowCart(false)
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
    <div className="min-h-screen bg-bg-subtle" style={{ paddingBottom: cartCount > 0 ? '140px' : '80px' }}>

      {/* Shift label */}
      <div className="px-4 pt-4 pb-2">
        <p className="t-small text-text-muted uppercase tracking-widest">
          {activeShift?.shifts?.name} Shift
        </p>
      </div>

      {/* Category filter */}
      <div className="overflow-x-auto">
        <div className="flex whitespace-nowrap px-4 pb-3 gap-2">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-1.5 rounded-full t-label transition-colors min-h-0 min-w-0 ${
                selectedCategory === cat
                  ? 'bg-primary text-white'
                  : 'bg-white text-text-secondary border border-border'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Menu grid */}
      <div className="px-4 grid grid-cols-2 gap-3">
        {filteredItems.length === 0 ? (
          <div className="col-span-2 text-center py-12">
            <p className="t-body text-text-muted">No items in this category</p>
          </div>
        ) : (
          filteredItems.map(item => {
            const cartItem = getCartItem(item.id)
            return (
              <div key={item.id} className="card flex flex-col justify-between gap-3">
                <div>
                  <p className="t-h3 text-text-primary leading-snug">{item.name}</p>
                  <p className="t-small text-text-muted mt-0.5">{item.unit}</p>
                </div>
                <div className="flex items-center justify-between">
                  <p className="t-label text-primary font-semibold">
                    ₦{item.price.toLocaleString()}
                  </p>
                  {cartItem ? (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => updateQuantity(item.id, -1)}
                        className="w-7 h-7 min-h-0 min-w-0 rounded-full bg-bg-subtle flex items-center justify-center text-text-secondary"
                      >
                        <Minus size={13} />
                      </button>
                      <span className="t-label text-text-primary w-5 text-center">
                        {cartItem.quantity}
                      </span>
                      <button
                        onClick={() => updateQuantity(item.id, 1)}
                        className="w-7 h-7 min-h-0 min-w-0 rounded-full bg-primary flex items-center justify-center text-white"
                      >
                        <Plus size={13} />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => addToCart(item)}
                      className="w-7 h-7 min-h-0 min-w-0 rounded-full bg-primary flex items-center justify-center text-white"
                    >
                      <Plus size={13} />
                    </button>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Persistent cart bar */}
      {cartCount > 0 && (
        <div className="fixed bottom-[68px] left-0 right-0 px-4 z-20">
          <button
            onClick={() => setShowCart(true)}
            className="w-full bg-primary rounded-[16px] px-4 py-3.5 flex items-center justify-between shadow-lg"
          >
            <div className="flex items-center gap-3">
              <span className="bg-white/20 text-white t-small font-semibold px-2 py-0.5 rounded-full">
                {cartCount}
              </span>
              <span className="t-label text-white">View Order</span>
            </div>
            <span className="t-label text-white font-semibold">
              ₦{cartTotal.toLocaleString()}
            </span>
          </button>
        </div>
      )}

      {/* Cart drawer */}
      {showCart && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/40">
          <div className="bg-white w-full rounded-t-[24px] max-h-[85vh] flex flex-col">

            <div className="px-5 pt-4 pb-3 border-b border-border flex-shrink-0">
              <div className="w-10 h-1 rounded-full bg-border mx-auto mb-4" />
              <div className="flex justify-between items-center">
                <p className="t-h2 text-text-primary">Your Order</p>
                <button
                  onClick={() => setShowCart(false)}
                  className="text-text-muted min-h-0 min-w-0 w-8 h-8 flex items-center justify-center"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
              {cart.map(item => (
                <div key={item.id} className="flex items-center gap-3">
                  <div className="flex-1">
                    <p className="t-body text-text-primary font-medium">{item.name}</p>
                    <p className="t-small text-text-secondary">
                      ₦{item.price.toLocaleString()} × {item.quantity}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => updateQuantity(item.id, -1)}
                      className="w-8 h-8 min-h-0 min-w-0 bg-bg-subtle rounded-full flex items-center justify-center"
                    >
                      <Minus size={14} />
                    </button>
                    <span className="t-mono w-6 text-center">{item.quantity}</span>
                    <button
                      onClick={() => updateQuantity(item.id, 1)}
                      className="w-8 h-8 min-h-0 min-w-0 bg-bg-subtle rounded-full flex items-center justify-center"
                    >
                      <Plus size={14} />
                    </button>
                    <button
                      onClick={() => updateQuantity(item.id, -item.quantity)}
                      className="text-danger min-h-0 min-w-0 w-8 h-8 flex items-center justify-center"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="px-5 py-4 border-t border-border flex-shrink-0 space-y-3">
              <div className="flex justify-between items-center">
                <p className="t-h3 text-text-primary">Total</p>
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
                onClick={clearCart}
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