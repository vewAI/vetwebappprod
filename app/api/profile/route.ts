import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
  // note: do not throw at import time in production, but log for dev
  console.warn('Supabase URL or SERVICE_ROLE missing for /api/profile route')
}

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing or invalid Authorization header' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')

    const admin = createClient(SUPABASE_URL as string, SUPABASE_SERVICE_ROLE as string)

    // Validate token and get user
    const { data: userData, error: userError } = await admin.auth.getUser(token)
    if (userError || !userData?.user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    const user = userData.user

    // Fetch profile using service role (bypass RLS)
    const { data, error } = await admin.from('profiles').select('*').eq('user_id', user.id).single()
    if (error) {
      console.error('Error fetching profile in /api/profile:', error.message)
      return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 })
    }

    return NextResponse.json({ profile: data })
  } catch (err) {
    console.error('Unexpected error in /api/profile:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
