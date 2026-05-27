'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getSession } from '@/lib/auth'

type CartItem = {
  id: string
  name: string
  price: number
  quantity: number
  unit: string
}

export default function PaymentPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [session, setSession] = useState<any>(null)
  const [cart, setCart] = useState<CartItem[]>([])
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'transfer' | 'split'>('cash')
  const [cashAmount, setCashAmount] = useState('')
  const [transferAmount, setTransferAmount] = useState('')
  const [amountReceived, setAmountReceived] = useState('')
  const [activeShift, setActiveShift] = useState<any>(null)

  useEffect(() => {
    const userSession = getSession()
    if (!userSession) {
      router.push('/auth/login')
    } else {
      setSession(userSession)
      loadCart()
      checkActiveShift()
    }
  }, [router])

  const loadCart = () => {
    const savedCart = localStorage.getItem('current_order_cart')
    if (savedCart) {
      setCart(JSON.parse(savedCart))
    } else {
      router.push('/dashboard/orders')
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
  }

  const checkStockAvailability = async () => {
    const today = new Date().toISOString().split('T')[0]
    
    for (const item of cart) {
      const { data: stockData, error } = await supabase
        .from('shift_stock')
        .select('remaining_qty')
        .eq('shift_date', today)
        .eq('shift_id', activeShift.shift_id)
        .eq('item_id', item.id)
        .single()

      if (error || !stockData) {
        alert(`Error checking stock for ${item.name}`)
        return false
      }

      if (stockData.remaining_qty < item.quantity) {
        alert(`${item.name}: Only ${stockData.remaining_qty} ${item.unit}(s) available. You ordered ${item.quantity}.`)
        return false
      }
    }
    return true
  }

  const getTotal = () => {
    return cart.reduce((sum, item) => sum + item.price * item.quantity, 0)
  }

  const getChange = () => {
    const received = parseFloat(amountReceived)
    const total = getTotal()
    if (isNaN(received)) return 0
    return received - total
  }

  const handleConfirmOrder = async () => {
    if (!activeShift) {
      alert('No active shift found')
      router.push('/dashboard')
      return
    }

    const stockAvailable = await checkStockAvailability()
    if (!stockAvailable) return

    setLoading(true)
    const total = getTotal()
    const today = new Date().toISOString().split('T')[0]
    
    let cashAmt = 0
    let transferAmt = 0
    let changeGiven = 0

    if (paymentMethod === 'cash') {
      const received = parseFloat(amountReceived)
      if (received < total) {
        alert('Insufficient amount received')
        setLoading(false)
        return
      }
      cashAmt = total
      changeGiven = received - total
    } else if (paymentMethod === 'transfer') {
      transferAmt = total
    } else if (paymentMethod === 'split') {
      cashAmt = parseFloat(cashAmount) || 0
      transferAmt = parseFloat(transferAmount) || 0
      if (cashAmt + transferAmt !== total) {
        alert('Cash + Transfer must equal total amount')
        setLoading(false)
        return
      }
    }

    const itemsJson = cart.map(item => ({
      item_id: item.id,
      name: item.name,
      qty: item.quantity,
      unit_price: item.price,
      subtotal: item.price * item.quantity
    }))

    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .insert({
        shift_date: today,
        shift_id: activeShift.shift_id,
        staff_id: session.id,
        items_json: itemsJson,
        subtotal: total,
        total: total,
        payment_method: paymentMethod,
        cash_amount: cashAmt,
        transfer_amount: transferAmt,
        change_given: changeGiven
      })
      .select()
      .single()

    if (orderError) {
      alert('Error saving order: ' + orderError.message)
      setLoading(false)
      return
    }

    // Log order activity
    await supabase.from('shift_activities').insert({
      shift_date: today,
      shift_id: activeShift.shift_id,
      staff_id: session.id,
      staff_name: `${session.first_name} ${session.surname}`,
      staff_role: session.role,
      action_type: 'TAKE_ORDER',
      action_details: {
        order_id: orderData.id,
        total: total,
        items: cart.length,
        payment_method: paymentMethod
      }
    });

    for (const item of cart) {
      const { data: stockData } = await supabase
        .from('shift_stock')
        .select('remaining_qty, sold_qty')
        .eq('shift_date', today)
        .eq('shift_id', activeShift.shift_id)
        .eq('item_id', item.id)
        .single()

      if (stockData) {
        await supabase
          .from('shift_stock')
          .update({
            sold_qty: stockData.sold_qty + item.quantity,
            remaining_qty: stockData.remaining_qty - item.quantity
          })
          .eq('shift_date', today)
          .eq('shift_id', activeShift.shift_id)
          .eq('item_id', item.id)
      }
    }

    localStorage.removeItem('current_order_cart')
    localStorage.setItem('last_order', JSON.stringify({
      orderId: orderData.id,
      items: cart,
      total: total,
      paymentMethod: paymentMethod,
      changeGiven: changeGiven,
      cashAmount: cashAmt,
      transferAmount: transferAmt
    }))
    
    router.push('/dashboard/receipt')
    setLoading(false)
  }

  const total = getTotal()

  if (!activeShift) {
    return <div className="p-6">Loading shift information...</div>
  }

  return (
    <div className="min-h-screen bg-bg-subtle">
      <div className="p-4">
        <h1 className="text-xl font-bold text-text-primary mb-4">Payment</h1>
        
        <div className="card mb-4">
          <h2 className="font-bold text-text-primary mb-2">Order Summary</h2>
          {cart.map(item => (
            <div key={item.id} className="flex justify-between text-sm py-1">
              <span>{item.quantity}× {item.name}</span>
              <span>₦{(item.price * item.quantity).toLocaleString()}</span>
            </div>
          ))}
          <div className="border-t border-border mt-2 pt-2 flex justify-between font-bold">
            <span>Total</span>
            <span>₦{total.toLocaleString()}</span>
          </div>
        </div>

        <div className="card mb-4">
          <h2 className="font-bold text-text-primary mb-3">Payment Method</h2>
          <div className="flex gap-3 mb-4">
            <button
              onClick={() => setPaymentMethod('cash')}
              className={`flex-1 py-2 rounded-default font-semibold ${
                paymentMethod === 'cash' ? 'bg-primary text-white' : 'bg-bg-subtle text-text-secondary'
              }`}
            >
              Cash
            </button>
            <button
              onClick={() => setPaymentMethod('transfer')}
              className={`flex-1 py-2 rounded-default font-semibold ${
                paymentMethod === 'transfer' ? 'bg-primary text-white' : 'bg-bg-subtle text-text-secondary'
              }`}
            >
              Transfer
            </button>
            <button
              onClick={() => setPaymentMethod('split')}
              className={`flex-1 py-2 rounded-default font-semibold ${
                paymentMethod === 'split' ? 'bg-primary text-white' : 'bg-bg-subtle text-text-secondary'
              }`}
            >
              Split
            </button>
          </div>

          {paymentMethod === 'cash' && (
            <div>
              <label className="block text-text-primary font-medium mb-1">Amount Received</label>
              <input
                type="number"
                value={amountReceived}
                onChange={(e) => setAmountReceived(e.target.value)}
                className="input-base"
                placeholder="Enter amount"
              />
              {amountReceived && parseFloat(amountReceived) >= total && (
                <p className="text-success mt-2">Change: ₦{getChange().toLocaleString()}</p>
              )}
              {amountReceived && parseFloat(amountReceived) < total && (
                <p className="text-danger mt-2">Insufficient: ₦{Math.abs(getChange()).toLocaleString()} short</p>
              )}
            </div>
          )}

          {paymentMethod === 'split' && (
            <div className="space-y-3">
              <div>
                <label className="block text-text-primary font-medium mb-1">Cash Amount</label>
                <input
                  type="number"
                  value={cashAmount}
                  onChange={(e) => setCashAmount(e.target.value)}
                  className="input-base"
                  placeholder="Enter cash amount"
                />
              </div>
              <div>
                <label className="block text-text-primary font-medium mb-1">Transfer Amount</label>
                <input
                  type="number"
                  value={transferAmount}
                  onChange={(e) => setTransferAmount(e.target.value)}
                  className="input-base"
                  placeholder="Enter transfer amount"
                />
              </div>
              {(parseFloat(cashAmount) + parseFloat(transferAmount)) !== total && (
                <p className="text-danger text-sm">Total must equal ₦{total.toLocaleString()}</p>
              )}
            </div>
          )}
        </div>

        <button
          onClick={handleConfirmOrder}
          disabled={loading}
          className="btn-primary w-full"
        >
          {loading ? 'Processing...' : 'Confirm Order'}
        </button>
      </div>
    </div>
  )
}