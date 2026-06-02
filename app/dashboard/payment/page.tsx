'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getSession } from '@/lib/auth'
import { useToast } from '@/lib/toast'
import { Banknote, Smartphone, ArrowLeftRight } from 'lucide-react'

type CartItem = {
  id: string
  name: string
  price: number
  quantity: number
  unit: string
}

const PAYMENT_METHODS = [
  { key: 'cash',     label: 'Cash',     icon: Banknote       },
  { key: 'transfer', label: 'Transfer', icon: Smartphone     },
  { key: 'split',    label: 'Split',    icon: ArrowLeftRight },
] as const

export default function PaymentPage() {
  const router = useRouter()
  const toast  = useToast()
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
      return
    }
    setSession(userSession)
    loadCart()
    checkActiveShift()
  }, [router])

  const loadCart = () => {
    const saved = localStorage.getItem('current_order_cart')
    if (saved) {
      setCart(JSON.parse(saved))
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
      const { data, error } = await supabase
        .from('shift_stock')
        .select('remaining_qty')
        .eq('shift_date', today)
        .eq('shift_id', activeShift.shift_id)
        .eq('item_id', item.id)
        .single()

      if (error || !data) {
        toast(`Error checking stock for ${item.name}`, 'error')
        return false
      }
      if (data.remaining_qty < item.quantity) {
        toast(
          `${item.name}: only ${data.remaining_qty} ${item.unit}(s) left. You ordered ${item.quantity}.`,
          'warning'
        )
        return false
      }
    }
    return true
  }

  const total     = cart.reduce((s, i) => s + i.price * i.quantity, 0)
  const change    = parseFloat(amountReceived) - total
  const splitSum  = (parseFloat(cashAmount) || 0) + (parseFloat(transferAmount) || 0)
  const splitOk   = splitSum === total
  const splitDiff = total - splitSum

  const handleConfirmOrder = async () => {
    if (!activeShift) {
      toast('No active shift found', 'error')
      return
    }

    // Validate payment inputs
    if (paymentMethod === 'cash') {
      const received = parseFloat(amountReceived)
      if (isNaN(received) || received < total) {
        toast('Amount received is less than total', 'warning')
        return
      }
    }
    if (paymentMethod === 'split' && !splitOk) {
      toast('Cash + Transfer must equal the total amount', 'warning')
      return
    }

    const stockOk = await checkStockAvailability()
    if (!stockOk) return

    setLoading(true)
    const today = new Date().toISOString().split('T')[0]

    let cashAmt      = 0
    let transferAmt  = 0
    let changeGiven  = 0

    if (paymentMethod === 'cash') {
      cashAmt     = total
      changeGiven = parseFloat(amountReceived) - total
    } else if (paymentMethod === 'transfer') {
      transferAmt = total
    } else {
      cashAmt     = parseFloat(cashAmount)     || 0
      transferAmt = parseFloat(transferAmount) || 0
    }

    const itemsJson = cart.map(i => ({
      item_id:   i.id,
      name:      i.name,
      qty:       i.quantity,
      unit_price: i.price,
      subtotal:  i.price * i.quantity,
    }))

    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .insert({
        shift_date:      today,
        shift_id:        activeShift.shift_id,
        staff_id:        session.id,
        items_json:      itemsJson,
        subtotal:        total,
        total,
        payment_method:  paymentMethod,
        cash_amount:     cashAmt,
        transfer_amount: transferAmt,
        change_given:    changeGiven,
      })
      .select()
      .single()

    if (orderError) {
      toast('Error saving order: ' + orderError.message, 'error')
      setLoading(false)
      return
    }

    await supabase.from('shift_activities').insert({
      shift_date:     today,
      shift_id:       activeShift.shift_id,
      staff_id:       session.id,
      staff_name:     `${session.first_name} ${session.surname}`,
      staff_role:     session.role,
      action_type:    'TAKE_ORDER',
      action_details: {
        order_id:       orderData.id,
        total,
        items:          cart.length,
        payment_method: paymentMethod,
      },
    })

    // Batch stock updates
    for (const item of cart) {
      const { data: stock } = await supabase
        .from('shift_stock')
        .select('remaining_qty, sold_qty')
        .eq('shift_date', today)
        .eq('shift_id', activeShift.shift_id)
        .eq('item_id', item.id)
        .single()

      if (stock) {
        await supabase
          .from('shift_stock')
          .update({
            sold_qty:      stock.sold_qty      + item.quantity,
            remaining_qty: stock.remaining_qty - item.quantity,
          })
          .eq('shift_date', today)
          .eq('shift_id', activeShift.shift_id)
          .eq('item_id', item.id)
      }
    }

    localStorage.removeItem('current_order_cart')
    localStorage.setItem('last_order', JSON.stringify({
      orderId:        orderData.id,
      items:          cart,
      total,
      paymentMethod,
      changeGiven,
      cashAmount:     cashAmt,
      transferAmount: transferAmt,
    }))

    router.push('/dashboard/receipt')
    setLoading(false)
  }

  if (!activeShift) {
    return (
      <div className="min-h-screen bg-bg-subtle flex items-center justify-center">
        <div className="w-7 h-7 border-[3px] border-border border-t-primary rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-bg-subtle pb-32">
      <div className="p-4 space-y-4">

        {/* Order total hero */}
        <div className="bg-primary rounded-[18px] p-5 text-white">
          <p className="t-small text-white/60 uppercase tracking-widest mb-1">Order Total</p>
          <p className="text-[40px] font-semibold text-white leading-none">
            ₦{total.toLocaleString()}
          </p>
          <p className="t-small text-white/50 mt-2">
            {cart.length} item{cart.length !== 1 ? 's' : ''} ·{' '}
            {activeShift?.shifts?.name} Shift
          </p>
        </div>

        {/* Order items */}
        <div className="card">
          <p className="t-h3 text-text-primary mb-3">Items</p>
          <div className="space-y-2">
            {cart.map(item => (
              <div key={item.id} className="flex justify-between items-center">
                <div>
                  <p className="t-body text-text-primary">{item.name}</p>
                  <p className="t-small text-text-muted">
                    {item.quantity} × ₦{item.price.toLocaleString()}
                  </p>
                </div>
                <p className="t-mono text-text-primary font-medium">
                  ₦{(item.price * item.quantity).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Payment method selector */}
        <div className="card">
          <p className="t-h3 text-text-primary mb-3">Payment Method</p>
          <div className="grid grid-cols-3 gap-2 mb-4">
            {PAYMENT_METHODS.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setPaymentMethod(key)}
                className={`flex flex-col items-center gap-1.5 py-3 rounded-[12px] t-small font-medium transition-colors min-h-0 ${
                  paymentMethod === key
                    ? 'bg-primary text-white'
                    : 'bg-bg-subtle text-text-secondary border border-border'
                }`}
              >
                <Icon size={18} />
                {label}
              </button>
            ))}
          </div>

          {/* Cash input */}
          {paymentMethod === 'cash' && (
            <div>
              <label className="block t-label text-text-primary mb-2">
                Amount Received (₦)
              </label>
              <input
                type="number"
                value={amountReceived}
                onChange={(e) => setAmountReceived(e.target.value)}
                className="input-base"
                placeholder="0"
                inputMode="numeric"
                autoFocus
              />
              {amountReceived && (
                <div className={`mt-3 p-3 rounded-[10px] flex justify-between items-center ${
                  change >= 0 ? 'bg-[#2E7D32]/10' : 'bg-danger/10'
                }`}>
                  <p className={`t-label ${change >= 0 ? 'text-[#2E7D32]' : 'text-danger'}`}>
                    {change >= 0 ? 'Change' : 'Short by'}
                  </p>
                  <p className={`t-mono font-semibold ${change >= 0 ? 'text-[#2E7D32]' : 'text-danger'}`}>
                    ₦{Math.abs(change).toLocaleString()}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Split input */}
          {paymentMethod === 'split' && (
            <div className="space-y-3">
              <div>
                <label className="block t-label text-text-primary mb-2">Cash Amount (₦)</label>
                <input
                  type="number"
                  value={cashAmount}
                  onChange={(e) => setCashAmount(e.target.value)}
                  className="input-base"
                  placeholder="0"
                  inputMode="numeric"
                />
              </div>
              <div>
                <label className="block t-label text-text-primary mb-2">Transfer Amount (₦)</label>
                <input
                  type="number"
                  value={transferAmount}
                  onChange={(e) => setTransferAmount(e.target.value)}
                  className="input-base"
                  placeholder="0"
                  inputMode="numeric"
                />
              </div>
              <div className={`p-3 rounded-[10px] flex justify-between items-center ${
                splitOk ? 'bg-[#2E7D32]/10' : 'bg-bg-subtle'
              }`}>
                <p className={`t-label ${splitOk ? 'text-[#2E7D32]' : 'text-text-muted'}`}>
                  {splitOk ? '✓ Amounts match' : 'Remaining'}
                </p>
                {!splitOk && (
                  <p className="t-mono text-text-secondary">
                    ₦{Math.abs(splitDiff).toLocaleString()}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

      </div>

      {/* Sticky confirm button */}
      <div className="fixed bottom-[68px] left-0 right-0 px-4 z-20 pb-2">
        <button
          onClick={handleConfirmOrder}
          disabled={loading}
          className="btn-primary w-full shadow-lg"
        >
          {loading ? 'Processing...' : 'Confirm & Complete Order'}
        </button>
      </div>

    </div>
  )
}