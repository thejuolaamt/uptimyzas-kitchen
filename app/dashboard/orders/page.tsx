// app/dashboard/orders/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getSession } from '@/lib/auth'
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
    if (savedCart) {
      setCart(JSON.parse(savedCart))
    }
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
      alert('No active shift. Please open a shift first.')
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
      const existing = prevCart.find(cartItem => cartItem.id === item.id)
      if (existing) {
        newCart = prevCart.map(cartItem =>
          cartItem.id === item.id
            ? { ...cartItem, quantity: cartItem.quantity + 1 }
            : cartItem
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

  const getTotal = () => {
    return cart.reduce((sum, item) => sum + item.price * item.quantity, 0)
  }

  const filteredItems = selectedCategory === 'All'
    ? menuItems
    : menuItems.filter(item => item.category === selectedCategory)

  if (loading) return <div className="p-6">Loading...</div>

  return (
    <div className="min-h-screen bg-bg-subtle pb-20">
      <div className="bg-primary text-white p-4 sticky top-0 z-10">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="font-bold text-lg">Take Order</h1>
            <p className="text-sm opacity-90">{activeShift?.shifts?.name} Shift</p>
          </div>
          <button 
            onClick={() => setShowCart(true)}
            className="relative bg-white/20 p-2 rounded-full"
          >
            <ShoppingCart size={24} />
            {cart.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-yellow-400 text-primary text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                {cart.reduce((sum, item) => sum + item.quantity, 0)}
              </span>
            )}
          </button>
        </div>
      </div>

      <div className="bg-white border-b border-border overflow-x-auto">
        <div className="flex whitespace-nowrap p-2 gap-2">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-2 rounded-full text-sm font-semibold transition-colors ${
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

      <div className="p-4 grid grid-cols-2 gap-3">
        {filteredItems.map(item => (
          <button
            key={item.id}
            onClick={() => addToCart(item)}
            className="card text-left hover:shadow-md transition-shadow"
          >
            <h3 className="font-bold text-text-primary">{item.name}</h3>
            <p className="text-text-secondary text-sm">{item.unit}</p>
            <p className="text-primary font-bold mt-2">₦{item.price.toLocaleString()}</p>
          </button>
        ))}
      </div>

      {showCart && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white w-full rounded-t-lg max-h-[80vh] overflow-y-auto">
            <div className="p-4 border-b border-border sticky top-0 bg-white">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-text-primary">Your Order</h2>
                <button onClick={() => setShowCart(false)} className="text-text-muted">✕</button>
              </div>
            </div>
            
            <div className="p-4 space-y-3">
              {cart.length === 0 ? (
                <p className="text-text-muted text-center py-8">Cart is empty</p>
              ) : (
                <>
                  {cart.map(item => (
                    <div key={item.id} className="flex justify-between items-center">
                      <div className="flex-1">
                        <p className="font-semibold text-text-primary">{item.name}</p>
                        <p className="text-text-secondary text-sm">₦{item.price} × {item.quantity}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => updateQuantity(item.id, -1)}
                          className="w-8 h-8 bg-bg-subtle rounded-full flex items-center justify-center"
                        >
                          <Minus size={16} />
                        </button>
                        <span className="font-mono w-8 text-center">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.id, 1)}
                          className="w-8 h-8 bg-bg-subtle rounded-full flex items-center justify-center"
                        >
                          <Plus size={16} />
                        </button>
                        <button
                          onClick={() => updateQuantity(item.id, -item.quantity)}
                          className="text-danger"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                  ))}
                  
                  <div className="border-t border-border pt-4 mt-4">
                    <div className="flex justify-between text-lg font-bold">
                      <span>Total</span>
                      <span>₦{getTotal().toLocaleString()}</span>
                    </div>
                    <button 
                      onClick={() => router.push('/dashboard/payment')}
                      className="btn-primary w-full mt-4"
                    >
                      Proceed to Payment →
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}