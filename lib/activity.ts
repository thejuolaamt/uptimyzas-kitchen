// lib/activity.ts
// Informational analysis of how a shift's orders were entered over time.
// Used by the shift summary (close page and shift history view).

export type ActivityOrder = {
  created_at: string
  client_created_at?: string | null
}

export type ShiftActivity = {
  orderCount: number
  firstOrderAt: Date | null
  lastOrderAt: Date | null
  shiftMinutes: number
  sellingMinutes: number
  minutesBeforeFirstOrder: number
  minutesAfterLastOrder: number
  ordersPerHour: number | null
  batch: {
    count: number
    spanMinutes: number
    from: Date
    to: Date
    minutesBeforeClose: number
  } | null
  lateSynced: number
}

// ---- Tunable thresholds (calibrate after reviewing 5 to 10 real shifts) ----
const BATCH_WINDOW_MINUTES = 10      // look for a burst inside any window this long
const BATCH_MIN_ORDERS = 6           // a burst needs at least this many orders
const BATCH_MIN_SHARE = 0.5          // and must hold at least this share of all orders
const BATCH_MAX_AVG_GAP_SECONDS = 45 // and orders must be entered this fast on average
const LATE_SYNC_MINUTES = 10         // phone time vs server time gap that counts as "synced late"

const MIN = 60000

export function analyzeShiftActivity(
  orders: ActivityOrder[],
  openedAt: string,
  closedAt: string
): ShiftActivity {
  const opened = new Date(openedAt).getTime()
  const closed = new Date(closedAt).getTime()
  const shiftMinutes = Math.max(0, Math.round((closed - opened) / MIN))

  const times = orders
    .map(o => new Date(o.created_at).getTime())
    .filter(t => !Number.isNaN(t))
    .sort((a, b) => a - b)

  let lateSynced = 0
  for (const o of orders) {
    if (!o.client_created_at) continue
    const gap =
      new Date(o.created_at).getTime() - new Date(o.client_created_at).getTime()
    if (gap > LATE_SYNC_MINUTES * MIN) lateSynced++
  }

  const n = times.length
  if (n === 0) {
    return {
      orderCount: 0,
      firstOrderAt: null,
      lastOrderAt: null,
      shiftMinutes,
      sellingMinutes: 0,
      minutesBeforeFirstOrder: 0,
      minutesAfterLastOrder: 0,
      ordersPerHour: null,
      batch: null,
      lateSynced,
    }
  }

  const first = times[0]
  const last = times[n - 1]
  const sellingMinutes = Math.round((last - first) / MIN)
  const ordersPerHour =
    sellingMinutes >= 30
      ? Math.round((n / (sellingMinutes / 60)) * 10) / 10
      : null

  // Sliding window: find the densest burst of orders
  let bestLeft = 0
  let bestRight = 0
  let left = 0
  for (let right = 0; right < n; right++) {
    while (times[right] - times[left] > BATCH_WINDOW_MINUTES * MIN) left++
    if (right - left > bestRight - bestLeft) {
      bestLeft = left
      bestRight = right
    }
  }

  const burstCount = bestRight - bestLeft + 1
  const burstSpanMs = times[bestRight] - times[bestLeft]
  const avgGapSeconds =
    burstCount > 1 ? burstSpanMs / (burstCount - 1) / 1000 : Infinity

  const isBatch =
    burstCount >= BATCH_MIN_ORDERS &&
    burstCount / n >= BATCH_MIN_SHARE &&
    avgGapSeconds <= BATCH_MAX_AVG_GAP_SECONDS

  return {
    orderCount: n,
    firstOrderAt: new Date(first),
    lastOrderAt: new Date(last),
    shiftMinutes,
    sellingMinutes,
    minutesBeforeFirstOrder: Math.max(0, Math.round((first - opened) / MIN)),
    minutesAfterLastOrder: Math.max(0, Math.round((closed - last) / MIN)),
    ordersPerHour,
    batch: isBatch
      ? {
          count: burstCount,
          spanMinutes: Math.max(1, Math.round(burstSpanMs / MIN)),
          from: new Date(times[bestLeft]),
          to: new Date(times[bestRight]),
          minutesBeforeClose: Math.max(0, Math.round((closed - times[bestRight]) / MIN)),
        }
      : null,
    lateSynced,
  }
}

const fmtTime = (d: Date) =>
  d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })

const fmtDuration = (minutes: number) => {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

/** Returns the WhatsApp-style "Activity" block for the shift summary. */
export function buildActivityLines(a: ShiftActivity): string {
  if (a.orderCount === 0 || !a.firstOrderAt || !a.lastOrderAt) {
    return '*Activity*\nNo orders were logged in this shift'
  }

  const lines: string[] = ['*Activity*']
  lines.push(
    `First order: ${fmtTime(a.firstOrderAt)} (${fmtDuration(a.minutesBeforeFirstOrder)} after opening)`
  )
  lines.push(
    `Last order: ${fmtTime(a.lastOrderAt)} (${fmtDuration(a.minutesAfterLastOrder)} before closing)`
  )
  lines.push(
    `Selling window: ${fmtDuration(a.sellingMinutes)} of ${fmtDuration(a.shiftMinutes)} shift`
  )
  if (a.ordersPerHour !== null) {
    lines.push(`Orders per hour: ${a.ordersPerHour}`)
  }

  if (a.batch) {
    lines.push(
      `Possible batch entry: ${a.batch.count} of ${a.orderCount} orders logged within ${a.batch.spanMinutes} min (${fmtTime(a.batch.from)} – ${fmtTime(a.batch.to)}), ${fmtDuration(a.batch.minutesBeforeClose)} before closing`
    )
  } else {
    lines.push('No batch entry pattern detected')
  }

  if (a.lateSynced > 0) {
    lines.push(`${a.lateSynced} order(s) were saved offline and synced later`)
  }

  return lines.join('\n')
}
