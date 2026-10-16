'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getSession } from '@/lib/auth'
import { getActiveShift, type ActiveShift } from '@/lib/shift'
import { useToast } from '@/lib/toast'
import Spinner from '@/components/Spinner'
import { enqueueOrder } from '@/lib/orderQueue'
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
  // Guards against a double tap creating two orders
  const submittedRef = useRef(false)
  const [isRouterReady, setIsRouterReady] = useState(false)
  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState<any>(null)
  const [activeShift, setActiveShift] = useState<ActiveShift | null>(null)
  const [cart, setCart] = useState<CartItem[]>([])
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'transfer' | 'split'>('cash')
  const [cashAmount, setCashAmount] = useState('')
  const [transferAmount, setTransferAmount] = useState('')
  const [amountReceived, setAmountReceived] = useState('')

  // `replace: true` is used for every guard bounce and for the final
  // handoff to the receipt — none of those should leave this page sitting
  // in browser history. Payment is a mid-flow step: you should never be
  // able to hit "back" into it once you've moved past it, whether that's
  // because the order succeeded or because a guard kicked you out.
  const navigate = useCallback((path: string, opts?: { replace?: boolean }) => {
    if (isRouterReady) {
      opts?.replace ? router.replace(path) : router.push(path)
    } else {
      window.location.href = path
    }
  }, [isRouterReady, router])

  useEffect(() => {
    setIsRouterReady(true)
  }, [])

  useEffect(() => {
    if (!isRouterReady) return

    const init = async () => {
      const userSession = getSession()
      if (!userSession) {
        navigate('/auth/login', { replace: true })
        return
      }
      setSession(userSession)

      const saved = localStorage.getItem('current_order_cart')
      if (!saved) {
        navigate('/dashboard/orders', { replace: true })
        return
      }
      setCart(JSON.parse(saved))

      // Payment can only happen against the currently open shift. If none
      // is open (shouldn't normally happen if you came from the orders
      // page, but covers edge cases like the shift closing mid-checkout),
      // bounce back rather than letting checkout proceed with no shift.
      try {
        const shift = await getActiveShift()
        if (!shift) {
          toast('No shift is currently open', 'warning')
          navigate('/dashboard/orders', { replace: true })
          return
        }
        setActiveShift(shift)
      } catch (err: any) {
        console.error(err)
        toast('Could not verify the active shift', 'error')
        navigate('/dashboard/orders', { replace: true })
        return
      }

      setLoading(false)
    }

    init()
  }, [isRouterReady, navigate])

  const total    = cart.reduce((s, i) => s + i.price * i.quantity, 0)
  const change   = parseFloat(amountReceived) - total
  const splitSum = (parseFloat(cashAmount) || 0) + (parseFloat(transferAmount) || 0)
  const splitOk  = splitSum === total
  const splitDiff = total - splitSum

  const handleConfirmOrder = () => {
    if (submittedRef.current) return

    if (!activeShift || !session) {
      toast('No active shift found', 'error')
      return
    }

    if (paymentMethod === 'cash') {
      const received = parseFloat(amountReceived)
      if (isNaN(received) || received < total) {
        toast('Amount received is less than the total', 'warning')
        return
      }
    }
    if (paymentMethod === 'split' && !splitOk) {
      toast('Cash + Transfer must equal the total amount', 'warning')
      return
    }

    submittedRef.current = true

    let cashAmt     = 0
    let transferAmt = 0
    let changeGiven = 0

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
      item_id:    i.id,
      name:       i.name,
      qty:        i.quantity,
      unit_price: i.price,
      subtotal:   i.price * i.quantity,
    }))

    // The order id is created here so the receipt can show instantly and
    // so a retry can never create a duplicate.
    const orderId = crypto.randomUUID()

    // 1. Persist locally (synchronous, cannot fail on the network)
    enqueueOrder({
      id:            orderId,
      shiftId:       activeShift.id,
      staffId:       session.id,
      items:         itemsJson,
      total,
      paymentMethod,
      cash:          cashAmt,
      transfer:      transferAmt,
      change:        changeGiven,
      clientTime:    new Date().toISOString(),
      attempts:      0,
    })

    // 2. Hand the receipt what it needs
    localStorage.removeItem('current_order_cart')
    localStorage.setItem('last_order', JSON.stringify({
      orderId,
      items:          cart,
      total,
      paymentMethod,
      changeGiven,
      cashAmount:     cashAmt,
      transferAmount: transferAmt,
    }))

    // 3. Go straight to the receipt. Saving to the database happens in the
    //    background (see the sync effect in app/dashboard/layout.tsx).
    navigate('/dashboard/receipt', { replace: true })
  }

  if (loading) {
    return <Spinner fullScreen />
  }

  return (
    <div className="min-h-screen bg-bg-subtle pb-36">
      <div className="p-4 space-y-4">

        {/* Total hero */}
        <div className="bg-primary rounded-[18px] p-5 text-white">
          <p className="t-small text-white/60 uppercase tracking-widest mb-1">Order Total</p>
          <p className="text-[40px] font-semibold text-white leading-none">
            ₦{total.toLocaleString()}
          </p>
          <p className="t-small text-white/50 mt-2">
            {cart.length} item{cart.length !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Items */}
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

        {/* Payment method */}
        <div className="card">
          <p className="t-h3 text-text-primary mb-3">Payment Method</p>
          <div className="grid grid-cols-3 gap-2 mb-4">
            {PAYMENT_METHODS.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setPaymentMethod(key)}
                className={`flex flex-col items-center gap-1.5 py-4 rounded-[12px] t-small font-medium transition-all active:scale-95 min-h-0 ${
                  paymentMethod === key
                    ? 'bg-primary text-white'
                    : 'bg-bg-subtle text-text-secondary border border-border'
                }`}
              >
                <Icon size={20} />
                {label}
              </button>
            ))}
          </div>

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
                splitOk ? 'bg-[#2E7D32]/10' : 'bg-bg-subtle border border-border'
              }`}>
                <p className={`t-label ${splitOk ? 'text-[#2E7D32]' : 'text-text-muted'}`}>
                  {splitOk ? '✓ Amounts match' : 'Remaining'}
                </p>
                {!splitOk && (
                  <p className="t-mono text-text-secondary font-medium">
                    ₦{Math.abs(splitDiff).toLocaleString()}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

      </div>

      {/* Sticky confirm button */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-bg-subtle via-bg-subtle to-transparent pt-8 z-20">
        <button
          onClick={handleConfirmOrder}
          className="btn-primary w-full shadow-lg"
        >
          Confirm & Complete Order
        </button>
      </div>
    </div>
  )
}