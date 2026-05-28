// app/dashboard/orders/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getSession } from '@/lib/auth'
import { useToast } from '@/lib/toast'
import { ShoppingCart, Plus, Minus, Trash2 } from 'lucide-react'

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
  const [session, setSession] = useState<any>(null)
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
    } else {
      setSession(userSession)
      checkActiveShift()
      fetchMenuItems()
      loadCartFromStorage()
    }
  }, [router])

  const loadCartFromStorage = () => {
    const savedCart = localStorage.getItem('current_order_cart')
    if (savedCart) setCart(JSON.parse(savedCart))
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
      const uniqueCategories = ['All', ...new Set(data.map(item => item.category))]
      setCategories(uniqueCategories)
    }
  }

  const addToCart = (item: MenuItem) => {
    setCart(prevCart => {
      let newCart
      const existing = prevCart.find(c => c.id === item.id)
      if (existing) {
        newCart = prevCart.map(c =>
          c.id === item.id ? { ...c, quantity: c.quantity + 1 } : c
        )
      } else {
        newCart = [...prevCart, { id: item.id, name: item.name, price: item.price, unit: item.unit, quantity: 1 }]
      }
      localStorage.setItem('current_order_cart', JSON.stringify(newCart))
      return newCart
    })
  }

  const updateQuantity = (itemId: string, delta: number) => {
    setCart(prevCart => {
      let newCart
      const item = prevCart.find(c => c.id === itemId)
      if (item && item.quantity + delta <= 0) {
        newCart = prevCart.filter(c => c.id !== itemId)
      } else {
        newCart = prevCart.map(c =>
          c.id === itemId ? { ...c, quantity: c.quantity + delta } : c
        )
      }
      localStorage.setItem('current_order_cart', JSON.stringify(newCart))
      return newCart
    })
  }

  const getTotal = () => cart.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0)

  const filteredItems = selectedCategory === 'All'
    ? menuItems
    : menuItems.filter(item => item.category === selectedCategory)

  if (loading) {
    return (
      <div className="min-h-screen bg-bg-subtle flex items-center justify-center">
        <div className="w-7 h-7 border-[3px] border-border border-t-primary rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-bg-subtle pb-24">

      {/* Header */}
      <div className="bg-white border-b border-border px-4 py-3 flex justify-between items-center">
        <div>
          <p className="t-h3 text-text-primary">Take Order</p>
          <p className="t-small text-text-secondary mt-0.5">{activeShift?.shifts?.name} Shift</p>
        </div>
        <button
          onClick={() => setShowCart(true)}
          className="relative p-2 rounded-[10px] bg-bg-subtle min-h-0 min-w-0 w-10 h-10 flex items-center justify-center"
        >
          <ShoppingCart size={20} className="text-text-primary" />
          {cartCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-primary text-white t-small rounded-full w-5 h-5 flex items-center justify-center">
              {cartCount}
            </span>
          )}
        </button>
      </div>

      {/* Category filter */}
      <div className="bg-white border-b border-border overflow-x-auto">
        <div className="flex whitespace-nowrap px-4 py-2 gap-2">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-1.5 rounded-full t-label transition-colors min-h-0 min-w-0 ${
                selectedCategory === cat
                  ? 'bg-primary text-white'
                  : 'bg-bg-subtle text-text-secondary'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Menu grid */}
      <div className="p-4 grid grid-cols-2 gap-3">
        {filteredItems.map(item => (
          <button
            key={item.id}
            onClick={() => addToCart(item)}
            className="card text-left active:scale-95 transition-transform"
          >
            <p className="t-h3 text-text-primary">{item.name}</p>
            <p className="t-small text-text-muted mt-0.5">{item.unit}</p>
            <p className="t-label text-primary mt-2">₦{item.price.toLocaleString()}</p>
          </button>
        ))}
      </div>

      {/* Cart bottom sheet */}
      {showCart && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end">
          <div className="bg-white w-full rounded-t-[20px] max-h-[85vh] flex flex-col">

            <div className="px-5 pt-5 pb-4 border-b border-border flex-shrink-0">
              <div className="w-10 h-1 rounded-full bg-border mx-auto mb-4" />
              <div className="flex justify-between items-center">
                <h2 className="t-h2 text-text-primary">Your Order</h2>
                <button
                  onClick={() => setShowCart(false)}
                  className="text-text-muted min-h-0 min-w-0 w-8 h-8 flex items-center justify-center"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="overflow-y-auto flex-1 px-5 py-4">
              {cart.length === 0 ? (
                <div className="text-center py-10">
                  <p className="t-body text-text-muted">Cart is empty</p>
                  <p className="t-small text-text-muted mt-1">Add items from the menu</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {cart.map(item => (
                    <div key={item.id} className="flex justify-between items-center">
                      <div className="flex-1">
                        <p className="t-body text-text-primary font-medium">{item.name}</p>
                        <p className="t-small text-text-secondary">
                          ₦{item.price.toLocaleString()} × {item.quantity} = ₦{(item.price * item.quantity).toLocaleString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => updateQuantity(item.id, -1)}
                          className="w-8 h-8 min-h-0 min-w-0 bg-bg-subtle rounded-full flex items-center justify-center"
                        >
                          <Minus size={14} />
                        </button>
                        <span className="font-mono t-body w-6 text-center">{item.quantity}</span>
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
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {cart.length > 0 && (
              <div className="px-5 py-4 border-t border-border flex-shrink-0">
                <div className="flex justify-between items-center mb-4">
                  <p className="t-h3 text-text-primary">Total</p>
                  <p className="t-h2 text-primary">₦{getTotal().toLocaleString()}</p>
                </div>
                <button
                  onClick={() => router.push('/dashboard/payment')}
                  className="btn-primary w-full"
                >
                  Proceed to Payment
                </button>
              </div>
            )}

          </div>
        </div>
      )}
    </div>
  )
}