'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export function WaitTimeTrendsChart() {
  const [chartData, setChartData] = useState<number[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadChartData()
  }, [])

  async function loadChartData() {
    const supabase = createClient()
    
    // Get data for the last 24 hours, grouped by hour
    const now = new Date()
    const hours = []
    const data = []

    for (let i = 23; i >= 0; i--) {
      const hourStart = new Date(now.getTime() - i * 60 * 60 * 1000)
      hourStart.setMinutes(0, 0, 0)
      const hourEnd = new Date(hourStart.getTime() + 60 * 60 * 1000 - 1)

      const { data: statuses } = await supabase
        .from('station_status')
        .select('waiting_time_max')
        .gte('updated_at', hourStart.toISOString())
        .lte('updated_at', hourEnd.toISOString())
        .not('waiting_time_max', 'is', null)

      const avgWaitTime = statuses && statuses.length > 0
        ? Math.round(
            statuses
              .map((s) => s.waiting_time_max!)
              .reduce((a, b) => a + b, 0) / statuses.length
          )
        : 0

      hours.push(hourStart.getHours())
      data.push(avgWaitTime)
    }

    setChartData(data)
    setLoading(false)
  }

  if (loading) {
    return (
      <div className="h-48 flex items-center justify-center">
        <div className="text-gray-400">Chargement...</div>
      </div>
    )
  }

  const maxValue = Math.max(...chartData, 1) // Avoid division by zero

  return (
    <div className="h-48 flex items-end justify-between gap-1">
      {chartData.map((value, index) => {
        const height = maxValue > 0 ? (value / maxValue) * 100 : 0
        const hour = (new Date().getHours() - (23 - index) + 24) % 24
        
        return (
          <div key={index} className="flex-1 flex flex-col items-center gap-1">
            <div
              className="w-full bg-primary-teal rounded-t transition-all hover:opacity-80"
              style={{ height: `${Math.max(height, 2)}%` }}
              title={`${hour.toString().padStart(2, '0')}:00 - ${value} min`}
            />
            {index === 0 || index === Math.floor(chartData.length / 2) || index === chartData.length - 1 ? (
              <span className="text-xs text-gray-500">
                {hour.toString().padStart(2, '0')}:00
              </span>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}

