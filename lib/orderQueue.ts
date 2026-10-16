// lib/orderQueue.ts
// Durable local queue for orders. An order is written here the instant the
// cashier confirms, then synced to Supabase in the background through the
// atomic `create_order` function. Survives refreshes, crashes and offline use.

import { supabase } from '@/lib/supabase'

export type PendingOrderItem = {
  item_id: string
  name: string
  qty: number
  unit_price: number
  subtotal: number
}

export type PendingOrder = {
  id: string
  shiftId: string
  staffId: string
  items: PendingOrderItem[]
  total: number
  paymentMethod: 'cash' | 'transfer' | 'split'
  cash: number
  transfer: number
  change: number
  clientTime: string
  attempts: number
}

export type FlushResult = {
  synced: number
  failed: { id: string; reason: string }[]
  remaining: number
}

const QUEUE_KEY = 'pending_orders'
const DEAD_KEY = 'failed_orders' // orders the server rejected, kept for manual re-entry
const MAX_ATTEMPTS = 3

export const ORDERS_QUEUED_EVENT = 'orders:queued'

let flushing = false

function readList(key: string): PendingOrder[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as PendingOrder[]) : []
  } catch {
    return []
  }
}

function writeList(key: string, list: PendingOrder[]) {
  localStorage.setItem(key, JSON.stringify(list))
}

function removeFromQueue(id: string) {
  writeList(QUEUE_KEY, readList(QUEUE_KEY).filter(o => o.id !== id))
}

function bumpAttempts(id: string) {
  writeList(
    QUEUE_KEY,
    readList(QUEUE_KEY).map(o => (o.id === id ? { ...o, attempts: o.attempts + 1 } : o))
  )
}

function moveToDead(order: PendingOrder) {
  removeFromQueue(order.id)
  writeList(DEAD_KEY, [...readList(DEAD_KEY), order])
}

function friendlyReason(message: string, id: string): string {
  const tag = `#${id.slice(-8)}`
  const stock = message.match(/INSUFFICIENT_STOCK:([^\n]+)/)
  if (stock) return `Order ${tag}: ${stock[1].trim()} has not enough stock. Order was NOT saved`
  if (message.includes('SHIFT_CLOSED')) return `Order ${tag}: the shift was already closed. Order was NOT saved`
  return `Order ${tag} could not be saved: ${message}`
}

/** Saves an order locally and asks the app to sync it. Never touches the network. */
export function enqueueOrder(order: PendingOrder) {
  writeList(QUEUE_KEY, [...readList(QUEUE_KEY), order])
  window.dispatchEvent(new Event(ORDERS_QUEUED_EVENT))
}

export function pendingCount(): number {
  return readList(QUEUE_KEY).length
}

/** Total quantity per item still waiting to sync for a shift. */
export function pendingQtyByItem(shiftId: string): Record<string, number> {
  const totals: Record<string, number> = {}
  for (const o of readList(QUEUE_KEY)) {
    if (o.shiftId !== shiftId) continue
    for (const i of o.items) {
      totals[i.item_id] = (totals[i.item_id] || 0) + i.qty
    }
  }
  return totals
}

/** Sends queued orders to Supabase one by one. Safe to call repeatedly. */
export async function flushPendingOrders(): Promise<FlushResult> {
  const result: FlushResult = { synced: 0, failed: [], remaining: 0 }

  if (flushing) {
    result.remaining = readList(QUEUE_KEY).length
    return result
  }

  flushing = true
  const seen = new Set<string>()

  try {
    while (true) {
      // Re-read each loop so orders queued during a flush are picked up too
      const next = readList(QUEUE_KEY).find(o => !seen.has(o.id))
      if (!next) break
      seen.add(next.id)

      const { error } = await supabase.rpc('create_order', {
        p_id: next.id,
        p_shift_id: next.shiftId,
        p_staff_id: next.staffId,
        p_items: next.items,
        p_total: next.total,
        p_payment_method: next.paymentMethod,
        p_cash: next.cash,
        p_transfer: next.transfer,
        p_change: next.change,
        p_client_time: next.clientTime,
      })

      // Saved, or already saved earlier (duplicate key)
      if (!error || error.code === '23505') {
        removeFromQueue(next.id)
        result.synced++
        continue
      }

      const message = error.message || ''

      // Business rejection: retrying will never succeed
      if (/INSUFFICIENT_STOCK|SHIFT_CLOSED/.test(message)) {
        moveToDead(next)
        result.failed.push({ id: next.id, reason: friendlyReason(message, next.id) })
        continue
      }

      // No connection: leave everything queued and try again later
      const offline =
        (typeof navigator !== 'undefined' && !navigator.onLine) ||
        /failed to fetch|network|load failed/i.test(message)
      if (offline) break

      // Unknown server error: retry a few times, then park it
      if (next.attempts + 1 >= MAX_ATTEMPTS) {
        moveToDead(next)
        result.failed.push({ id: next.id, reason: friendlyReason(message, next.id) })
      } else {
        bumpAttempts(next.id)
      }
    }
  } finally {
    flushing = false
  }

  result.remaining = readList(QUEUE_KEY).length
  return result
}
