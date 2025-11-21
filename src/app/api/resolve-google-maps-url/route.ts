import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json()

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 })
    }

    // Check if it's a shortened URL
    if (url.includes('goo.gl') || url.includes('maps.app.goo.gl')) {
      // Follow the redirect to get the final URL
      const response = await fetch(url, {
        method: 'HEAD',
        redirect: 'follow',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      })

      const finalUrl = response.url || url
      return NextResponse.json({ finalUrl })
    }

    // If not a shortened URL, return as is
    return NextResponse.json({ finalUrl: url })
  } catch (error: any) {
    console.error('Error resolving Google Maps URL:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to resolve URL' },
      { status: 500 }
    )
  }
}



