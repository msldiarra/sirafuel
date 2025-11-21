import { NextResponse } from 'next/server'
import { generateAlerts } from '@/lib/business-logic'

export async function POST() {
  try {
    await generateAlerts()
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error generating alerts:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

