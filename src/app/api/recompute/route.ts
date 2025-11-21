import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { computeWaitingTime, computeReliabilityScore } from '@/lib/business-logic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { station_id } = body

    if (!station_id) {
      return NextResponse.json({ error: 'station_id is required' }, { status: 400 })
    }

    // Recompute waiting time
    const waitingTime = await computeWaitingTime(station_id)

    // Update station statuses with new waiting times
    const supabase = await createClient()
    const { data: statuses } = await supabase
      .from('station_status')
      .select('id')
      .eq('station_id', station_id)

    if (statuses) {
      for (const status of statuses) {
        await supabase
          .from('station_status')
          .update({
            waiting_time_min: waitingTime.waiting_time_min,
            waiting_time_max: waitingTime.waiting_time_max,
          })
          .eq('id', status.id)
      }
    }

    // Recompute reliability score
    const reliabilityScore = await computeReliabilityScore(station_id)

    // Update station statuses with new reliability score
    if (statuses) {
      for (const status of statuses) {
        await supabase
          .from('station_status')
          .update({
            reliability_score: reliabilityScore,
          })
          .eq('id', status.id)
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in recompute API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

