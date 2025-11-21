import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { computeWaitingTime, computeReliabilityScore } from '@/lib/business-logic'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()

    const { station_id, queue_category, fuel_status } = body

    if (!station_id) {
      return NextResponse.json({ error: 'station_id is required' }, { status: 400 })
    }

    // Get current user (if any)
    const {
      data: { user },
    } = await supabase.auth.getUser()

    let userProfileId: string | null = null
    if (user) {
      const { data: profile } = await supabase
        .from('user_profile')
        .select('id, role')
        .eq('auth_user_id', user.id)
        .single()

      userProfileId = profile?.id || null
    }

    const sourceType = userProfileId ? 'PUBLIC' : 'PUBLIC'

    // Create contribution
    const { error: contribError } = await supabase.from('contribution').insert({
      station_id,
      user_id: userProfileId,
      source_type: sourceType,
      queue_category: queue_category || null,
      fuel_status: fuel_status || null,
    })

    if (contribError) {
      return NextResponse.json({ error: contribError.message }, { status: 500 })
    }

    // Update station status if fuel status is provided
    if (fuel_status) {
      // Update both fuel types (in real app, would ask which type)
      for (const fuelType of ['ESSENCE', 'GASOIL'] as const) {
        const { data: existingStatus } = await supabase
          .from('station_status')
          .select('id')
          .eq('station_id', station_id)
          .eq('fuel_type', fuelType)
          .order('updated_at', { ascending: false })
          .limit(1)
          .single()

        if (existingStatus) {
          await supabase
            .from('station_status')
            .update({
              availability: fuel_status,
              last_update_source: sourceType,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existingStatus.id)
        } else {
          await supabase.from('station_status').insert({
            station_id,
            fuel_type: fuelType,
            availability: fuel_status,
            last_update_source: sourceType,
          })
        }
      }

      // Recompute waiting time and reliability (server-side)
      await computeWaitingTime(station_id)
      await computeReliabilityScore(station_id)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in contribute API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

