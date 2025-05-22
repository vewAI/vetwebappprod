import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();
    
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }
    
    // Authenticate with Supabase
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    if (error) {
      return NextResponse.json(
        { error: 'Invalid login credentials' },
        { status: 401 }
      );
    }
    
    return NextResponse.json({
      success: true,
      user: data.user,
      session: data.session
    });
    
  } catch (err) {
    console.error('Authentication error:', err);
    
    // Return a generic error message
    return NextResponse.json(
      { error: 'Authentication failed' },
      { status: 500 }
    );
  }
}
