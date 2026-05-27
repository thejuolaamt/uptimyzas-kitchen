// app/dashboard/receipt/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle } from 'lucide-react'

export default function ReceiptPage() {
  const router = useRouter()
  const [order, setOrder] = useState<any>(null)

  useEffect(() => {
    const lastOrder = localStorage.getItem('last_order')
    if (lastOrder) {
      setOrder(JSON.parse(lastOrder))
    } else {
      router.push('/dashboard')
    }
  }, [router])

  if (!order) return <div className="p-6">Loading...</div>

  return (
    <div className="min-h-screen bg-bg-subtle flex items-center justify-center p-4">
      <div className="card max-w-md w-full text-center">
        <div className="text-success mb-4">
          <CheckCircle size={64} className="mx-auto" />
        </div>
        
        <h1 className="text-2xl font-bold text-text-primary mb-2">Order Confirmed!</h1>
        <p className="text-text-secondary mb-6">Order #{order.orderId.slice(-8)}</p>

        <div className="border-t border-border pt-4 mb-4">
          {order.items.map((item: any, idx: number) => (
            <div key={idx} className="flex justify-between text-sm py-1">
              <span>{item.quantity}× {item.name}</span>
              <span>₦{(item.price * item.quantity).toLocaleString()}</span>
            </div>
          ))}
          <div className="border-t border-border mt-2 pt-2 flex justify-between font-bold">
            <span>Total</span>
            <span>₦{order.total.toLocaleString()}</span>
          </div>
        </div>

        <div className="bg-bg-subtle rounded-default p-3 mb-6 text-left">
          <p className="text-sm"><strong>Payment:</strong> {order.paymentMethod}</p>
          {order.cashAmount > 0 && <p className="text-sm"><strong>Cash:</strong> ₦{order.cashAmount.toLocaleString()}</p>}
          {order.transferAmount > 0 && <p className="text-sm"><strong>Transfer:</strong> ₦{order.transferAmount.toLocaleString()}</p>}
          {order.changeGiven > 0 && <p className="text-sm text-success"><strong>Change:</strong> ₦{order.changeGiven.toLocaleString()}</p>}
        </div>

        <button
          onClick={() => router.push('/dashboard/orders')}
          className="btn-primary w-full"
        >
          New Order
        </button>
      </div>
    </div>
  )
}