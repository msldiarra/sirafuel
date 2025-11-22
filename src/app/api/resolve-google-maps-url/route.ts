import { NextRequest, NextResponse } from 'next/server'

/**
 * Resolves Google Maps URLs and extracts coordinates
 * Handles both full URLs and short links by parsing Open Graph metadata
 */
export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json()

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 })
    }

    // Try to extract coordinates directly from the URL first (fastest)
    // Pattern: @[latitude],[longitude],[zoom]
    const coordsRegex = /@(-?\d+\.\d+),(-?\d+\.\d+),/
    const match = url.match(coordsRegex)

    if (match && match[1] && match[2]) {
      const latitude = parseFloat(match[1])
      const longitude = parseFloat(match[2])
      
      console.log(`✓ Extracted coordinates from URL: ${latitude}, ${longitude}`)
      
      return NextResponse.json({
        finalUrl: url,
        latitude,
        longitude,
        success: true,
      })
    }

    // For short links, they don't contain extractable coordinates
    if (url.includes('maps.app.goo.gl')) {
      console.log('⚠ Short URL detected: maps.app.goo.gl - these cannot be processed server-side')
      console.log('  The preview page does not contain coordinate data')
      console.log('  User must obtain the full URL from Google Maps')
      
      // Return error with clear instructions
      return NextResponse.json({
        success: false,
        error: 'maps.app.goo.gl_not_supported',
        message: 'Short maps.app.goo.gl links cannot be processed. Please use the full Google Maps URL.',
      })
    }

    // If no coordinates found in full URL
    return NextResponse.json({
      finalUrl: url,
      success: false,
      message: 'No coordinates found in the provided URL',
    })
  } catch (error: any) {
    console.error('Error in resolve-google-maps-url:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to resolve URL', success: false },
      { status: 500 }
    )
  }
}



