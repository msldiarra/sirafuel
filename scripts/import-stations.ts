import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { resolve } from 'path'

// Load environment variables
dotenv.config({ path: resolve(process.cwd(), '.env.local') })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing environment variables:')
  console.error('   - NEXT_PUBLIC_SUPABASE_URL')
  console.error('   - SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

interface BkoFuelStation {
  id: number
  name: string
  brand: string
  latitude: number
  longitude: number
  address: string
  quartier: string
  commune: string
  latest_report: {
    id: number
    fuel_type: 'essence' | 'diesel' | 'both'
    status: 'available' | 'out' | 'limited'
    price: number | null
    comment: string | null
    created_at: string
    confirm_count: number
    contest_count: number
  } | null
}

// Map BkoFuel fuel types to our schema
function mapFuelType(fuelType: string): ('ESSENCE' | 'GASOIL')[] {
  switch (fuelType.toLowerCase()) {
    case 'essence':
      return ['ESSENCE']
    case 'diesel':
      return ['GASOIL']
    case 'both':
      return ['ESSENCE', 'GASOIL']
    default:
      return ['ESSENCE'] // Default to ESSENCE
  }
}

// Map BkoFuel status to our availability enum
function mapAvailability(status: string): 'AVAILABLE' | 'LIMITED' | 'OUT' {
  switch (status.toLowerCase()) {
    case 'available':
      return 'AVAILABLE'
    case 'limited':
      return 'LIMITED'
    case 'out':
      return 'OUT'
    default:
      return 'OUT' // Default to OUT if unknown
  }
}

async function importStations() {
  console.log('🚀 Starting station import from BkoFuel API...\n')

  try {
    // Fetch stations from API
    console.log('📡 Fetching stations from https://api.bkofuel.com/stations...')
    const response = await fetch('https://api.bkofuel.com/stations')
    
    if (!response.ok) {
      throw new Error(`Failed to fetch stations: ${response.statusText}`)
    }

    const stations: BkoFuelStation[] = await response.json()
    console.log(`✅ Fetched ${stations.length} stations\n`)

    let imported = 0
    let updated = 0
    let skipped = 0
    let errors = 0

    // Process each station
    for (const station of stations) {
      try {
        // Validate required fields
        if (!station.name || !station.latitude || !station.longitude) {
          skipped++
          console.log(`  ⏭️  Skipped: ${station.name || 'Unknown'} (missing required fields)`)
          continue
        }

        // Check if station already exists (by name and municipality)
        const { data: existing } = await supabase
          .from('station')
          .select('id')
          .eq('name', station.name.trim())
          .eq('municipality', (station.commune || 'Bamako').trim())
          .maybeSingle()

        // Extract brand from name if not provided
        let brand = station.brand?.trim() || null
        if (!brand) {
          // Try to extract brand from station name
          const brandPatterns = [
            /^(Oryx|ORYX)\s/i,
            /^(Shell|SHELL)\s/i,
            /^(Total|TOTAL)\s/i,
            /^(BP)\s/i,
            /^(Mobil|MOBIL)\s/i,
            /^(Corridor|CORRIDOR)\s/i,
            /^(Yara|YARA)\s/i,
            /^(BCF)\s/i,
            /^(CDS)\s/i,
            /^(KDF)\s/i,
            /^(Amazone|AMAZONE)\s/i,
            /^(Birgo|BIRGO)\s/i,
            /^(Comap|COMAP)\s/i,
            /^(CAM HOLDING|Cam Holding)\s/i,
            /^(2Holding|2HOLDING)\s/i,
            /^(ADF)\s/i,
          ]

          for (const pattern of brandPatterns) {
            const match = station.name.match(pattern)
            if (match) {
              brand = match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase()
              break
            }
          }
        }

        const stationData = {
          name: station.name.trim(),
          brand: brand,
          municipality: (station.commune || 'Bamako').trim(),
          neighborhood: (station.quartier || station.address || 'Inconnu').trim(),
          latitude: station.latitude,
          longitude: station.longitude,
          is_active: true,
          updated_at: new Date().toISOString(),
        }

        let stationId: string

        if (existing) {
          // Update existing station
          const { error: updateError } = await supabase
            .from('station')
            .update(stationData)
            .eq('id', existing.id)

          if (updateError) throw updateError

          stationId = existing.id
          updated++
          console.log(`  ✏️  Updated: ${station.name}`)
        } else {
          // Insert new station
          const { data: newStation, error: insertError } = await supabase
            .from('station')
            .insert(stationData)
            .select('id')
            .single()

          if (insertError) throw insertError
          if (!newStation) throw new Error('Failed to create station')

          stationId = newStation.id
          imported++
          console.log(`  ➕ Imported: ${station.name}`)
        }

        // Import station status if latest_report exists
        if (station.latest_report) {
          const report = station.latest_report
          const fuelTypes = mapFuelType(report.fuel_type)
          const availability = mapAvailability(report.status)

          for (const fuelType of fuelTypes) {
            // Check if status already exists
            const { data: existingStatus } = await supabase
              .from('station_status')
              .select('id')
              .eq('station_id', stationId)
              .eq('fuel_type', fuelType)
              .maybeSingle()

            const statusData = {
              station_id: stationId,
              fuel_type: fuelType,
              availability,
              last_update_source: 'PUBLIC' as const,
              updated_at: report.created_at || new Date().toISOString(),
            }

            if (existingStatus) {
              // Update existing status
              await supabase
                .from('station_status')
                .update(statusData)
                .eq('id', existingStatus.id)
            } else {
              // Insert new status
              await supabase.from('station_status').insert(statusData)
            }

            // Create a contribution record for this report
            await supabase.from('contribution').insert({
              station_id: stationId,
              user_id: null, // Anonymous contribution from API
              source_type: 'PUBLIC',
              fuel_status: availability,
              created_at: report.created_at || new Date().toISOString(),
            })
          }
        }
      } catch (error: any) {
        errors++
        console.error(`  ❌ Error processing ${station.name}:`, error.message)
      }
    }

    console.log('\n📊 Import Summary:')
    console.log(`   ✅ Imported: ${imported} new stations`)
    console.log(`   ✏️  Updated: ${updated} existing stations`)
    console.log(`   ⏭️  Skipped: ${skipped} stations`)
    console.log(`   ❌ Errors: ${errors} stations`)
    console.log(`\n🎉 Import completed!`)

  } catch (error: any) {
    console.error('\n❌ Fatal error:', error.message)
    process.exit(1)
  }
}

// Run the import
importStations()
  .then(() => {
    console.log('\n✨ Done!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n💥 Unhandled error:', error)
    process.exit(1)
  })

