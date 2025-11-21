import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

// Service client for admin operations (bypasses RLS)
function getServiceClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set')
  }
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceKey
  )
}

// GET: List users (admin only)
export async function GET(request: NextRequest) {
  try {
    // Get auth token from Authorization header
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized: No token provided' }, { status: 401 })
    }

    // Create service client and verify the token
    const serviceClient = getServiceClient()
    const { data: { user }, error: userError } = await serviceClient.auth.getUser(token)

    if (userError || !user) {
      console.error('Auth error:', userError)
      return NextResponse.json({ error: 'Unauthorized: Invalid token' }, { status: 401 })
    }

    // Use service client for profile queries (bypasses RLS and cookie issues)
    const { data: profile } = await serviceClient
      .from('user_profile')
      .select('*')
      .eq('auth_user_id', user.id)
      .single()

    if (!profile || profile.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { data: users, error } = await serviceClient
      .from('user_profile')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error

    return NextResponse.json({ users })
  } catch (error: any) {
    console.error('Error fetching users:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST: Create user(s) - individual or batch
export async function POST(request: NextRequest) {
  try {
    // Get auth token from Authorization header
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')

    if (!token) {
      console.error('No token provided')
      return NextResponse.json({ error: 'Unauthorized: No token provided' }, { status: 401 })
    }

    // Create service client and verify the token
    const serviceClient = getServiceClient()
    const { data: { user }, error: userError } = await serviceClient.auth.getUser(token)

    if (userError) {
      console.error('Auth error:', userError)
      return NextResponse.json({ error: 'Unauthorized: ' + userError.message }, { status: 401 })
    }

    if (!user) {
      console.error('No user found')
      return NextResponse.json({ error: 'Unauthorized: Invalid token' }, { status: 401 })
    }

    // Use service client for profile queries (bypasses RLS and cookie issues)
    const { data: profile, error: profileError } = await serviceClient
      .from('user_profile')
      .select('*')
      .eq('auth_user_id', user.id)
      .single()

    if (profileError) {
      console.error('Profile error:', profileError)
      return NextResponse.json({ error: 'Profile error: ' + profileError.message }, { status: 500 })
    }

    if (!profile || profile.role !== 'ADMIN') {
      return NextResponse.json({ 
        error: 'Forbidden: Admin role required. Current role: ' + (profile?.role || 'none')
      }, { status: 403 })
    }

    const body = await request.json()
    const { users: usersToCreate } = body

    if (!Array.isArray(usersToCreate) || usersToCreate.length === 0) {
      return NextResponse.json({ error: 'Invalid users array' }, { status: 400 })
    }

    const results = []

    for (const userData of usersToCreate) {
      const { email, role, station_id, password } = userData

      if (!email || !role) {
        results.push({
          email: email || 'unknown',
          success: false,
          error: 'Email and role are required',
        })
        continue
      }

      try {
        // Use provided password or generate a default one
        const defaultPassword = password || Math.random().toString(36).slice(-12) + 'A1!'
        const { data: authUser, error: authError } = await serviceClient.auth.admin.createUser({
          email,
          password: defaultPassword,
          email_confirm: true, // Auto-confirm email
        })

        if (authError) {
          results.push({
            email,
            success: false,
            error: authError.message,
          })
          continue
        }

        // Create user profile using service client to bypass RLS
        const { error: profileError } = await serviceClient.from('user_profile').insert({
          auth_user_id: authUser.user!.id,
          email_or_phone: email,
          role: role.toUpperCase(),
          station_id: station_id || null,
          is_verified: true,
          must_change_password: true, // Force password change on first login
        })

        if (profileError) {
          // Rollback: delete auth user if profile creation fails
          await serviceClient.auth.admin.deleteUser(authUser.user!.id)
          results.push({
            email,
            success: false,
            error: profileError.message,
          })
          continue
        }

        results.push({
          email,
          success: true,
          tempPassword: defaultPassword, // Return password (provided or generated) for admin to share with user
          password: password ? defaultPassword : undefined, // Also return as password if it was provided
        })
      } catch (err: any) {
        results.push({
          email: email || 'unknown',
          success: false,
          error: err.message,
        })
      }
    }

    return NextResponse.json({ results })
  } catch (error: any) {
    console.error('Error creating users:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

