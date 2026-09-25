import { supabase } from '@/lib/supabase'

export type ActiveShift = {
  id: string
  opened_at: string
  opened_by: string
}

/**
 * Returns the currently open shift (closed_at is null), or null if
 * no shift is open right now.
 */
export async function getActiveShift(): Promise<ActiveShift | null> {
  const { data, error } = await supabase
    .from('shifts')
    .select('id, opened_at, opened_by')
    .is('closed_at', null)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data
}

/**
 * Makes sure the given user is recorded as part of the given shift.
 * Safe to call every time someone lands on the orders page — it only
 * inserts a row the first time a user joins a particular shift.
 */
export async function ensureJoined(shiftId: string, userId: string): Promise<void> {
  const { data: existing, error: checkError } = await supabase
    .from('shift_assignments')
    .select('id')
    .eq('shift_id', shiftId)
    .eq('user_id', userId)
    .maybeSingle()

  if (checkError) throw new Error(checkError.message)
  if (existing) return

  const { error: insertError } = await supabase
    .from('shift_assignments')
    .insert({ shift_id: shiftId, user_id: userId })

  if (insertError) throw new Error(insertError.message)
}