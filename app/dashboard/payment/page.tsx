'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getSession } from '@/lib/auth'
import { useToast } from '@/lib/toast'

type CartItem = {
  id: string
  name: string
  price: number
  quantity: number
  unit: string
}

export default function PaymentPage() {
  const router = useRouter()
  const toast = useToast()
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
      toast('No active shift. Please open a shift first.', 'warning')
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
        toast(`Error checking stock for ${item.name}`, 'error')
        return false
      }
      if (stockData.remaining_qty < item.quantity) {
        toast(`${item.name}: Only ${stockData.remaining_qty} ${item.unit}(s) available. You ordered ${item.quantity}.`, 'warning')
        return false
      }
    }
    return true
  }

  const getTotal = () => cart.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const getChange = () => {
    const received = parseFloat(amountReceived)
    return isNaN(received) ? 0 : received - getTotal()
  }

  const handleConfirmOrder = async () => {
    if (!activeShift) {
      toast('No active shift found', 'error')
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
        toast('Insufficient amount received', 'warning')
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
        toast('Cash + Transfer must equal total amount', 'warning')
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
      toast('Error saving order: ' + orderError.message, 'error')
      setLoading(false)
      return
    }

    await supabase.from('shift_activities').insert({
      shift_date: today,
      shift_id: activeShift.shift_id,
      staff_id: session.id,
      staff_name: `${session.first_name} ${session.surname}`,
      staff_role: session.role,
      action_type: 'TAKE_ORDER',
      action_details: {
        order_id: orderData.id,
        total,
        items: cart.length,
        payment_method: paymentMethod
      }
    })

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
      total,
      paymentMethod,
      changeGiven,
      cashAmount: cashAmt,
      transferAmount: transferAmt
    }))

    router.push('/dashboard/receipt')
    setLoading(false)
  }

  const total = getTotal()
  const splitTotal = (parseFloat(cashAmount) || 0) + (parseFloat(transferAmount) || 0)

  if (!activeShift) {
    return (
      <div className="min-h-screen bg-bg-subtle flex items-center justify-center">
        <div className="w-7 h-7 border-[3px] border-border border-t-primary rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-bg-subtle">
      <div className="p-4 pb-24 space-y-4">

        <h1 className="t-h1 text-text-primary">Payment</h1>

        {/* Order summary */}
        <div className="card">
          <p className="t-h3 text-text-primary mb-3">Order Summary</p>
          <div className="space-y-2">
            {cart.map(item => (
              <div key={item.id} className="flex justify-between">
                <p className="t-body text-text-secondary">{item.quantity}× {item.name}</p>
                <p className="t-body text-text-primary">₦{(item.price * item.quantity).toLocaleString()}</p>
              </div>
            ))}
          </div>
          <div className="border-t border-border mt-3 pt-3 flex justify-between">
            <p className="t-h3 text-text-primary">Total</p>
            <p className="t-h2 text-primary">₦{total.toLocaleString()}</p>
          </div>
        </div>

        {/* Payment method */}
        <div className="card">
          <p className="t-h3 text-text-primary mb-3">Payment Method</p>
          <div className="flex gap-2 mb-4">
            {(['cash', 'transfer', 'split'] as const).map(method => (
              <button
                key={method}
                onClick={() => setPaymentMethod(method)}
                className={`flex-1 py-2 rounded-[10px] t-label capitalize transition-colors ${
                  paymentMethod === method
                    ? 'bg-primary text-white'
                    : 'bg-bg-subtle text-text-secondary'
                }`}
              >
                {method}
              </button>
            ))}
          </div>

          {paymentMethod === 'cash' && (
            <div>
              <label className="block t-label text-text-primary mb-1">Amount Received</label>
              <input
                type="number"
                value={amountReceived}
                onChange={(e) => setAmountReceived(e.target.value)}
                className="input-base"
                placeholder="Enter amount"
              />
              {amountReceived && parseFloat(amountReceived) >= total && (
                <p className="t-body text-[#2E7D32] mt-2">
                  Change: ₦{getChange().toLocaleString()}
                </p>
              )}
              {amountReceived && parseFloat(amountReceived) < total && (
                <p className="t-body text-danger mt-2">
                  Short by ₦{Math.abs(getChange()).toLocaleString()}
                </p>
              )}
            </div>
          )}

          {paymentMethod === 'split' && (
            <div className="space-y-3">
              <div>
                <label className="block t-label text-text-primary mb-1">Cash Amount</label>
                <input
                  type="number"
                  value={cashAmount}
                  onChange={(e) => setCashAmount(e.target.value)}
                  className="input-base"
                  placeholder="Enter cash amount"
                />
              </div>
              <div>
                <label className="block t-label text-text-primary mb-1">Transfer Amount</label>
                <input
                  type="number"
                  value={transferAmount}
                  onChange={(e) => setTransferAmount(e.target.value)}
                  className="input-base"
                  placeholder="Enter transfer amount"
                />
              </div>
              {splitTotal > 0 && splitTotal !== total && (
                <p className="t-small text-danger">
                  Total must equal ₦{total.toLocaleString()} · Currently ₦{splitTotal.toLocaleString()}
                </p>
              )}
              {splitTotal === total && (
                <p className="t-small text-[#2E7D32]">✓ Amounts match</p>
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